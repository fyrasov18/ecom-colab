import { redirect } from "next/navigation";
import type { Prisma, PrismaClient, Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";
import { getSetting } from "@/modules/settings/service";
import { SETTING_KEYS } from "@/modules/settings/defaults";

export type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Granular application permissions decoupled from roles.
 */
export const PERMISSIONS = {
  MANAGE_CONTRIBUTION_SETTINGS: "MANAGE_CONTRIBUTION_SETTINGS",
  MANAGE_PLATFORM_BRANDING: "MANAGE_PLATFORM_BRANDING",
  MANAGE_PARTNER_BRANDING: "MANAGE_PARTNER_BRANDING",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Explicit role-based default permission policy.
 * - SUPER_ADMIN receives all management permissions by default.
 * - ADMIN receives partner branding management by default; platform branding must be explicitly granted.
 * - PARTNER has no admin capabilities.
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: [
    PERMISSIONS.MANAGE_CONTRIBUTION_SETTINGS,
    PERMISSIONS.MANAGE_PLATFORM_BRANDING,
    PERMISSIONS.MANAGE_PARTNER_BRANDING,
  ],
  ADMIN: [PERMISSIONS.MANAGE_PARTNER_BRANDING],
  PARTNER: [],
};

/**
 * Resolves whether a user possesses a specific permission.
 * Evaluates:
 * 1. Default role policy.
 * 2. Explicit administrative grants stored in SystemSetting (permissions.admin_grants).
 */
export async function hasPermission(
  user: { id: string; role: Role },
  permission: Permission,
  db: DbClient = prisma,
): Promise<boolean> {
  // 1. Role default policy
  if (ROLE_DEFAULT_PERMISSIONS[user.role]?.includes(permission)) {
    return true;
  }

  // 2. Only active ADMINs can receive delegated administrative permissions
  if (user.role !== "ADMIN") {
    return false;
  }

  // 3. Explicit per-user grants from settings
  try {
    const grants = await getSetting<Record<string, string[]>>(
      SETTING_KEYS.ADMIN_PERMISSION_GRANTS as never,
      db,
    );
    const userGrants = grants?.[user.id];
    return Array.isArray(userGrants) && userGrants.includes(permission);
  } catch {
    return false;
  }
}

export class PermissionError extends Error {
  constructor(permission: Permission) {
    super(`Action non autorisée : permission ${permission} requise.`);
    this.name = "PermissionError";
  }
}

/**
 * Server-side gatekeeper: authenticates user and enforces the required permission.
 * Throws PermissionError if user lacks permission.
 */
export async function requirePermission(
  permission: Permission,
  db: DbClient = prisma,
): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as SessionUser;

  const allowed = await hasPermission(user, permission, db);
  if (!allowed) {
    throw new PermissionError(permission);
  }

  return user;
}
