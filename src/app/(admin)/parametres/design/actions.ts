"use server";

import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import {
  getPlatformBranding,
  resetDashboardDesign,
  resetPlatformBranding,
  updateDashboardDesign,
  updatePlatformBranding,
} from "@/modules/branding/service";
import { saveLogoUpload } from "@/modules/branding/storage";
import {
  dashboardDesignSchema,
  type DashboardDesignInput,
} from "@/modules/branding/schemas";

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string };

/**
 * Updates platform-level branding information (names, logos, favicon).
 */
export async function savePlatformBrandingAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requirePermission(PERMISSIONS.MANAGE_PLATFORM_BRANDING);
    const current = await getPlatformBranding();

    const platformName = (formData.get("platformName") as string)?.trim() || current.platformName;
    const platformTagline = (formData.get("platformTagline") as string)?.trim() ?? "";
    const platformDescription = (formData.get("platformDescription") as string)?.trim() ?? "";

    // Existing or directly specified URLs
    let logoLightUrl: string | null = (formData.get("logoLightUrl") as string)?.trim() || null;
    let logoDarkUrl: string | null = (formData.get("logoDarkUrl") as string)?.trim() || null;
    let logoMarkUrl: string | null = (formData.get("logoMarkUrl") as string)?.trim() || null;
    let faviconUrl: string | null = (formData.get("faviconUrl") as string)?.trim() || null;

    // Handle uploaded files
    const lightFile = formData.get("logoLightFile") as File | null;
    if (lightFile && lightFile.size > 0) {
      const res = await saveLogoUpload(lightFile, { subdir: "platform" });
      logoLightUrl = res.url;
    }

    const darkFile = formData.get("logoDarkFile") as File | null;
    if (darkFile && darkFile.size > 0) {
      const res = await saveLogoUpload(darkFile, { subdir: "platform" });
      logoDarkUrl = res.url;
    }

    const markFile = formData.get("logoMarkFile") as File | null;
    if (markFile && markFile.size > 0) {
      const res = await saveLogoUpload(markFile, { subdir: "platform" });
      logoMarkUrl = res.url;
    }

    const favFile = formData.get("faviconFile") as File | null;
    if (favFile && favFile.size > 0) {
      const res = await saveLogoUpload(favFile, { subdir: "platform", isFavicon: true });
      faviconUrl = res.url;
    }

    const updated = await updatePlatformBranding(
      {
        platformName,
        platformTagline,
        platformDescription,
        logoLightUrl,
        logoDarkUrl,
        logoMarkUrl,
        faviconUrl,
      },
      user.id,
    );

    return {
      ok: true,
      data: updated,
      message: "Identité de la plateforme mise à jour avec succès.",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur lors de l'enregistrement de l'identité.";
    return { ok: false, error: message };
  }
}

/**
 * Updates dashboard visual theme settings (colors, theme, radius).
 */
export async function saveDashboardDesignAction(
  input: DashboardDesignInput,
): Promise<ActionResult> {
  try {
    const user = await requirePermission(PERMISSIONS.MANAGE_PLATFORM_BRANDING);
    const validated = dashboardDesignSchema.parse(input);
    const updated = await updateDashboardDesign(validated, user.id);

    return {
      ok: true,
      data: updated,
      message: "Design du tableau de bord mis à jour avec succès.",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur lors de la mise à jour du design.";
    return { ok: false, error: message };
  }
}

/**
 * Resets platform identity back to system defaults.
 */
export async function resetPlatformBrandingAction(): Promise<ActionResult> {
  try {
    const user = await requirePermission(PERMISSIONS.MANAGE_PLATFORM_BRANDING);
    const res = await resetPlatformBranding(user.id);
    return {
      ok: true,
      data: res,
      message: "Identité de marque réinitialisée aux paramètres d'usine.",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur lors de la réinitialisation.";
    return { ok: false, error: message };
  }
}

/**
 * Resets dashboard visual design back to system defaults.
 */
export async function resetDashboardDesignAction(): Promise<ActionResult> {
  try {
    const user = await requirePermission(PERMISSIONS.MANAGE_PLATFORM_BRANDING);
    const res = await resetDashboardDesign(user.id);
    return {
      ok: true,
      data: res,
      message: "Thème et design réinitialisés aux paramètres d'usine.",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur lors de la réinitialisation.";
    return { ok: false, error: message };
  }
}
