import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Role, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";
import { getSetting } from "@/modules/settings/service";
import { SETTING_KEYS } from "@/modules/settings/defaults";
import { PERMISSIONS, type Permission } from "@/lib/permissions";

export type AdminUserItem = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  permissions: Permission[];
  isLastSuperAdmin: boolean;
};

export const createAdminSchema = z.object({
  firstName: z.string().trim().min(2, "Le prénom est obligatoire (min 2 caractères).").max(50),
  lastName: z.string().trim().min(2, "Le nom est obligatoire (min 2 caractères).").max(50),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide."),
  password: z
    .string()
    .min(8, "Le mot de passe doit comporter au moins 8 caractères.")
    .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une lettre majuscule.")
    .regex(/[a-z]/, "Le mot de passe doit contenir au moins une lettre minuscule.")
    .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre."),
  role: z.enum(["SUPER_ADMIN", "ADMIN"]),
  permissions: z.array(z.string()).optional().default([]),
});

export const updateAdminSchema = z.object({
  adminId: z.string().min(1),
  firstName: z.string().trim().min(2, "Le prénom est obligatoire (min 2 caractères).").max(50),
  lastName: z.string().trim().min(2, "Le nom est obligatoire (min 2 caractères).").max(50),
  role: z.enum(["SUPER_ADMIN", "ADMIN"]),
  status: z.enum(["ACTIVE", "DISABLED"]),
  permissions: z.array(z.string()).optional().default([]),
});

/**
 * List all administrator accounts and compute their effective permissions.
 */
export async function listAdministrators(): Promise<{
  admins: AdminUserItem[];
  activeSuperAdminCount: number;
}> {
  const users = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] } },
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
  });

  const grants: Record<string, string[]> = await getSetting<Record<string, string[]>>(
    SETTING_KEYS.ADMIN_PERMISSION_GRANTS as never,
  ).catch(() => ({}));

  const activeSuperAdminCount = users.filter(
    (u) => u.role === "SUPER_ADMIN" && u.status === "ACTIVE",
  ).length;

  const admins: AdminUserItem[] = users.map((u) => {
    const isSuperAdmin = u.role === "SUPER_ADMIN";
    const userPermissions = isSuperAdmin
      ? (Object.values(PERMISSIONS) as Permission[])
      : ((grants?.[u.id] ?? []) as Permission[]);

    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt.toISOString(),
      permissions: userPermissions,
      isLastSuperAdmin: isSuperAdmin && u.status === "ACTIVE" && activeSuperAdminCount <= 1,
    };
  });

  return { admins, activeSuperAdminCount };
}

/**
 * Create a new administrator account (Super Admin only).
 */
export async function createAdministrator(
  actorId: string,
  rawInput: unknown,
): Promise<{ id: string; email: string }> {
  const parsed = createAdminSchema.parse(rawInput);

  // Check email uniqueness
  const existing = await prisma.user.findUnique({
    where: { email: parsed.email },
  });
  if (existing) {
    throw new Error("Un compte existe déjà avec cette adresse e-mail.");
  }

  const passwordHash = await bcrypt.hash(parsed.password, 12);

  return prisma.$transaction(async (tx) => {
    // 1. Create User
    const newUser = await tx.user.create({
      data: {
        email: parsed.email,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        passwordHash,
        role: parsed.role,
        status: "ACTIVE",
      },
    });

    // 2. If limited Admin, save granular permissions in system setting
    if (parsed.role === "ADMIN" && parsed.permissions.length > 0) {
      const grantsSetting = await tx.systemSetting.findUnique({
        where: { key: SETTING_KEYS.ADMIN_PERMISSION_GRANTS },
      });
      const currentGrants = (grantsSetting?.value as Record<string, string[]>) ?? {};
      currentGrants[newUser.id] = parsed.permissions;

      await tx.systemSetting.upsert({
        where: { key: SETTING_KEYS.ADMIN_PERMISSION_GRANTS },
        create: {
          key: SETTING_KEYS.ADMIN_PERMISSION_GRANTS,
          value: currentGrants,
          category: "security",
          description: "Assignation granulaire des permissions administratives par utilisateur.",
          updatedById: actorId,
        },
        update: {
          value: currentGrants,
          updatedById: actorId,
        },
      });
    }

    // 3. Audit log
    await recordAudit(tx, {
      actorId,
      action: "ADMIN_USER_CREATED",
      entityType: "User",
      entityId: newUser.id,
      after: {
        email: newUser.email,
        role: newUser.role,
        permissions: parsed.permissions,
      },
    });

    return { id: newUser.id, email: newUser.email };
  });
}

/**
 * Update administrator profile, role, status and permissions (Super Admin only).
 */
export async function updateAdministrator(
  actorId: string,
  rawInput: unknown,
): Promise<{ success: boolean; message: string }> {
  const parsed = updateAdminSchema.parse(rawInput);

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUniqueOrThrow({
      where: { id: parsed.adminId },
    });

    // Protection of the last active Super Admin
    if (target.role === "SUPER_ADMIN" && target.status === "ACTIVE") {
      const activeSuperAdmins = await tx.user.count({
        where: { role: "SUPER_ADMIN", status: "ACTIVE" },
      });

      if (activeSuperAdmins <= 1) {
        if (parsed.role !== "SUPER_ADMIN") {
          throw new Error("Impossible de rétrograder le dernier Super Admin actif de la plateforme.");
        }
        if (parsed.status !== "ACTIVE") {
          throw new Error("Impossible de désactiver le dernier Super Admin actif de la plateforme.");
        }
      }
    }

    const before = {
      firstName: target.firstName,
      lastName: target.lastName,
      role: target.role,
      status: target.status,
    };

    // 1. Update user record
    await tx.user.update({
      where: { id: target.id },
      data: {
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        role: parsed.role,
        status: parsed.status,
      },
    });

    // 2. Update permissions grants
    const grantsSetting = await tx.systemSetting.findUnique({
      where: { key: SETTING_KEYS.ADMIN_PERMISSION_GRANTS },
    });
    const currentGrants = (grantsSetting?.value as Record<string, string[]>) ?? {};

    if (parsed.role === "ADMIN") {
      currentGrants[target.id] = parsed.permissions;
    } else {
      // Super Admin has all permissions by default; remove redundant individual grants
      delete currentGrants[target.id];
    }

    await tx.systemSetting.upsert({
      where: { key: SETTING_KEYS.ADMIN_PERMISSION_GRANTS },
      create: {
        key: SETTING_KEYS.ADMIN_PERMISSION_GRANTS,
        value: currentGrants,
        category: "security",
        description: "Assignation granulaire des permissions administratives par utilisateur.",
        updatedById: actorId,
      },
      update: {
        value: currentGrants,
        updatedById: actorId,
      },
    });

    // 3. Audit log
    await recordAudit(tx, {
      actorId,
      action: "ADMIN_USER_UPDATED",
      entityType: "User",
      entityId: target.id,
      before,
      after: {
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        role: parsed.role,
        status: parsed.status,
        permissions: parsed.permissions,
      },
    });

    return { success: true, message: "Administrateur mis à jour avec succès." };
  });
}

/**
 * Toggle admin status between ACTIVE and DISABLED (Super Admin only).
 */
export async function toggleAdminStatus(
  actorId: string,
  adminId: string,
  newStatus: "ACTIVE" | "DISABLED",
): Promise<{ success: boolean; message: string }> {
  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUniqueOrThrow({
      where: { id: adminId },
    });

    if (newStatus === "DISABLED" && target.role === "SUPER_ADMIN" && target.status === "ACTIVE") {
      const activeSuperAdmins = await tx.user.count({
        where: { role: "SUPER_ADMIN", status: "ACTIVE" },
      });
      if (activeSuperAdmins <= 1) {
        throw new Error("Impossible de désactiver le dernier Super Admin actif de la plateforme.");
      }
    }

    await tx.user.update({
      where: { id: adminId },
      data: { status: newStatus },
    });

    await recordAudit(tx, {
      actorId,
      action: "ADMIN_STATUS_CHANGED",
      entityType: "User",
      entityId: adminId,
      before: { status: target.status },
      after: { status: newStatus },
    });

    const statusMsg = newStatus === "ACTIVE" ? "activé" : "suspendu";
    return { success: true, message: `Le compte administrateur a été ${statusMsg}.` };
  });
}

/**
 * Reset password for an administrator account (Super Admin only).
 */
export async function resetAdminPassword(
  actorId: string,
  adminId: string,
  newPassword: string,
): Promise<{ success: boolean; message: string }> {
  if (newPassword.length < 8) {
    throw new Error("Le mot de passe doit comporter au moins 8 caractères.");
  }
  if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    throw new Error("Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: adminId },
      data: { passwordHash },
    });

    await recordAudit(tx, {
      actorId,
      action: "ADMIN_PASSWORD_RESET",
      entityType: "User",
      entityId: adminId,
      after: { resetAt: new Date().toISOString() },
    });
  });

  return { success: true, message: "Le mot de passe de l'administrateur a été réinitialisé." };
}
