import type { NextAuthConfig } from "next-auth";

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
