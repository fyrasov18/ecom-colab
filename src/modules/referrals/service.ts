import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

import {
  getPartnerReferralLevel,
  getReferralThresholdSettings,
} from "./levels";

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

  const url = buildReferralUrl(link.code);

  return { code: link.code, url };
}

/**
 * Resolves the public base URL for referral links in a production-safe manner.
 * Prioritizes NEXT_PUBLIC_APP_URL, then Vercel production variables,
 * falling back to the canonical production domain https://ecom-colab.vercel.app.
 */
export function getReferralBaseUrl(): string {
  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (publicAppUrl) {
    return publicAppUrl.replace(/\/+$/, "");
  }

  const vercelProdUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProdUrl) {
    return `https://${vercelProdUrl.replace(/\/+$/, "")}`;
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/+$/, "")}`;
  }

  const nextAuthUrl = (process.env.NEXTAUTH_URL || process.env.AUTH_URL)?.trim();
  if (nextAuthUrl && !nextAuthUrl.includes("localhost") && !nextAuthUrl.includes("127.0.0.1")) {
    return nextAuthUrl.replace(/\/+$/, "");
  }

  return "https://ecom-colab.vercel.app";
}

/**
 * Builds a canonical referral registration URL without duplicate slashes.
 */
export function buildReferralUrl(code: string): string {
  const baseUrl = getReferralBaseUrl();
  const cleanCode = encodeURIComponent((code ?? "").trim());
  return `${baseUrl}/register?ref=${cleanCode}`;
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

      const parentAttribution: { referrerPartnerId: string } | null =
        await db.referralAttribution.findUnique({
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

export type ReferralPromotionCandidate = {
  partnerId: string;
  displayName: string;
  code: string;
  email?: string;
  currentLevel: number;
  targetLevel: number;
  qualifiedCount: number;
  threshold: number;
  currentRate: string;
  targetRate: string;
};

export type ReferralQueueCommissionItem = {
  id: string;
  orderId?: string | null;
  amount: string | number;
  currency: string;
  status: string;
  createdAt: string | Date;
  calculationDetails?: Prisma.JsonValue;
  referrer: {
    id: string;
    code: string;
    displayName: string;
    email?: string;
  };
  referred: {
    id: string;
    code: string;
    displayName: string;
    email?: string;
  };
};

export type ReferralPaymentQueueItem = {
  id: string;
  orderId?: string | null;
  amount: string | number;
  currency: string;
  status: string;
  approvedAt?: string | Date | null;
  approvedById?: string | null;
  calculationDetails?: Prisma.JsonValue;
  referrer: {
    id: string;
    code: string;
    displayName: string;
    email?: string;
  };
  referred: {
    id: string;
    code: string;
    displayName: string;
  };
};

/**
 * Fetches all data required to render the Admin Referral & Commission Hub.
 * Moves database access out of the presentation layer.
 */
export async function getAdminReferralDashboardData(tx?: Prisma.TransactionClient) {
  const db = tx ?? prisma;

  // 1. Fetch overview metrics
  const [
    activeLinksCount,
    totalAttributionsCount,
    qualifiedReferralsCount,
    pendingApprovalCount,
    totalPaidCommissionsAgg,
  ] = await Promise.all([
    db.referralLink.count({ where: { isActive: true } }),
    db.referralAttribution.count(),
    db.referralAttribution.count({ where: { status: "QUALIFIED" } }),
    db.referralCommission.count({
      where: { status: { in: ["PENDING_VERIFICATION", "ELIGIBLE"] } },
    }),
    db.referralCommission.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
    }),
  ]);

  const totalPaidAmount = totalPaidCommissionsAgg._sum.amount ?? 0;

  // 2. Attributions list (recent 50)
  const attributions = await db.referralAttribution.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      referrerPartner: {
        select: {
          id: true,
          code: true,
          displayName: true,
          user: { select: { email: true } },
        },
      },
      referredPartner: {
        select: {
          id: true,
          code: true,
          displayName: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  // 3. Promotion Queue (5 levels)
  const thresholds = await getReferralThresholdSettings(db);
  const qualifiedAttributions = await db.referralAttribution.findMany({
    where: { status: "QUALIFIED" },
    select: { referrerPartnerId: true },
  });

  const countByReferrer = new Map<string, number>();
  for (const attr of qualifiedAttributions) {
    countByReferrer.set(
      attr.referrerPartnerId,
      (countByReferrer.get(attr.referrerPartnerId) ?? 0) + 1,
    );
  }

  const rateMap: Record<number, string> = {
    1: "3%",
    2: "7%",
    3: "15%",
    4: "20%",
    5: "30%",
  };

  const thresholdMap: Record<number, number> = {
    2: thresholds.level2Threshold,
    3: thresholds.level3Threshold,
    4: thresholds.level4Threshold,
    5: thresholds.level5Threshold,
  };

  const promotionCandidates: ReferralPromotionCandidate[] = [];
  for (const [pId, count] of countByReferrer.entries()) {
    if (count >= thresholds.level2Threshold) {
      const levelRes = await getPartnerReferralLevel(pId, db);
      if (levelRes.targetLevel > levelRes.level) {
        const partner = await db.partner.findUnique({
          where: { id: pId },
          include: { user: { select: { email: true } } },
        });
        if (partner) {
          promotionCandidates.push({
            partnerId: partner.id,
            displayName: partner.displayName,
            code: partner.code,
            email: partner.user?.email,
            currentLevel: levelRes.level,
            targetLevel: levelRes.targetLevel,
            qualifiedCount: levelRes.qualifiedCount,
            threshold: thresholdMap[levelRes.targetLevel] ?? thresholds.level2Threshold,
            currentRate: rateMap[levelRes.level] ?? "3%",
            targetRate: rateMap[levelRes.targetLevel] ?? "7%",
          });
        }
      }
    }
  }

  // 4. Commission Approval Queue (PENDING_VERIFICATION or ELIGIBLE)
  const approvalCommissions = await db.referralCommission.findMany({
    where: { status: { in: ["PENDING_VERIFICATION", "ELIGIBLE"] } },
    orderBy: { createdAt: "desc" },
    include: {
      referrerPartner: {
        select: {
          id: true,
          code: true,
          displayName: true,
          user: { select: { email: true } },
        },
      },
      attribution: {
        include: {
          referredPartner: {
            select: {
              id: true,
              code: true,
              displayName: true,
              user: { select: { email: true } },
            },
          },
        },
      },
    },
  });

  const approvalQueueItems: ReferralQueueCommissionItem[] = approvalCommissions.map((c) => ({
    id: c.id,
    orderId: c.orderId,
    amount: c.amount.toString(),
    currency: c.currency,
    status: c.status,
    createdAt: c.createdAt,
    calculationDetails: c.calculationDetails,
    referrer: {
      id: c.referrerPartner.id,
      code: c.referrerPartner.code,
      displayName: c.referrerPartner.displayName,
      email: c.referrerPartner.user?.email,
    },
    referred: {
      id: c.attribution.referredPartner.id,
      code: c.attribution.referredPartner.code,
      displayName: c.attribution.referredPartner.displayName,
      email: c.attribution.referredPartner.user?.email,
    },
  }));

  // 5. Payment Queue (APPROVED_FOR_PAYMENT)
  const paymentCommissions = await db.referralCommission.findMany({
    where: { status: "APPROVED_FOR_PAYMENT" },
    orderBy: { approvedAt: "desc" },
    include: {
      referrerPartner: {
        select: {
          id: true,
          code: true,
          displayName: true,
          user: { select: { email: true } },
        },
      },
      attribution: {
        include: {
          referredPartner: {
            select: {
              id: true,
              code: true,
              displayName: true,
            },
          },
        },
      },
    },
  });

  const paymentQueueItems: ReferralPaymentQueueItem[] = paymentCommissions.map((c) => ({
    id: c.id,
    orderId: c.orderId,
    amount: c.amount.toString(),
    currency: c.currency,
    status: c.status,
    approvedAt: c.approvedAt,
    approvedById: c.approvedById,
    calculationDetails: c.calculationDetails,
    referrer: {
      id: c.referrerPartner.id,
      code: c.referrerPartner.code,
      displayName: c.referrerPartner.displayName,
      email: c.referrerPartner.user?.email,
    },
    referred: {
      id: c.attribution.referredPartner.id,
      code: c.attribution.referredPartner.code,
      displayName: c.attribution.referredPartner.displayName,
    },
  }));

  // 6. Historical Ledger / Payout Log (PAID, REJECTED, REVERSED)
  const historicalCommissions = await db.referralCommission.findMany({
    where: { status: { in: ["PAID", "REJECTED", "REVERSED"] } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      referrerPartner: {
        select: {
          id: true,
          code: true,
          displayName: true,
          user: { select: { email: true } },
        },
      },
      attribution: {
        include: {
          referredPartner: {
            select: {
              id: true,
              code: true,
              displayName: true,
              user: { select: { email: true } },
            },
          },
        },
      },
    },
  });

  return {
    metrics: {
      activeLinksCount,
      totalAttributionsCount,
      qualifiedReferralsCount,
      pendingApprovalCount,
      totalPaidAmount,
    },
    attributions,
    promotionCandidates,
    approvalQueueItems,
    paymentQueueItems,
    historicalCommissions,
    thresholds,
  };
}

/**
 * Fetches all data required to render the Partner Referral Dashboard.
 * Moves database access out of the presentation layer.
 */
export async function getPartnerReferralDashboardData(
  partnerId: string,
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;

  const [
    linkData,
    levelData,
    thresholdSettings,
    pendingCommissionsAgg,
    approvedCommissionsAgg,
    paidCommissionsAgg,
    attributions,
    commissions,
  ] = await Promise.all([
    getOrCreateReferralCode(partnerId, db),
    getPartnerReferralLevel(partnerId, db),
    getReferralThresholdSettings(db),
    db.referralCommission.aggregate({
      where: {
        referrerPartnerId: partnerId,
        status: { in: ["PENDING_VERIFICATION", "ELIGIBLE"] },
      },
      _sum: { amount: true },
    }),
    db.referralCommission.aggregate({
      where: {
        referrerPartnerId: partnerId,
        status: "APPROVED_FOR_PAYMENT",
      },
      _sum: { amount: true },
    }),
    db.referralCommission.aggregate({
      where: {
        referrerPartnerId: partnerId,
        status: "PAID",
      },
      _sum: { amount: true },
    }),
    db.referralAttribution.findMany({
      where: { referrerPartnerId: partnerId },
      include: {
        referredPartner: {
          select: {
            id: true,
            displayName: true,
            code: true,
            createdAt: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.referralCommission.findMany({
      where: { referrerPartnerId: partnerId },
      include: {
        attribution: {
          include: {
            referredPartner: {
              select: {
                displayName: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const pendingAmount = pendingCommissionsAgg._sum.amount ?? 0;
  const approvedAmount = approvedCommissionsAgg._sum.amount ?? 0;
  const paidAmount = paidCommissionsAgg._sum.amount ?? 0;

  return {
    linkData,
    levelData,
    thresholdSettings,
    pendingAmount,
    approvedAmount,
    paidAmount,
    attributions,
    commissions,
  };
}
