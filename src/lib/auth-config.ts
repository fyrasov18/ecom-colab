import type { NextAuthConfig } from "next-auth";

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
 *
 * They live HERE rather than in `lib/auth.ts` because the app instantiates
 * Auth.js twice: `lib/auth.ts` (route handlers, Node) and `src/middleware.ts`
 * (Edge). `middleware.ts` builds its own `NextAuth(authConfig)` and never
 * imports `lib/auth.ts`, so a guard placed only there would let Auth.js's own
 * `MissingSecret` surface from the Edge bundle with no variable named. Only
 * `process.env` is read, so this stays edge-safe.
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

/**
 * Edge-safe auth config (no Prisma / bcrypt imports) —
 * usable from middleware as well as the full server config.
 */
export const authConfig = {
  // JWT sessions cannot be revoked mid-life, so the lifetime is deliberately
  // bounded: 12 h absolute with a 1 h sliding refresh keeps a normal ops shift
  // signed in while capping how long a disabled user / role change survives.
  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60,
    updateAge: 60 * 60,
  },
  // Auth.js builds its URLs from the request Host header. Vercel enables this
  // implicitly through the `VERCEL` env var, but keeping it explicit means a
  // missing `AUTH_TRUST_HOST` can never turn every /api/auth/* call into the
  // opaque "?error=Configuration" page. Safe here: middleware already reads
  // `x-forwarded-*` (requestOrigin in src/middleware.ts).
  trustHost: true,
  pages: { signIn: "/login" },
  // Edge-safe config carries no providers; lib/auth.ts spreads the
  // Credentials provider in for the full server instance.
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.partnerId = (user as { partnerId?: string | null }).partnerId ?? null;
        token.firstName = (user as { firstName?: string }).firstName ?? "";
        token.lastName = (user as { lastName?: string }).lastName ?? "";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as never;
        session.user.partnerId = (token.partnerId as string | null) ?? null;
        session.user.firstName = (token.firstName as string) ?? "";
        session.user.lastName = (token.lastName as string) ?? "";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
