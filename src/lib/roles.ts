import type { Role } from "@prisma/client";

/** Pure role helpers — safe to import from middleware (no Prisma). */

export const ADMIN_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN"];
export const ALL_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "PARTNER"];

export const ROLE_HOME: Record<Role, string> = {
  SUPER_ADMIN: "/dashboard",
  ADMIN: "/dashboard",
  PARTNER: "/tableau-de-bord",
};

export function isAdminRole(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

/** Route prefixes reserved for admin/operations. */
export const ADMIN_PREFIXES = [
  "/dashboard",
  "/commandes",
  "/produits",
  "/partenaires",
  "/clients",
  "/logistique",
  "/finance",
  "/performances",
  "/marketing",
  "/notifications",
  "/parametres",
  "/audit",
] as const;

/** Route prefixes reserved for partners. */
export const PARTNER_PREFIXES = [
  "/tableau-de-bord",
  "/catalogue",
  "/nouvelle-commande",
  "/mes-commandes",
  "/mes-performances",
  "/portefeuille",
  "/mes-notifications",
] as const;

export function matchPrefix(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}
