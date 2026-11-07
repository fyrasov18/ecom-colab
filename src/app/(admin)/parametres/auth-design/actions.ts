"use server";

import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import {
  getAuthPagesDesign,
  resetAuthPagesDesign,
  updateAuthPagesDesign,
} from "@/modules/branding/service";
import { saveLogoUpload } from "@/modules/branding/storage";
import {
  authPagesDesignSchema,
  type AuthPagesDesignInput,
} from "@/modules/branding/auth-design-schemas";

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string };

/**
 * Updates authentication pages design, colors, marketing copy and layout configuration.
 */
export async function saveAuthPagesDesignAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requirePermission(PERMISSIONS.MANAGE_PLATFORM_BRANDING);
    const current = await getAuthPagesDesign();

    let logoLightUrl: string | null = (formData.get("logoLightUrl") as string)?.trim() || null;
    let logoDarkUrl: string | null = (formData.get("logoDarkUrl") as string)?.trim() || null;
    let logoMarkUrl: string | null = (formData.get("logoMarkUrl") as string)?.trim() || null;

    // Handle file uploads if provided
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

    // Extract colors
    const primaryColor = (formData.get("primaryColor") as string)?.trim() || current.colors.primaryColor;
    const accentColor = (formData.get("accentColor") as string)?.trim() || current.colors.accentColor;
    const buttonBg = (formData.get("buttonBg") as string)?.trim() || current.colors.buttonBg;
    const buttonText = (formData.get("buttonText") as string)?.trim() || current.colors.buttonText;
    const marketingBg = (formData.get("marketingBg") as string)?.trim() || current.colors.marketingBg;

    // Extract layout flags
    const showMarketingPanel = formData.get("showMarketingPanel") === "true";
    const showFeatureCards = formData.get("showFeatureCards") === "true";
    const showTrustBadges = formData.get("showTrustBadges") === "true";
    const showPlatformMockup = formData.get("showPlatformMockup") === "true";

    // Extract JSON localized content or parse individual fields
    const contentJson = formData.get("contentJson") as string | null;
    let content = current.content;
    if (contentJson) {
      try {
        content = JSON.parse(contentJson);
      } catch {
        // Fallback to current content if parse fails
      }
    }

    const rawInput: AuthPagesDesignInput = {
      branding: {
        logoLightUrl,
        logoDarkUrl,
        logoMarkUrl,
      },
      colors: {
        primaryColor,
        accentColor,
        buttonBg,
        buttonText,
        marketingBg,
      },
      layout: {
        showMarketingPanel,
        showFeatureCards,
        showTrustBadges,
        showPlatformMockup,
      },
      content,
    };

    const validated = authPagesDesignSchema.parse(rawInput);
    const updated = await updateAuthPagesDesign(validated, user.id);

    return {
      ok: true,
      data: updated,
      message: "Design des pages d'authentification enregistré avec succès.",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur inattendue lors de la sauvegarde.",
    };
  }
}

/**
 * Resets authentication pages design to factory defaults.
 */
export async function resetAuthPagesDesignAction(): Promise<ActionResult> {
  try {
    const user = await requirePermission(PERMISSIONS.MANAGE_PLATFORM_BRANDING);
    const result = await resetAuthPagesDesign(user.id);

    return {
      ok: true,
      data: result,
      message: "Design réinitialisé aux valeurs par défaut.",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur inattendue lors de la réinitialisation.",
    };
  }
}
