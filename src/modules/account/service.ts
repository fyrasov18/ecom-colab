import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";

export type UserAccountDTO = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone: string;
  status: string;
  createdAt: string;
  partnerId: string | null;
};

export const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(2, "Le prénom doit comporter au moins 2 caractères.").max(50),
  lastName: z.string().trim().min(2, "Le nom doit comporter au moins 2 caractères.").max(50),
  phone: z.string().trim().max(30).optional().default(""),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Le mot de passe actuel est obligatoire."),
    newPassword: z
      .string()
      .min(8, "Le nouveau mot de passe doit comporter au moins 8 caractères.")
      .regex(/[A-Z]/, "Le nouveau mot de passe doit contenir au moins une lettre majuscule.")
      .regex(/[a-z]/, "Le nouveau mot de passe doit contenir au moins une lettre minuscule.")
      .regex(/[0-9]/, "Le nouveau mot de passe doit contenir au moins un chiffre."),
    confirmPassword: z.string().min(1, "La confirmation du mot de passe est obligatoire."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Le nouveau mot de passe et sa confirmation ne correspondent pas.",
    path: ["confirmPassword"],
  });

/**
 * Fetch personal profile data for the authenticated user.
 */
export async function getUserAccount(userId: string): Promise<UserAccountDTO | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { partner: true },
  });

  if (!user) return null;

  let phone = user.partner?.phone ?? "";

  // If user has no partner profile (e.g. admin), check stored profile phone
  if (!phone) {
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: `user.phone.${userId}` },
      });
      if (setting?.value && typeof setting.value === "string") {
        phone = setting.value;
      }
    } catch {
      // Fallback
    }
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    phone,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    partnerId: user.partner?.id ?? null,
  };
}

/**
 * Update personal profile information.
 * Notice: Email is strictly non-modifiable.
 */
export async function updateAccountProfile(
  userId: string,
  rawInput: unknown,
): Promise<{ success: boolean; message: string }> {
  const parsed = profileUpdateSchema.parse(rawInput);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      include: { partner: true },
    });

    const before = {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.partner?.phone ?? "",
    };

    // 1. Update user record (Email remains strictly unchanged)
    await tx.user.update({
      where: { id: userId },
      data: {
        firstName: parsed.firstName,
        lastName: parsed.lastName,
      },
    });

    // 2. If user is a partner, update partner profile & display name
    if (user.partner) {
      await tx.partner.update({
        where: { id: user.partner.id },
        data: {
          displayName: `${parsed.firstName} ${parsed.lastName}`.trim(),
          phone: parsed.phone || null,
        },
      });
    } else if (parsed.phone) {
      // 3. For admin users, store phone in system setting
      await tx.systemSetting.upsert({
        where: { key: `user.phone.${userId}` },
        create: {
          key: `user.phone.${userId}`,
          value: parsed.phone,
          category: "security",
          description: `Numéro de téléphone de l'administrateur ${parsed.firstName} ${parsed.lastName}`,
        },
        update: {
          value: parsed.phone,
        },
      });
    }

    // 4. Audit Log record
    await recordAudit(tx, {
      actorId: userId,
      action: "USER_PROFILE_UPDATED",
      entityType: "User",
      entityId: userId,
      before,
      after: {
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        phone: parsed.phone,
      },
    });
  });

  return { success: true, message: "Vos informations personnelles ont été mises à jour avec succès." };
}

/**
 * Change account password with current password verification and strength validation.
 */
export async function changeAccountPassword(
  userId: string,
  rawInput: unknown,
): Promise<{ success: boolean; message: string }> {
  const parsed = passwordChangeSchema.parse(rawInput);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
    });

    // 1. Verify current password
    const isCurrentValid = await bcrypt.compare(parsed.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new Error("Le mot de passe actuel est incorrect.");
    }

    // 2. Prevent setting the same password
    const isSamePassword = await bcrypt.compare(parsed.newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new Error("Le nouveau mot de passe doit être différent de l'actuel.");
    }

    // 3. Hash and store new password
    const newHash = await bcrypt.hash(parsed.newPassword, 12);
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // 4. Audit Log record
    await recordAudit(tx, {
      actorId: userId,
      action: "USER_PASSWORD_CHANGED",
      entityType: "User",
      entityId: userId,
      after: { changedAt: new Date().toISOString() },
    });
  });

  return { success: true, message: "Votre mot de passe a été modifié avec succès." };
}
