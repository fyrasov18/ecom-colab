"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import {
  archiveAnnouncement,
  createAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  updateAnnouncement,
  updateLevelUpNotificationSettings,
  updateWelcomeNotificationSettings,
} from "@/modules/announcements/service";
import {
  announcementInputSchema,
  levelUpSettingsSchema,
  welcomeSettingsSchema,
} from "@/modules/announcements/schemas";

export type AdminAnnouncementActionState = {
  ok: boolean;
  message?: string;
  error?: string;
};

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

export async function saveWelcomeSettingsAction(
  _prev: AdminAnnouncementActionState,
  formData: FormData,
): Promise<AdminAnnouncementActionState> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);

  const raw = {
    isEnabled: formData.get("isEnabled") === "true" || formData.get("isEnabled") === "on",
    title: str(formData.get("title")),
    message: str(formData.get("message")),
    buttonText: str(formData.get("buttonText")),
    buttonUrl: str(formData.get("buttonUrl")),
    badgeText: str(formData.get("badgeText")),
    bannerText: str(formData.get("bannerText")) || undefined,
    imageUrl: str(formData.get("imageUrl")),
    themeColor: str(formData.get("themeColor")),
  };

  const parsed = welcomeSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }

  try {
    await updateWelcomeNotificationSettings(parsed.data, user.id);
    revalidatePath("/annonces");
    revalidatePath("/notifications");
    return { ok: true, message: "Paramètres de bienvenue enregistrés avec succès." };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inattendue.";
    return { ok: false, error: msg };
  }
}

export async function saveLevelUpSettingsAction(
  _prev: AdminAnnouncementActionState,
  formData: FormData,
): Promise<AdminAnnouncementActionState> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);

  const raw = {
    isEnabled: formData.get("isEnabled") === "true" || formData.get("isEnabled") === "on",
    title: str(formData.get("title")),
    message: str(formData.get("message")),
    buttonText: str(formData.get("buttonText")),
    buttonUrl: str(formData.get("buttonUrl")),
    imageUrl: str(formData.get("imageUrl")),
    themeColor: str(formData.get("themeColor")),
  };

  const parsed = levelUpSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }

  try {
    await updateLevelUpNotificationSettings(parsed.data, user.id);
    revalidatePath("/annonces");
    revalidatePath("/notifications");
    return { ok: true, message: "Paramètres de Level Up enregistrés avec succès." };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inattendue.";
    return { ok: false, error: msg };
  }
}

export async function saveAnnouncementAction(
  _prev: AdminAnnouncementActionState,
  formData: FormData,
): Promise<AdminAnnouncementActionState> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const id = str(formData.get("id"));

  const raw = {
    title: str(formData.get("title")),
    content: str(formData.get("content")),
    type: str(formData.get("type")),
    imageUrl: str(formData.get("imageUrl")),
    buttonText: str(formData.get("buttonText")),
    buttonUrl: str(formData.get("buttonUrl")),
    targetAudience: str(formData.get("targetAudience")),
    status: str(formData.get("status")),
    scheduledAt: str(formData.get("scheduledAt")),
    isFullScreen: formData.get("isFullScreen") === "true" || formData.get("isFullScreen") === "on",
  };

  const parsed = announcementInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }

  try {
    if (id) {
      await updateAnnouncement(id, parsed.data, user.id);
      revalidatePath("/annonces");
      return { ok: true, message: "Annonce mise à jour avec succès." };
    }

    await createAnnouncement(parsed.data, user.id);
    revalidatePath("/annonces");
    return { ok: true, message: "Annonce créée avec succès." };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur lors de l'enregistrement.";
    return { ok: false, error: msg };
  }
}

export async function publishAnnouncementAction(formData: FormData): Promise<void> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const id = str(formData.get("id"));
  if (!id) return;
  await publishAnnouncement(id, user.id);
  revalidatePath("/annonces");
}

export async function archiveAnnouncementAction(formData: FormData): Promise<void> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const id = str(formData.get("id"));
  if (!id) return;
  await archiveAnnouncement(id, user.id);
  revalidatePath("/annonces");
}

export async function deleteAnnouncementAction(formData: FormData): Promise<void> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const id = str(formData.get("id"));
  if (!id) return;
  await deleteAnnouncement(id, user.id);
  revalidatePath("/annonces");
}
