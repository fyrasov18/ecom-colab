import { NextResponse, type NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth-config";
import {
  ADMIN_PREFIXES,
  PARTNER_PREFIXES,
  ROLE_HOME,
  matchPrefix,
} from "@/lib/roles";

const { auth } = NextAuth(authConfig);

/**
 * Origin the client actually used to reach us.
 *
 * next-auth rewrites `req.url` from `AUTH_URL`/`NEXTAUTH_URL` before this
 * callback runs (`reqWithEnvURL`), so a stale or dev-only value (e.g.
 * localhost) would leak into our redirects. The forwarded headers always
 * describe the host the browser requested (Vercel sets them), and we fall
 * back to `req.url` locally where they are absent — so redirects follow the
 * environment instead of a hardcoded origin.
 */
function requestOrigin(req: NextRequest): string {
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host");
  if (!host) return new URL(req.url).origin;
  const protocol =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  return `${protocol}://${host}`;
}

export default auth((req) => {
  const { pathname } = new URL(req.url);
  const user = req.auth?.user;
  // Machine-to-machine endpoints. The Telegram webhook cannot carry a session —
  // it authenticates with its own shared secret inside the route handler, so it
  // MUST stay reachable here or Telegram deliveries get a login redirect.
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/telegram");

  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, requestOrigin(req)));

  // Unauthenticated → login page (except public routes).
  if (!user && !isPublic) {
    const loginUrl = new URL("/login", requestOrigin(req));
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user) {
    const home = ROLE_HOME[user.role] ?? "/";

    // Authenticated users never see the login page.
    if (pathname === "/login") return redirectTo(home);

    // Admin-only areas.
    if (matchPrefix(pathname, ADMIN_PREFIXES) && user.role === "PARTNER") {
      return redirectTo(ROLE_HOME.PARTNER);
    }

    // Partner-only areas.
    if (matchPrefix(pathname, PARTNER_PREFIXES) && user.role !== "PARTNER") {
      return redirectTo(home);
    }

    // Root → role home.
    if (pathname === "/") return redirectTo(home);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico)).*)",
  ],
};

