/**
 * Provision a platform account (SUPER_ADMIN / ADMIN / PARTNER) from the CLI.
 *
 * Why this exists next to create-admin.ts:
 *  - create-admin.ts bootstraps exactly one SUPER_ADMIN and nothing else;
 *  - there is deliberately no user-management screen yet (see
 *    docs/phase-1-foundation.md — "gestion des utilisateurs dans l'interface" is
 *    listed as future work), so day-to-day provisioning happens here;
 *  - a PARTNER is never just a User row: the session's `partnerId` comes from the
 *    Partner record, so a PARTNER user without one cannot use the partner area.
 *
 * Secure by design, same rules as create-admin.ts:
 *  - credentials come from the ENVIRONMENT only (never argv, never a literal);
 *  - the password is never logged and never stored in plaintext;
 *  - refuses weak passwords and unknown roles;
 *  - idempotent: re-running updates/promotes the account instead of duplicating it.
 *
 * Usage (PowerShell):
 *   $env:USER_EMAIL='ops2@ecomcolab.tn'; $env:USER_PASSWORD='…'; $env:USER_ROLE='ADMIN'
 *   npx tsx scripts/create-user.ts
 *
 * PARTNER account (also creates the Partner + Wallet records):
 *   $env:USER_EMAIL='sami@partner.tn'; $env:USER_PASSWORD='…'; $env:USER_ROLE='PARTNER'
 *   $env:PARTNER_NAME='Sami Bouazizi'        # optional, defaults to the name
 *   $env:PARTNER_CODE='P011'                 # optional, defaults to the next P###
 *   npx tsx scripts/create-user.ts
 */
import { PrismaClient, Prisma, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const MIN_PASSWORD_LENGTH = 12;
const ROLES = ["SUPER_ADMIN", "ADMIN", "PARTNER"] as const;

function fail(message: string): never {
  console.error(`\n[create-user] ${message}\n`);
  process.exit(1);
}

/** First free P### code, so the operator rarely has to invent one. */
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

async function main() {
  const email = process.env.USER_EMAIL?.trim().toLowerCase();
  const password = process.env.USER_PASSWORD;
  const roleInput = process.env.USER_ROLE?.trim().toUpperCase();

  if (!email || !password || !roleInput) {
    fail(
      "Variables manquantes. Utiliser :\n" +
        "  USER_EMAIL=… USER_PASSWORD='…' USER_ROLE=SUPER_ADMIN|ADMIN|PARTNER " +
        "npx tsx scripts/create-user.ts",
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fail("USER_EMAIL invalide.");
  }
  if (!(ROLES as readonly string[]).includes(roleInput)) {
    fail(`USER_ROLE invalide : attendu ${ROLES.join(" | ")}.`);
  }
  const role = roleInput as Role;
  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(
      `USER_PASSWORD trop court : ${MIN_PASSWORD_LENGTH} caractères minimum ` +
        "(utiliser une phrase de passe générée, ex. `openssl rand -base64 24`).",
    );
  }

  const [firstName, ...rest] = email.split("@")[0]!.split(/[._-]/);
  const passwordHash = await bcrypt.hash(password, 12);

  const before = await prisma.user.findUnique({
    where: { email },
    include: { partner: true },
  });

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      firstName: firstName || "Compte",
      lastName: rest.join(" ") || role,
      role,
      status: "ACTIVE",
    },
    // Re-running is the supported way to reset a password or change a role.
    update: { passwordHash, role, status: "ACTIVE" },
  });

  if (role === "PARTNER") {
    const partner = await prisma.partner.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        code: process.env.PARTNER_CODE?.trim() || (await nextPartnerCode()),
        displayName:
          process.env.PARTNER_NAME?.trim() ||
          `${user.firstName} ${user.lastName}`.trim(),
      },
      update: {},
    });
    // Balances are Decimal(12,3) caches recomputed from FinancialTransaction;
    // the row must exist before the partner opens /portefeuille.
    await prisma.wallet.upsert({
      where: { partnerId: partner.id },
      create: { partnerId: partner.id },
      update: {},
    });
    console.log(
      `\n[create-user] Fiche partenaire : ${partner.code} (${partner.displayName}).`,
    );
  }

  // The audit entry records what was provisioned without storing the secret.
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "USER_PROVISIONED_BY_SCRIPT",
      entityType: "User",
      entityId: user.id,
      before: before
        ? { role: before.role, status: before.status, partnerId: before.partner?.id ?? null }
        : undefined,
      after: { email: user.email, role: user.role, status: user.status },
    },
  });

  console.log(
    `\n[create-user] Compte prêt : ${user.email} (rôle ${user.role}, ` +
      `statut ${user.status}).\nLe mot de passe n'a pas été journalisé.\n`,
  );
}

main()
  .catch((e) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(`\n[create-user] Erreur base de données (${e.code}).\n`);
    } else {
      console.error("\n[create-user] Échec de la création.\n");
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
