import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";
import { registrationSchema, type RegistrationInput } from "./schemas";
import {
  validateReferralCode,
  validateReferralEligibility,
} from "@/modules/referrals/service";

export type RegistrationResult =
  | { ok: true; email: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** First free P### code (same rule as scripts/create-user.ts). */
async function nextPartnerCode(tx?: Prisma.TransactionClient): Promise<string> {
  const db = tx ?? prisma;
  const existing = await db.partner.findMany({
    where: { code: { startsWith: "P" } },
    select: { code: true },
  });
  const used = new Set(existing.map((p) => p.code));
  for (let i = 1; i <= 999; i++) {
    const candidate = `P${String(i).padStart(3, "0")}`;
    if (!used.has(candidate)) return candidate;
  }
  return `P${Date.now()}`;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] ?? "Partenaire", lastName: parts.slice(1).join(" ") || "—" };
}

function normalizePhone(phone: string): string {
  // Stored as 8 ASCII digits (labels/validation live in schemas.ts).
  const digits = phone.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("216") ? digits.slice(3) : digits;
}

/**
 * Public partner sign-up. Server-side only — never trust role/status/inviter
 * from the client. Always creates PARTNER + PENDING.
 * Supports:
 * 1. "admin" invitation code (preserves existing admin inviter flow)
 * 2. Partner referral code (validates code & eligibility, creates ReferralAttribution record inside transaction)
 */
export async function registerPartner(raw: unknown): Promise<RegistrationResult> {
  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    const first = parsed.error.issues[0]?.message ?? "Données invalides.";
    return { ok: false, error: first, fieldErrors };
  }
  const input: RegistrationInput = parsed.data;

  const rawInviteCode = input.invitationCode.trim();
  const isAdminInvite = rawInviteCode.toLowerCase() === "admin";

  let adminInviterId: string | null = null;
  let partnerReferrer: { partnerId: string; userId: string } | null = null;

  if (isAdminInvite) {
    // Case 1: "admin" -> preserves existing admin inviter flow
    const inviter = await prisma.user.findFirst({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, status: "ACTIVE" },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (!inviter) {
      return { ok: false, error: "Inscription momentanément indisponible. Réessayez plus tard." };
    }
    adminInviterId = inviter.id;
  } else {
    // Case 2: partner referral code -> validate code & eligibility
    const codeValidation = await validateReferralCode(rawInviteCode);
    if (!codeValidation.valid || !codeValidation.referrer) {
      return {
        ok: false,
        error: codeValidation.error ?? "Code d'invitation invalide.",
        fieldErrors: { invitationCode: codeValidation.error ?? "Code d'invitation invalide." },
      };
    }

    const eligibility = await validateReferralEligibility(codeValidation.referrer.partnerId, {
      email: input.email,
      phone: input.phone,
    });

    if (!eligibility.valid) {
      return {
        ok: false,
        error: eligibility.error ?? "Parrainage non éligible.",
        fieldErrors: { invitationCode: eligibility.error ?? "Parrainage non éligible." },
      };
    }

    partnerReferrer = {
      partnerId: codeValidation.referrer.partnerId,
      userId: codeValidation.referrer.userId,
    };
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    return {
      ok: false,
      error: "Un compte existe déjà avec cet e-mail.",
      fieldErrors: { email: "Un compte existe déjà avec cet e-mail." },
    };
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const { firstName, lastName } = splitName(input.fullName);

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          firstName,
          lastName,
          role: "PARTNER",
          status: "ACTIVE",
        },
      });

      const invitedByUserId = isAdminInvite ? adminInviterId : partnerReferrer?.userId;

      const partner = await tx.partner.create({
        data: {
          userId: user.id,
          code: await nextPartnerCode(tx),
          displayName: input.fullName.trim().slice(0, 120),
          status: "PENDING",
          phone: normalizePhone(input.phone),
          experienceLevel: input.experience,
          invitedByUserId,
        },
      });

      // For partner referral, create ReferralAttribution inside the transaction
      if (!isAdminInvite && partnerReferrer) {
        await tx.referralAttribution.create({
          data: {
            referrerPartnerId: partnerReferrer.partnerId,
            referredPartnerId: partner.id,
            type: "PARTNER",
            status: "PENDING_QUALIFICATION",
          },
        });
      }

      await tx.wallet.create({ data: { partnerId: partner.id } });

      await recordAudit(tx, {
        actorId: user.id,
        action: "PARTNER_REGISTERED",
        entityType: "Partner",
        entityId: partner.id,
        after: {
          email: user.email,
          status: partner.status,
          experienceLevel: input.experience,
          invitedByUserId,
          referrerPartnerId: partnerReferrer?.partnerId ?? null,
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = (e.meta?.target as string[]) || [];
      if (Array.isArray(target) && target.includes("referredPartnerId")) {
        return {
          ok: false,
          error: "Ce partenaire est déjà attribué à un parrain.",
          fieldErrors: { invitationCode: "Ce partenaire est déjà attribué à un parrain." },
        };
      }
      return {
        ok: false,
        error: "Un compte existe déjà avec cet e-mail.",
        fieldErrors: { email: "Un compte existe déjà avec cet e-mail." },
      };
    }
    return { ok: false, error: "Inscription impossible pour le moment. Réessayez." };
  }

  return { ok: true, email: input.email };
}
