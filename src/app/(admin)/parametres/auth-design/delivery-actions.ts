"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import {
  addDeliveryPartner,
  deleteDeliveryPartner,
  getDeliveryPartnersConfig,
  reorderDeliveryPartners,
  updateDeliveryPartner,
  updateDeliveryPartnersConfig,
} from "@/modules/branding/delivery-partners-service";
import { saveLogoUpload, deleteLogoUpload } from "@/modules/branding/storage";

export type ActionResponse<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string };

function revalidateAuthPages() {
  try {
    revalidatePath("/login");
    revalidatePath("/register");
    revalidatePath("/(auth)/login", "page");
    revalidatePath("/(auth)/register", "page");
    revalidatePath("/parametres/auth-design");
    revalidatePath("/(admin)/parametres/auth-design", "page");
  } catch {
    // Revalidation no-op in background/test contexts
  }
}

/**
 * Updates top-level section settings (enabled, titles, subtitles).
 */
export async function saveDeliveryPartnersSectionAction(
  formData: FormData,
): Promise<ActionResponse> {
  try {
    const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
    await requirePermission(PERMISSIONS.MANAGE_PLATFORM_BRANDING);

    const enabled = formData.get("enabled") === "true";
    const titleFr = String(formData.get("title_fr") || "").trim();
    const titleAr = String(formData.get("title_ar") || "").trim();
    const titleEn = String(formData.get("title_en") || "").trim();

    const subtitleFr = String(formData.get("subtitle_fr") || "").trim();
    const subtitleAr = String(formData.get("subtitle_ar") || "").trim();
    const subtitleEn = String(formData.get("subtitle_en") || "").trim();

    await updateDeliveryPartnersConfig(
      {
        enabled,
        title: {
          fr: titleFr || undefined,
          ar: titleAr || undefined,
          en: titleEn || undefined,
        },
        subtitle: {
          fr: subtitleFr,
          ar: subtitleAr,
          en: subtitleEn,
        },
      },
      user.id,
    );

    revalidateAuthPages();
    return { ok: true, data: null, message: "Section partenaires de livraison mise à jour." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors de la mise à jour de la section.",
    };
  }
}

/**
 * Adds a new delivery company entry with optional initial logo file.
 */
export async function addDeliveryPartnerAction(
  formData: FormData,
): Promise<ActionResponse> {
  try {
    const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
    await requirePermission(PERMISSIONS.MANAGE_PLATFORM_BRANDING);

    const name = String(formData.get("name") || "").trim();
    if (!name) {
      return { ok: false, error: "Le nom de la société de livraison est obligatoire." };
    }

    const displayOrder = Number(formData.get("displayOrder") || 0);
    const isActive = formData.get("isActive") !== "false";
    const websiteUrl = String(formData.get("websiteUrl") || "").trim() || null;

    let logoUrl: string | null = null;
    const logoFile = formData.get("logoFile");
    if (logoFile instanceof File && logoFile.size > 0) {
      const uploadRes = await saveLogoUpload(logoFile, { subdir: "delivery" });
      logoUrl = uploadRes.url;
    }

    const partner = await addDeliveryPartner(
      {
        name,
        displayOrder,
        isActive,
        websiteUrl,
        logoUrl,
      },
      user.id,
    );

    revalidateAuthPages();
    return { ok: true, data: partner, message: `Société "${name}" ajoutée avec succès.` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors de l'ajout du partenaire.",
    };
  }
}

/**
 * Updates a delivery partner entry (name, displayOrder, isActive, websiteUrl, optional new logo).
 */
export async function updateDeliveryPartnerAction(
  formData: FormData,
): Promise<ActionResponse> {
  try {
    const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
    await requirePermission(PERMISSIONS.MANAGE_PLATFORM_BRANDING);

    const id = String(formData.get("id") || "").trim();
    if (!id) {
      return { ok: false, error: "Identifiant du partenaire manquant." };
    }

    const name = String(formData.get("name") || "").trim();
    if (!name) {
      return { ok: false, error: "Le nom de la société de livraison est obligatoire." };
    }

    const displayOrder = Number(formData.get("displayOrder") || 0);
    const isActive = formData.get("isActive") === "true";
    const websiteUrl = String(formData.get("websiteUrl") || "").trim() || null;

    let logoUrl: string | undefined = undefined;
    const logoFile = formData.get("logoFile");
    if (logoFile instanceof File && logoFile.size > 0) {
      const uploadRes = await saveLogoUpload(logoFile, { subdir: "delivery" });
      logoUrl = uploadRes.url;

      // Clean up previous logo
      const current = await getDeliveryPartnersConfig();
      const existing = current.partners.find((p) => p.id === id);
      if (existing?.logoUrl && existing.logoUrl !== logoUrl) {
        await deleteLogoUpload(existing.logoUrl);
      }
    }

    const updated = await updateDeliveryPartner(
      id,
      {
        name,
        displayOrder,
        isActive,
        websiteUrl,
        ...(logoUrl !== undefined ? { logoUrl } : {}),
      },
      user.id,
    );

    revalidateAuthPages();
    return { ok: true, data: updated, message: `Société "${name}" mise à jour.` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors de la modification.",
    };
  }
}

/**
 * Toggles a delivery partner's active visibility state.
 */
export async function toggleDeliveryPartnerActiveAction(
  id: string,
  isActive: boolean,
): Promise<ActionResponse> {
  try {
    const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
    await requirePermission(PERMISSIONS.MANAGE_PLATFORM_BRANDING);

    const updated = await updateDeliveryPartner(id, { isActive }, user.id);
    revalidateAuthPages();
    return {
      ok: true,
      data: updated,
      message: updated.isActive
        ? `Visibilité activée pour "${updated.name}".`
        : `Visibilité désactivée pour "${updated.name}".`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors de la modification du statut.",
    };
  }
}

/**
 * Replaces a delivery company's logo image.
 */
export async function replaceDeliveryPartnerLogoAction(
  id: string,
  formData: FormData,
): Promise<ActionResponse> {
  try {
    const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
    await requirePermission(PERMISSIONS.MANAGE_PLATFORM_BRANDING);

    const file = formData.get("logoFile");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Veuillez sélectionner un fichier image valide." };
    }

    const current = await getDeliveryPartnersConfig();
    const existing = current.partners.find((p) => p.id === id);
    if (!existing) {
      return { ok: false, error: "Société de livraison introuvable." };
    }

    const uploadRes = await saveLogoUpload(file, { subdir: "delivery" });

    // Clean up old logo
    if (existing.logoUrl && existing.logoUrl !== uploadRes.url) {
      await deleteLogoUpload(existing.logoUrl);
    }

    const updated = await updateDeliveryPartner(id, { logoUrl: uploadRes.url }, user.id);
    revalidateAuthPages();
    return { ok: true, data: updated, message: "Logo remplacé avec succès." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors du remplacement du logo.",
    };
  }
}

/**
 * Removes a delivery company's logo image (reverts to typographic badge).
 */
export async function removeDeliveryPartnerLogoAction(
  id: string,
): Promise<ActionResponse> {
  try {
    const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
    await requirePermission(PERMISSIONS.MANAGE_PLATFORM_BRANDING);

    const current = await getDeliveryPartnersConfig();
    const existing = current.partners.find((p) => p.id === id);
    if (!existing) {
      return { ok: false, error: "Société de livraison introuvable." };
    }

    if (existing.logoUrl) {
      await deleteLogoUpload(existing.logoUrl);
    }

    const updated = await updateDeliveryPartner(id, { logoUrl: null }, user.id);
    revalidateAuthPages();
    return { ok: true, data: updated, message: "Logo supprimé." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors de la suppression du logo.",
    };
  }
}

/**
 * Deletes a delivery company from the registry.
 */
export async function deleteDeliveryPartnerAction(
  id: string,
): Promise<ActionResponse> {
  try {
    const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
    await requirePermission(PERMISSIONS.MANAGE_PLATFORM_BRANDING);

    await deleteDeliveryPartner(id, user.id);
    revalidateAuthPages();
    return { ok: true, data: null, message: "Société de livraison supprimée du registre." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors de la suppression.",
    };
  }
}

/**
 * Reorders the delivery companies.
 */
export async function reorderDeliveryPartnersAction(
  orderedIds: string[],
): Promise<ActionResponse> {
  try {
    const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
    await requirePermission(PERMISSIONS.MANAGE_PLATFORM_BRANDING);

    const reordered = await reorderDeliveryPartners(orderedIds, user.id);
    revalidateAuthPages();
    return { ok: true, data: reordered, message: "Ordre d'affichage mis à jour." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors du réordonnancement.",
    };
  }
}
