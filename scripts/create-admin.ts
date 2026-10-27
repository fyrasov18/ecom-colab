/**
 * Create (or promote) the first production administrator.
 *
 * Secure by design:
 *  - credentials come from the ENVIRONMENT only (never argv, never a literal);
 *  - the password is never logged and never stored in plaintext;
 *  - refuses weak passwords;
 *  - safe to re-run: it promotes an existing account instead of creating a
 *    duplicate.
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' npx tsx scripts/create-admin.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const MIN_PASSWORD_LENGTH = 12;

function fail(message: string): never {
  console.error(`\n[create-admin] ${message}\n`);
  process.exit(1);
}

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    fail(
      "Variables manquantes. Utiliser :\n" +
        "  ADMIN_EMAIL=… ADMIN_PASSWORD='…' npx tsx scripts/create-admin.ts",
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fail("ADMIN_EMAIL invalide.");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(
      `ADMIN_PASSWORD trop court : ${MIN_PASSWORD_LENGTH} caractères minimum ` +
        "(utiliser une phrase de passe générée, ex. `openssl rand -base64 24`).",
    );
  }

  const [firstName, ...rest] = email.split("@")[0]!.split(/[._-]/);
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      firstName: firstName || "Admin",
      lastName: rest.join(" ") || "Production",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
    update: {
      passwordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });

  // The audit entry records WHO ran the bootstrap without storing the secret.
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "PRODUCTION_ADMIN_BOOTSTRAP",
      entityType: "User",
      entityId: user.id,
      after: { email: user.email, role: user.role },
    },
  });

  console.log(
    `\n[create-admin] Administrateur prêt : ${user.email} (rôle ${user.role}).\n` +
      "Le mot de passe n'a pas été journalisé.\n",
  );
}

main()
  .catch((e) => {
    // Report the REAL cause. The previous implementation collapsed every failure
    // into one opaque line, which is exactly how an unreachable database and a
    // missing schema both stayed hidden behind "[create-admin] Échec de la
    // création." Prisma masks credentials in these messages — only host/port is
    // ever printed, never the password.
    if (e instanceof Prisma.PrismaClientInitializationError) {
      console.error(
        "\n[create-admin] Connexion à la base impossible.\n" +
          `        ${e.message}\n` +
          "        Vérifier DATABASE_URL / DIRECT_URL. Neon : retirer\n" +
          "        `channel_binding=require`, qui provoque une erreur P1001.\n",
      );
    } else if (e instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(
        `\n[create-admin] Erreur base de données (${e.code}) : ${e.message}\n` +
          (e.code === "P2021" || e.code === "P2022"
            ? "        Le schéma n'est pas appliqué : lancer `npx prisma migrate deploy`.\n"
            : ""),
      );
    } else {
      console.error(
        "\n[create-admin] Échec de la création.\n" +
          `        ${e instanceof Error ? e.message : String(e)}\n`,
      );
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
