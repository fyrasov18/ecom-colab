"use server";

import { requireSession } from "@/lib/rbac";
import { getPartnerBranding, updatePartnerBranding } from "@/modules/branding/service";
import { saveLogoUpload } from "@/modules/branding/storage";
import type { ActionResult } from "@/app/(admin)/parametres/design/actions";

export async function savePartnerCompanyBrandingAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireSession(["PARTNER"]);
    if (!user.partnerId) {
      return { ok: false, error: "Identifiant partenaire introuvable dans la session." };
    }

    const current = await getPartnerBranding(user.partnerId);

    const companyName = (formData.get("companyName") as string)?.trim() || null;
    const companyDescription = (formData.get("companyDescription") as string)?.trim() || null;
    const brandColorPrimary = (formData.get("brandColorPrimary") as string)?.trim() || null;
    const brandColorSecondary = (formData.get("brandColorSecondary") as string)?.trim() || null;
    const supportEmail = (formData.get("supportEmail") as string)?.trim() || null;
    const supportPhone = (formData.get("supportPhone") as string)?.trim() || null;
    const websiteUrl = (formData.get("websiteUrl") as string)?.trim() || null;

    let companyLogoUrl: string | null = (formData.get("companyLogoUrl") as string)?.trim() || current?.companyLogoUrl || null;
    let companyLogoDarkUrl: string | null = (formData.get("companyLogoDarkUrl") as string)?.trim() || current?.companyLogoDarkUrl || null;
    let companyMarkUrl: string | null = (formData.get("companyMarkUrl") as string)?.trim() || current?.companyMarkUrl || null;

    // Check if explicitly cleared
    if (formData.get("clearLogo") === "true") companyLogoUrl = null;
    if (formData.get("clearLogoDark") === "true") companyLogoDarkUrl = null;
    if (formData.get("clearMark") === "true") companyMarkUrl = null;

    // Handle uploaded files
    const logoFile = formData.get("companyLogoFile") as File | null;
    if (logoFile && logoFile.size > 0) {
      const res = await saveLogoUpload(logoFile, { subdir: "partners" });
      companyLogoUrl = res.url;
    }

    const logoDarkFile = formData.get("companyLogoDarkFile") as File | null;
    if (logoDarkFile && logoDarkFile.size > 0) {
      const res = await saveLogoUpload(logoDarkFile, { subdir: "partners" });
      companyLogoDarkUrl = res.url;
    }

    const markFile = formData.get("companyMarkFile") as File | null;
    if (markFile && markFile.size > 0) {
      const res = await saveLogoUpload(markFile, { subdir: "partners" });
      companyMarkUrl = res.url;
    }

    const updated = await updatePartnerBranding(
      user.partnerId,
      {
        companyName,
        companyLogoUrl,
        companyLogoDarkUrl,
        companyMarkUrl,
        brandColorPrimary,
        brandColorSecondary,
        companyDescription,
        supportEmail,
        supportPhone,
        websiteUrl,
      },
      user.id,
    );

    return {
      ok: true,
      data: updated,
      message: "Identité de votre entreprise enregistrée avec succès.",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur lors de l'enregistrement.";
    return { ok: false, error: message };
  }
}
