import { describe, expect, it } from "vitest";
import { authConfig } from "@/lib/auth-config";

/**
 * `src/lib/auth-config.ts` is the single source of truth shared by middleware
 * and the server runtime: session lifetime plus the JWT ⇄ session claim mapping
 * that RBAC redirects and the header identity rely on. These tests pin that
 * contract so a change here cannot silently weaken it.
 */
const callbacks = authConfig.callbacks as unknown as {
  jwt: (args: {
    token: Record<string, unknown>;
    user?: Record<string, unknown>;
  }) => Promise<Record<string, unknown>>;
  session: (args: {
    session: { user?: Record<string, unknown> };
    token: Record<string, unknown>;
  }) => Promise<{ user?: Record<string, unknown> }>;
};

const TWELVE_HOURS = 12 * 60 * 60;

describe("auth session configuration", () => {
  it("uses stateless JWT sessions", () => {
    expect(authConfig.session.strategy).toBe("jwt");
  });

  it("bounds the session lifetime to 12 h with a 1 h sliding refresh", () => {
    expect(authConfig.session.maxAge).toBe(TWELVE_HOURS);
    expect(authConfig.session.updateAge).toBe(60 * 60);
  });

  it("refreshes more often than it expires", () => {
    expect(authConfig.session.updateAge).toBeLessThan(authConfig.session.maxAge);
  });

  it("sends unauthenticated visitors to /login", () => {
    expect(authConfig.pages.signIn).toBe("/login");
  });

  it("stays edge-safe: the shared config declares no providers", () => {
    // Providers (Credentials → Prisma/bcrypt) are added in lib/auth.ts only, so
    // middleware can import this file without pulling in Node-only code.
    expect(authConfig.providers).toEqual([]);
  });
});

describe("auth claim mapping", () => {
  const partnerUser = {
    id: "user_1",
    role: "PARTNER",
    partnerId: "partner_1",
    firstName: "Nour",
    lastName: "Ben Salah",
  };

  it("copies the identity claims onto the JWT at sign-in", async () => {
    const token = await callbacks.jwt({ token: {}, user: partnerUser });
    expect(token).toMatchObject(partnerUser);
  });

  it("defaults partnerId to null for back-office users", async () => {
    const token = await callbacks.jwt({
      token: {},
      user: { id: "user_2", role: "ADMIN", firstName: "Équipe", lastName: "Ops" },
    });
    expect(token.partnerId).toBeNull();
    expect(token.role).toBe("ADMIN");
  });

  it("keeps the existing claims on later requests (no user argument)", async () => {
    const token = await callbacks.jwt({
      token: {
        id: "user_2",
        role: "ADMIN",
        partnerId: null,
        firstName: "Équipe",
        lastName: "Ops",
      },
    });
    expect(token).toMatchObject({ id: "user_2", role: "ADMIN", partnerId: null });
  });

  it("exposes the claims on the session used by pages and layouts", async () => {
    const session = await callbacks.session({
      session: { user: {} },
      token: { ...partnerUser },
    });
    expect(session.user).toMatchObject(partnerUser);
  });

  it("tolerates a session payload without a user object", async () => {
    const session = await callbacks.session({ session: {}, token: { id: "user_1" } });
    expect(session.user).toBeUndefined();
  });
});
