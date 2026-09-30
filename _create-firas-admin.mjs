/**
 * ONE-OFF — deleted immediately after use.
 *
 * Creates the LOCAL SUPER_ADMIN firas@ecom.com with the requested password
 * "admin", then proves a real sign-in over HTTP.
 *
 * Why a throwaway script: scripts/create-admin.ts and scripts/create-user.ts
 * both refuse passwords shorter than 12 characters. That guard exists to keep
 * weak credentials out of PRODUCTION; the user explicitly asked for this
 * password on the local development database, so the guard is bypassed here
 * instead of being weakened in the committed tooling.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const EMAIL = "firas@ecom.com";
const PASSWORD = "admin";
const BASE = "http://localhost:3000";

const prisma = new PrismaClient();

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "").hostname;
  console.log("target database host:", host);
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error("Refusing to write this weak credential outside a local database.");
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const before = await prisma.user.findUnique({ where: { email: EMAIL } });

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    create: {
      email: EMAIL,
      passwordHash,
      firstName: "Firas",
      lastName: "Admin",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
    update: { passwordHash, role: "SUPER_ADMIN", status: "ACTIVE" },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "USER_PROVISIONED_BY_SCRIPT",
      entityType: "User",
      entityId: user.id,
      before: before ? { role: before.role, status: before.status } : undefined,
      after: { email: user.email, role: user.role, status: user.status },
    },
  });
  console.log(`created: ${user.email} | ${user.role} | ${user.status}`);

  console.log("bcrypt.compare('admin', storedHash) =", await bcrypt.compare(PASSWORD, user.passwordHash));

  // ── real sign-in probe ──
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const jar = new Map();
  for (const raw of csrfRes.headers.getSetCookie()) {
    const pair = raw.split(";")[0];
    jar.set(pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1));
  }
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
      "x-auth-return-redirect": "1",
    },
    body: new URLSearchParams({
      csrfToken,
      email: EMAIL,
      password: PASSWORD,
      callbackUrl: `${BASE}/dashboard`,
    }),
  });
  const setCookies = res.headers.getSetCookie();
  console.log("sign-in response:", res.status, (await res.text()).slice(0, 200));
  console.log("session cookie issued:", setCookies.some((c) => c.includes("session-token")));
  console.log("cookies:", setCookies.map((c) => c.split("=")[0]).join(", ") || "(none)");

  const audit = await prisma.auditLog.findFirst({
    where: { entityId: user.id, action: "LOGIN_SUCCEEDED" },
    orderBy: { createdAt: "desc" },
  });
  console.log("LOGIN_SUCCEEDED audit:", audit ? JSON.stringify(audit.after) : "MISSING");
}

main()
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
