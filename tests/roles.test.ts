import { describe, expect, it } from "vitest";
import {
  ADMIN_PREFIXES,
  ALL_ROLES,
  PARTNER_PREFIXES,
  ROLE_HOME,
  isAdminRole,
  matchPrefix,
} from "@/lib/roles";

describe("RBAC role helpers", () => {
  it("recognizes admin roles", () => {
    expect(isAdminRole("SUPER_ADMIN")).toBe(true);
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("PARTNER")).toBe(false);
  });

  it("maps every role to a home route", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_HOME[role]).toBeTruthy();
    }
    expect(ROLE_HOME.PARTNER).toBe("/tableau-de-bord");
    expect(ROLE_HOME.ADMIN).toBe("/dashboard");
  });

  it("matches route prefixes exactly (no false positives)", () => {
    expect(matchPrefix("/dashboard", ADMIN_PREFIXES)).toBe(true);
    expect(matchPrefix("/dashboard/toto", ADMIN_PREFIXES)).toBe(true);
    expect(matchPrefix("/tableau-de-bord", ADMIN_PREFIXES)).toBe(false);
    // /mes-commandes must not collide with /commandes
    expect(matchPrefix("/mes-commandes", ADMIN_PREFIXES)).toBe(false);
    expect(matchPrefix("/mes-commandes", PARTNER_PREFIXES)).toBe(true);
    expect(matchPrefix("/commandes", PARTNER_PREFIXES)).toBe(false);
  });

  it("admin and partner route namespaces never overlap", () => {
    for (const p of PARTNER_PREFIXES) {
      expect(matchPrefix(p, ADMIN_PREFIXES)).toBe(false);
    }
    for (const a of ADMIN_PREFIXES) {
      expect(matchPrefix(a, PARTNER_PREFIXES)).toBe(false);
    }
  });
});
