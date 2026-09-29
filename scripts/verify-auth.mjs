#!/usr/bin/env node
/**
 * Phase 1 — end-to-end authentication & authorisation check.
 *
 * Starts its own `next dev` server on a spare port, then verifies through real
 * HTTP: public routes, sign-in (valid / invalid / disabled account), role-based
 * routing in middleware, and the auth audit trail. Nothing is mocked.
 *
 * Usage: node scripts/verify-auth.mjs      (VERIFY_PORT to override 3100)
 */
import { spawn } from "node:child_process";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const PORT = Number(process.env.VERIFY_PORT ?? 3100);
const BASE = `http://localhost:${PORT}`;
const prisma = new PrismaClient();
const results = [];

function report(name, ok, info = "") {
  results.push({ name, ok });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${info ? ` — ${info}` : ""}`);
}

/** Minimal cookie jar — Node's fetch has no cookie store. */
class Jar {
  constructor() {
    this.cookies = new Map();
  }
  absorb(res) {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const at = pair.indexOf("=");
      if (at < 0) continue;
      const name = pair.slice(0, at).trim();
      const value = pair.slice(at + 1).trim();
      if (value === "") this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
  get header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  get hasSession() {
    return [...this.cookies.keys()].some((n) => n.includes("session-token"));
  }
}

async function get(path, jar) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: jar?.header ? { cookie: jar.header } : {},
    signal: AbortSignal.timeout(90_000),
  });
  jar?.absorb(res);
  return res;
}

async function login(email, password) {
  const jar = new Jar();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, {
    signal: AbortSignal.timeout(30_000),
  });
  jar.absorb(csrfRes);
  const { csrfToken } = await csrfRes.json();

  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: jar.header,
    },
    body: new URLSearchParams({ email, password, csrfToken, callbackUrl: BASE }),
    signal: AbortSignal.timeout(60_000),
  });
  jar.absorb(res);
  return jar;
}

const isRedirect = (res) => res.status >= 300 && res.status < 400;
const location = (res) => res.headers.get("location") ?? "";

async function waitForServer(timeoutMs = 180_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/login`, { signal: AbortSignal.timeout(15_000) });
      if (res.status === 200) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  return false;
}

const server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
  shell: true,
  env: { ...process.env, NEXTAUTH_URL: BASE, AUTH_TRUST_HOST: "true" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d.toString()));
server.stderr.on("data", (d) => (serverLog += d.toString()));

let exitCode = 0;
try {
  if (!(await waitForServer())) {
    console.log("SERVER_LOG_TAIL:\n" + serverLog.slice(-2000));
    throw new Error("dev server did not become ready");
  }
  report("dev server answers on its own port", true, BASE);

  // ── public routes ──
  const loginPage = await get("/login");
  report("public /login is reachable without a session", loginPage.status === 200, `status=${loginPage.status}`);


  const anonDash = await get("/dashboard");
  report(
    "unauthenticated /dashboard is redirected to /login",
    isRedirect(anonDash) && location(anonDash).includes("/login"),
    `status=${anonDash.status} → ${location(anonDash)}`,
  );

  // ── sign-in (valid / invalid) ──
  const admin = await login("admin@ecomcolab.tn", "Admin123!");
  report("SUPER_ADMIN signs in and receives a session cookie", admin.hasSession);

  const badPassword = await login("admin@ecomcolab.tn", "not-the-password");
  report("a wrong password issues no session cookie", !badPassword.hasSession);

  const unknownEmail = await login("nobody@ecomcolab.test", "whatever");
  report("an unknown e-mail issues no session cookie", !unknownEmail.hasSession);

  // ── SUPER_ADMIN authorisation ──
  const adminDash = await get("/dashboard", admin);
  report("SUPER_ADMIN reaches /dashboard", adminDash.status === 200, `status=${adminDash.status}`);

  const adminSettings = await get("/parametres", admin);
  report("SUPER_ADMIN reaches /parametres", adminSettings.status === 200, `status=${adminSettings.status}`);

  const adminOnLogin = await get("/login", admin);
  report(
    "a signed-in user is redirected away from /login",
    isRedirect(adminOnLogin) && location(adminOnLogin).endsWith("/dashboard"),
    `status=${adminOnLogin.status} → ${location(adminOnLogin)}`,
  );

  const adminPartnerArea = await get("/portefeuille", admin);
  report(
    "SUPER_ADMIN is blocked from the partner area",
    isRedirect(adminPartnerArea) && location(adminPartnerArea).endsWith("/dashboard"),
    `status=${adminPartnerArea.status} → ${location(adminPartnerArea)}`,
  );

  // ── PARTNER authorisation ──
  const partner = await login("nour@partner.tn", "Partner123!");
  report("PARTNER signs in and receives a session cookie", partner.hasSession);

  const partnerHome = await get("/tableau-de-bord", partner);
  report("PARTNER reaches /tableau-de-bord", partnerHome.status === 200, `status=${partnerHome.status}`);

  const partnerNewOrder = await get("/nouvelle-commande", partner);
  report(
    "PARTNER reaches /nouvelle-commande",
    partnerNewOrder.status === 200,
    `status=${partnerNewOrder.status}`,
  );

  for (const path of ["/dashboard", "/clients", "/finance", "/parametres", "/audit", "/logistique"]) {
    const res = await get(path, partner);
    report(
      `PARTNER is blocked from ${path}`,
      isRedirect(res) && location(res).endsWith("/tableau-de-bord"),
      `status=${res.status} → ${location(res)}`,
    );
  }

  // ── disabled account (temporary row, removed again below) ──
  const disabledEmail = `verify-auth-disabled-${Date.now()}@ecomcolab.test`;
  const disabledUser = await prisma.user.create({
    data: {
      email: disabledEmail,
      passwordHash: await bcrypt.hash("Disabled123!", 12),
      firstName: "Verify",
      lastName: "Disabled",
      role: "ADMIN",
      status: "DISABLED",
    },
  });
  const disabledLogin = await login(disabledEmail, "Disabled123!");
  report("a DISABLED account cannot sign in", !disabledLogin.hasSession);

  // ── auth audit trail ──
  const adminUser = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@ecomcolab.tn" },
  });
  const succeeded = await prisma.auditLog.count({
    where: { action: "LOGIN_SUCCEEDED", entityId: adminUser.id },
  });
  const failed = await prisma.auditLog.count({
    where: { action: "LOGIN_FAILED", entityId: adminUser.id },
  });
  report("successful sign-ins are audited (LOGIN_SUCCEEDED)", succeeded > 0, `rows=${succeeded}`);
  report("failed sign-ins are audited (LOGIN_FAILED)", failed > 0, `rows=${failed}`);

  await prisma.user.delete({ where: { id: disabledUser.id } });
} catch (e) {
  report("verification run completed", false, e.message);
  console.log("SERVER_LOG_TAIL:\n" + serverLog.slice(-1500));
} finally {
  await prisma.$disconnect();
  server.kill();
  if (process.platform === "win32" && server.pid) {
    // `npx` spawns a child node process — kill the whole tree.
    spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  }
  const failedChecks = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failedChecks.length}/${results.length} checks passed.`);
  if (failedChecks.length) exitCode = 1;
  process.exitCode = exitCode;
}

