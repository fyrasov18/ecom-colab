import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth-config";
import {
  ADMIN_PREFIXES,
  PARTNER_PREFIXES,
  ROLE_HOME,
  matchPrefix,
} from "@/lib/roles";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = new URL(req.url);
  const user = req.auth?.user;
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron");

  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, req.url));

  // Unauthenticated → login page (except public routes).
  if (!user && !isPublic) {
    const loginUrl = new URL("/login", req.url);
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

