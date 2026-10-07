import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";
import { registrationSchema, type RegistrationInput } from "./schemas";

export type RegistrationResult =
  | { ok: true; email: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** First free P### code (same rule as scripts/create-user.ts). */
async function nextPartnerCode(): Promise<string> {
  const existing = await prisma.partner.findMany({
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
 * from the client. Always creates PARTNER + PENDING, inviter resolved here.
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

  // Invitation: only "admin" is accepted. It is NOT a role — it resolves to an
  // existing Admin user recorded as inviter. Case-insensitive, trimmed.
  if (input.invitationCode.trim().toLowerCase() !== "admin") {
    return {
      ok: false,
      error: "Code d'invitation invalide.",
      fieldErrors: { invitationCode: "Code d'invitation invalide." },
    };
  }
  const inviter = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, status: "ACTIVE" },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  if (!inviter) {
    return { ok: false, error: "Inscription momentanément indisponible. Réessayez plus tard." };
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
      const partner = await tx.partner.create({
        data: {
          userId: user.id,
          code: await nextPartnerCode(),
          displayName: input.fullName.trim().slice(0, 120),
          status: "PENDING",
          phone: normalizePhone(input.phone),
          experienceLevel: input.experience,
          invitedByUserId: inviter.id,
        },
      });
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
          invitedByUserId: inviter.id,
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
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
