import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth-config";
import { recordAudit, type AuditEntry } from "@/modules/audit/service";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";

/**
 * Auth.js refuses to run with a bad configuration, but its failure mode is the
 * opaque `/api/auth/error?error=Configuration` page ("There is a problem with
 * the server configuration") which hides *which* variable is wrong — and
 * next-auth's client `signIn()` bails out to that page before it ever checks a
 * credential, so the login form looks broken for an unrelated reason.
 *
 * The two checks below mirror `@auth/core`'s own `setEnvDefaults`
 * (lib/utils/env.js) and `assertConfig` (lib/utils/assert.js) line for line, so
 * the build / function logs name the offending variable instead. Production
 * only: development and the test tooling run without a usable secret.
 */
function assertAuthEnvironment(): void {
  if (process.env.NODE_ENV !== "production") return;

  // env.js:22/28 — an absent OR empty secret ends up as `[]`, i.e. `.length === 0`.
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  if (!secret.length) {
    throw new Error(
      "[auth] MissingSecret: AUTH_SECRET (or NEXTAUTH_SECRET) is absent or empty. " +
        "Auth.js cannot sign sessions. Generate one with `openssl rand -hex 32`, " +
        "set it in Vercel → Settings → Environment Variables for Production AND " +
        "Preview (check the value is not blank), then redeploy."
    );
  }

  // env.js:40-44 — note the `??` chain (NOT `||`): a blank AUTH_URL or
  // AUTH_TRUST_HOST value short-circuits it and forces trustHost to false, which
  // Auth.js reports as UntrustedHost behind the same generic error page.
  const trusted = !!(
    process.env.AUTH_URL ??
    process.env.AUTH_TRUST_HOST ??
    process.env.VERCEL ??
    process.env.CF_PAGES ??
    // NODE_ENV is always "production" here; kept for parity with env.js, where
    // this is what makes a self-hosted production require AUTH_TRUST_HOST=true.
    (process.env.NODE_ENV !== "production")
  );
  if (!trusted) {
    throw new Error(
      "[auth] UntrustedHost: trustHost resolved to false because AUTH_URL or " +
        "AUTH_TRUST_HOST is set to an empty value (see @auth/core setEnvDefaults). " +
        "Delete the blank variable or give it a real value, then redeploy."
    );
  }
}
assertAuthEnvironment();

const credentialsSchema = z.object({
  email: z.string().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

/**
 * Sign-in events are audited so operators can see who accessed the back office
 * and spot brute-force attempts. Logging is best-effort on purpose: an audit
 * failure must never turn a valid sign-in into a failed one.
 */
async function auditAuthEvent(entry: AuditEntry): Promise<void> {
  try {
    await recordAudit(prisma, entry);
  } catch {
    // Intentionally swallowed — see above.
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials, request) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const normalizedEmail = email.toLowerCase();

        // Brute-force brake (spec §46). Two independent buckets so one noisy IP
        // and one targeted account are each throttled. The IP is read from the
        // request, never from the submitted credentials.
        const ip = clientIpFrom(request?.headers);
        const [ipLimit, accountLimit] = await Promise.all([
          checkRateLimit("LOGIN", ip ?? "unknown"),
          checkRateLimit("LOGIN_ACCOUNT", `${ip ?? "unknown"}:${normalizedEmail}`),
        ]);
        if (!ipLimit.allowed || !accountLimit.allowed) {
          await auditAuthEvent({
            actorId: null,
            action: "LOGIN_THROTTLED",
            entityType: "User",
            entityId: null,
            after: { email: normalizedEmail, reason: "RATE_LIMITED" },
            ip,
            userAgent: request?.headers.get("user-agent") ?? null,
          });
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          include: { partner: true },
        });

        const userAgent = request?.headers.get("user-agent") ?? null;

        if (!user || user.status !== "ACTIVE") {
          await auditAuthEvent({
            actorId: user?.id ?? null,
            action: "LOGIN_FAILED",
            entityType: "User",
            entityId: user?.id ?? null,
            after: {
              email: normalizedEmail,
              reason: user ? "USER_DISABLED" : "UNKNOWN_EMAIL",
            },
            ip,
            userAgent,
          });
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          await auditAuthEvent({
            actorId: user.id,
            action: "LOGIN_FAILED",
            entityType: "User",
            entityId: user.id,
            after: { email: normalizedEmail, reason: "INVALID_PASSWORD" },
            ip,
            userAgent,
          });
          return null;
        }

        await auditAuthEvent({
          actorId: user.id,
          action: "LOGIN_SUCCEEDED",
          entityType: "User",
          entityId: user.id,
          after: { email: normalizedEmail, role: user.role, partnerId: user.partner?.id ?? null },
          ip,
          userAgent,
        });

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          partnerId: user.partner?.id ?? null,
        };
      },
    }),
  ],
});
