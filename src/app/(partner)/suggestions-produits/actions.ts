"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { saveUpload } from "@/lib/storage";
import { createSuggestion } from "@/modules/suggestions/service";
import { suggestionSubmissionSchema } from "@/modules/suggestions/schemas";

export type SuggestionActionState = {
  ok: boolean;
  message?: string;
  error?: string;
  suggestionId?: string;
};

export async function submitSuggestionAction(
  _prev?: SuggestionActionState | null,
  formData?: FormData,
): Promise<SuggestionActionState> {
  const user = await requireSession(["PARTNER"]);
  if (!user.partnerId) {
    return { ok: false, error: "Compte partenaire introuvable ou non rattaché." };
  }

  try {
    const form = formData ?? new FormData();

    // 1. Handle primary image upload or fallback URL
    let imageUrl = String(form.get("imageUrl") ?? "").trim();
    const imageFile = form.get("imageFile");

    if (imageFile instanceof File && imageFile.size > 0) {
      try {
        const uploadRes = await saveUpload(imageFile, {
          subdir: "suggestions",
          kind: "image",
        });
        imageUrl = uploadRes.url;
      } catch (uploadErr) {
        return {
          ok: false,
          error:
            uploadErr instanceof Error
              ? `Erreur de téléversement : ${uploadErr.message}`
              : "Erreur lors du téléversement de l'image.",
        };
      }
    }

    if (!imageUrl) {
      return { ok: false, error: "Une image du produit est obligatoire (fichier ou URL)." };
    }

    // 2. Handle secondary/additional images if uploaded
    const additionalImages: string[] = [];
    const additionalFiles = form.getAll("additionalImageFiles");
    for (const file of additionalFiles) {
      if (file instanceof File && file.size > 0) {
        try {
          const res = await saveUpload(file, { subdir: "suggestions", kind: "image" });
          additionalImages.push(res.url);
        } catch {
          // Skip corrupt or invalid auxiliary image without blocking the main submission
        }
      }
    }

    const additionalUrlsRaw = form.getAll("images").map(String).filter(Boolean);
    const combinedImages = Array.from(new Set([...additionalImages, ...additionalUrlsRaw]));

    // 3. Assemble and parse input
    const rawInput = {
      name: String(form.get("name") ?? "").trim(),
      estimatedSellingPrice: form.get("estimatedSellingPrice"),
      imageUrl,
      images: combinedImages,
      description: String(form.get("description") ?? "").trim() || undefined,
      estimatedPurchasePrice: form.get("estimatedPurchasePrice")
        ? Number(form.get("estimatedPurchasePrice"))
        : undefined,
      supplierName: String(form.get("supplierName") ?? "").trim() || undefined,
      supplierContact: String(form.get("supplierContact") ?? "").trim() || undefined,
      supplierUrl: String(form.get("supplierUrl") ?? "").trim() || undefined,
      characteristics: String(form.get("characteristics") ?? "").trim() || undefined,
      targetAudience: String(form.get("targetAudience") ?? "").trim() || undefined,
      partnerReason: String(form.get("partnerReason") ?? "").trim() || undefined,
      additionalNotes: String(form.get("additionalNotes") ?? "").trim() || undefined,
    };

    const validated = suggestionSubmissionSchema.parse(rawInput);

    const suggestion = await createSuggestion(user.partnerId, validated);

    revalidatePath("/suggestions-produits");
    revalidatePath("/tableau-de-bord");

    return {
      ok: true,
      message: `Votre suggestion « ${suggestion.name} » a été soumise avec succès !`,
      suggestionId: suggestion.id,
    };
  } catch (err) {
    if (err && typeof err === "object" && "issues" in err) {
      const z = err as { issues: { message: string }[] };
      return { ok: false, error: z.issues[0]?.message ?? "Données invalides." };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors de la soumission de la suggestion.",
    };
  }
}
