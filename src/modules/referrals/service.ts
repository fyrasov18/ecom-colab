import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class ReferralAuthorizationError extends Error {
  constructor(message: string = "Seuls les partenaires actifs peuvent créer un lien de parrainage.") {
    super(message);
    this.name = "ReferralAuthorizationError";
  }
}

export type ReferralValidationResult =
  | {
      valid: true;
      referrerPartnerId: string;
      referrer: {
        partnerId: string;
        userId: string;
        displayName: string;
        code: string;
        status: string;
        email: string;
        phone: string | null;
      };
    }
  | {
      valid: false;
      error: string;
      referrerPartnerId?: undefined;
      referrer?: undefined;
    };

export type ReferralEligibilityCandidate = {
  id?: string;
  email?: string;
  phone?: string;
};

export type ReferralEligibilityResult =
  | { valid: true }
  | { valid: false; error: string };

/**
 * Normalizes phone number to the last 8 digits (Tunisian numbering plan).
 * Strips non-digits, country code +216, etc.
 */
export function normalizePhoneDigits(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-8) : digits;
}

/**
 * Generates or retrieves an existing active referral code & URL for an ACTIVE partner.
 * Server-side check strictly enforces `Partner.status === "ACTIVE"`.
 * Rejects unapproved, pending, suspended, or closed partners with ReferralAuthorizationError.
 */
export async function getOrCreateReferralCode(
  partnerId: string,
  tx?: Prisma.TransactionClient,
): Promise<{ code: string; url: string }> {
  const db = tx ?? prisma;

  const partner = await db.partner.findUnique({
    where: { id: partnerId },
    select: { id: true, code: true, status: true },
  });

  if (!partner) {
    throw new ReferralAuthorizationError("Partenaire introuvable.");
  }

  if (partner.status !== "ACTIVE") {
    throw new ReferralAuthorizationError(
      `Le partenaire n'est pas actif (statut: ${partner.status}). Seuls les partenaires actifs peuvent générer un lien de parrainage.`,
    );
  }

  // 1. Fetch existing active ReferralLink
  let link = await db.referralLink.findFirst({
    where: { partnerId: partner.id, isActive: true },
  });

  // 2. If no active link exists, create one using the partner's unique code
  if (!link) {
    try {
      link = await db.referralLink.create({
        data: {
          partnerId: partner.id,
          code: partner.code,
          isActive: true,
        },
      });
    } catch {
      // In case of unique collision or race condition, fallback to slug lookup or unique suffix
      link = await db.referralLink.findUnique({
        where: { code: partner.code },
      });

      if (!link) {
        const fallbackCode = `${partner.code}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        link = await db.referralLink.create({
          data: {
            partnerId: partner.id,
            code: fallbackCode,
            isActive: true,
          },
        });
      }
    }
  }

  const baseUrl =
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "";

  const url = baseUrl
    ? `${baseUrl.replace(/\/+$/, "")}/register?ref=${link.code}`
    : `/register?ref=${link.code}`;

  return { code: link.code, url };
}

/**
 * Validates a referral code against ReferralLink or Partner.code.
 * Verifies that the owning partner has status === "ACTIVE".
 * Returns valid boolean and detailed referrer information.
 */
export async function validateReferralCode(
  rawCode: string,
  tx?: Prisma.TransactionClient,
): Promise<ReferralValidationResult> {
  const db = tx ?? prisma;
  const code = (rawCode ?? "").trim();

  if (!code) {
    return { valid: false, error: "Code de parrainage manquant." };
  }

  // 1. Lookup in ReferralLink
  const link = await db.referralLink.findUnique({
    where: { code },
    include: {
      partner: {
        include: {
          user: {
            select: { id: true, email: true },
          },
        },
      },
    },
  });

  if (link) {
    if (!link.isActive) {
      return { valid: false, error: "Ce lien de parrainage est désactivé." };
    }
    if (link.partner.status !== "ACTIVE") {
      return {
        valid: false,
        error: `Le parrain n'est pas actif (statut: ${link.partner.status}). Seuls les partenaires actifs peuvent parrainer.`,
      };
    }

    return {
      valid: true,
      referrerPartnerId: link.partner.id,
      referrer: {
        partnerId: link.partner.id,
        userId: link.partner.userId,
        displayName: link.partner.displayName,
        code: link.partner.code,
        status: link.partner.status,
        email: link.partner.user.email,
        phone: link.partner.phone,
      },
    };
  }

  // 2. Fallback lookup in Partner.code
  const partner = await db.partner.findUnique({
    where: { code },
    include: {
      user: {
        select: { id: true, email: true },
      },
    },
  });

  if (!partner) {
    return { valid: false, error: "Code de parrainage invalide ou inexistant." };
  }

  if (partner.status !== "ACTIVE") {
    return {
      valid: false,
      error: `Le parrain n'est pas actif (statut: ${partner.status}). Seuls les partenaires actifs peuvent parrainer.`,
    };
  }

  return {
    valid: true,
    referrerPartnerId: partner.id,
    referrer: {
      partnerId: partner.id,
      userId: partner.userId,
      displayName: partner.displayName,
      code: partner.code,
      status: partner.status,
      email: partner.user.email,
      phone: partner.phone,
    },
  };
}

/**
 * Validates referral eligibility to prevent abuse:
 * - Rejects self-referrals (matching candidate ID, email, or normalized phone).
 * - Rejects referral cycles (candidate must not already be an ancestor referrer of the inviter).
 * - Rejects duplicate attribution (candidate already has an active attribution).
 */
export async function validateReferralEligibility(
  referrerPartnerId: string,
  candidate: ReferralEligibilityCandidate,
  tx?: Prisma.TransactionClient,
): Promise<ReferralEligibilityResult> {
  const db = tx ?? prisma;

  // 1. Verify referrer exists and is ACTIVE
  const referrer = await db.partner.findUnique({
    where: { id: referrerPartnerId },
    include: {
      user: {
        select: { id: true, email: true },
      },
    },
  });

  if (!referrer) {
    return { valid: false, error: "Partenaire parrain introuvable." };
  }

  if (referrer.status !== "ACTIVE") {
    return {
      valid: false,
      error: `Le parrain n'est pas actif (statut: ${referrer.status}). Seuls les partenaires actifs peuvent parrainer.`,
    };
  }

  // 2. Self-referral check: matching partner ID
  if (candidate.id && candidate.id === referrer.id) {
    return {
      valid: false,
      error: "Auto-parrainage interdit: identifiant partenaire identique.",
    };
  }

  // Self-referral check: matching email
  if (candidate.email && referrer.user?.email) {
    if (candidate.email.trim().toLowerCase() === referrer.user.email.trim().toLowerCase()) {
      return {
        valid: false,
        error: "Auto-parrainage interdit: même adresse e-mail.",
      };
    }
  }

  // Self-referral check: matching normalized phone number
  if (candidate.phone && referrer.phone) {
    const candNorm = normalizePhoneDigits(candidate.phone);
    const refNorm = normalizePhoneDigits(referrer.phone);
    if (candNorm && refNorm && candNorm === refNorm) {
      return {
        valid: false,
        error: "Auto-parrainage interdit: même numéro de téléphone.",
      };
    }
  }

  // 3. Resolve candidate partner ID if not directly provided
  let candidatePartnerId = candidate.id;
  if (!candidatePartnerId && candidate.email) {
    const existingUser = await db.user.findUnique({
      where: { email: candidate.email.trim().toLowerCase() },
      include: { partner: true },
    });
    if (existingUser?.partner) {
      candidatePartnerId = existingUser.partner.id;
    }
  }

  if (candidatePartnerId) {
    // If resolved partner ID matches referrer ID
    if (candidatePartnerId === referrer.id) {
      return {
        valid: false,
        error: "Auto-parrainage interdit: identifiant partenaire identique.",
      };
    }

    // Duplicate attribution check: candidate already attributed
    const existingAttribution = await db.referralAttribution.findUnique({
      where: { referredPartnerId: candidatePartnerId },
    });
    if (existingAttribution) {
      return {
        valid: false,
        error: "Ce partenaire est déjà attribué à un parrain.",
      };
    }

    // Direct cycle check: did candidate already refer this referrer?
    const directCycle = await db.referralAttribution.findFirst({
      where: {
        referrerPartnerId: candidatePartnerId,
        referredPartnerId: referrer.id,
      },
    });
    if (directCycle) {
      return {
        valid: false,
        error: "Cycle de parrainage détecté: le candidat a déjà parrainé ce partenaire.",
      };
    }

    // Multi-hop cycle check: candidate must not be an ancestor referrer of the inviter
    let currentPartnerId: string | null = referrer.id;
    const visited = new Set<string>();

    while (currentPartnerId) {
      if (currentPartnerId === candidatePartnerId) {
        return {
          valid: false,
          error: "Cycle de parrainage détecté dans la chaîne de parrainage.",
        };
      }

      visited.add(currentPartnerId);

      const parentAttribution = await db.referralAttribution.findUnique({
        where: { referredPartnerId: currentPartnerId },
        select: { referrerPartnerId: true },
      });

      if (!parentAttribution) {
        break;
      }

      currentPartnerId = parentAttribution.referrerPartnerId;
      if (currentPartnerId && visited.has(currentPartnerId)) {
        break;
      }
    }
  }

  return { valid: true };
}

/**
 * Creates a ReferralAttribution record inside a database transaction,
 * enforcing eligibility and cycle checks.
 */
export async function recordPartnerReferral(
  tx: Prisma.TransactionClient,
  referrerPartnerId: string,
  newPartnerId: string,
) {
  const eligibility = await validateReferralEligibility(
    referrerPartnerId,
    { id: newPartnerId },
    tx,
  );

  if (!eligibility.valid) {
    throw new Error(eligibility.error);
  }

  return await tx.referralAttribution.create({
    data: {
      referrerPartnerId,
      referredPartnerId: newPartnerId,
      type: "PARTNER",
      status: "PENDING_QUALIFICATION",
    },
  });
}
