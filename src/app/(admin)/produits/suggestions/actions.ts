"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import {
  updateSuggestionStatus,
  linkSuggestionToProduct,
  createProductFromSuggestion,
} from "@/modules/suggestions/service";
import {
  suggestionStatusUpdateSchema,
  linkProductSuggestionSchema,
  createProductFromSuggestionSchema,
} from "@/modules/suggestions/schemas";

export type AdminSuggestionActionState = {
  ok: boolean;
  message?: string;
  error?: string;
  suggestionId?: string;
  productId?: string;
};

export async function updateSuggestionStatusAction(
  _prev?: AdminSuggestionActionState | null,
  formData?: FormData,
): Promise<AdminSuggestionActionState> {
  const user = await requireSession(["ADMIN", "SUPER_ADMIN"]);
  const allowed = await hasPermission(user, PERMISSIONS.MANAGE_PRODUCT_SUGGESTIONS);
  if (!allowed) {
    return { ok: false, error: "Vous n'avez pas la permission de gérer les suggestions de produits." };
  }

  try {
    const form = formData ?? new FormData();
    const suggestionId = String(form.get("suggestionId") ?? "").trim();
    if (!suggestionId) {
      return { ok: false, error: "Identifiant de suggestion requis." };
    }

    const raw = {
      status: form.get("status"),
      partnerFeedback: String(form.get("partnerFeedback") ?? "").trim() || undefined,
      internalNotes: String(form.get("internalNotes") ?? "").trim() || undefined,
    };

    const validated = suggestionStatusUpdateSchema.parse(raw);
    const updated = await updateSuggestionStatus(suggestionId, user, validated);

    revalidatePath("/produits/suggestions");
    revalidatePath(`/produits/suggestions/${suggestionId}`);
    revalidatePath("/suggestions-produits");

    return {
      ok: true,
      message: `Le statut de la suggestion « ${updated.name} » a été mis à jour avec succès.`,
      suggestionId: updated.id,
    };
  } catch (err) {
    if (err && typeof err === "object" && "issues" in err) {
      const z = err as { issues: { message: string }[] };
      return { ok: false, error: z.issues[0]?.message ?? "Données invalides." };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors de la mise à jour du statut.",
    };
  }
}

export async function linkSuggestionToProductAction(
  _prev?: AdminSuggestionActionState | null,
  formData?: FormData,
): Promise<AdminSuggestionActionState> {
  const user = await requireSession(["ADMIN", "SUPER_ADMIN"]);
  const allowed = await hasPermission(user, PERMISSIONS.MANAGE_PRODUCT_SUGGESTIONS);
  if (!allowed) {
    return { ok: false, error: "Vous n'avez pas la permission de lier une suggestion à un produit." };
  }

  try {
    const form = formData ?? new FormData();
    const raw = {
      suggestionId: String(form.get("suggestionId") ?? "").trim(),
      productId: String(form.get("productId") ?? "").trim(),
      internalNotes: String(form.get("internalNotes") ?? "").trim() || undefined,
    };

    const validated = linkProductSuggestionSchema.parse(raw);
    const res = await linkSuggestionToProduct(
      validated.suggestionId,
      validated.productId,
      user,
      validated.internalNotes,
    );

    revalidatePath("/produits/suggestions");
    revalidatePath(`/produits/suggestions/${validated.suggestionId}`);
    revalidatePath("/produits");
    revalidatePath("/suggestions-produits");

    return {
      ok: true,
      message: `La suggestion a été rattachée au produit « ${res.product.name} ».`,
      suggestionId: res.suggestion.id,
      productId: res.product.id,
    };
  } catch (err) {
    if (err && typeof err === "object" && "issues" in err) {
      const z = err as { issues: { message: string }[] };
      return { ok: false, error: z.issues[0]?.message ?? "Données invalides." };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors de la liaison du produit.",
    };
  }
}

export async function createProductFromSuggestionAction(
  _prev?: AdminSuggestionActionState | null,
  formData?: FormData,
): Promise<AdminSuggestionActionState> {
  const user = await requireSession(["ADMIN", "SUPER_ADMIN"]);
  const allowed = await hasPermission(user, PERMISSIONS.MANAGE_PRODUCT_SUGGESTIONS);
  if (!allowed) {
    return { ok: false, error: "Vous n'avez pas la permission de créer un produit depuis une suggestion." };
  }

  try {
    const form = formData ?? new FormData();
    const raw = {
      suggestionId: String(form.get("suggestionId") ?? "").trim(),
      name: String(form.get("name") ?? "").trim(),
      description: String(form.get("description") ?? "").trim() || undefined,
      purchaseCost: form.get("purchaseCost"),
      packagingCost: form.get("packagingCost") ? Number(form.get("packagingCost")) : 1,
      deliveryCost: form.get("deliveryCost") ? Number(form.get("deliveryCost")) : 7,
      sellingPrice: form.get("sellingPrice"),
      stockQuantity: form.get("stockQuantity") ? Number(form.get("stockQuantity")) : 10,
      lowStockThreshold: form.get("lowStockThreshold") ? Number(form.get("lowStockThreshold")) : 5,
      categoryId: String(form.get("categoryId") ?? "").trim() || null,
      isWinning: form.get("isWinning") === "true" || form.get("isWinning") === "on",
      isNew: form.get("isNew") === "true" || form.get("isNew") === "on",
      isRecommended: form.get("isRecommended") === "true" || form.get("isRecommended") === "on",
      autoAssignToPartner: form.get("autoAssignToPartner") !== "false",
      internalNotes: String(form.get("internalNotes") ?? "").trim() || undefined,
    };

    const validated = createProductFromSuggestionSchema.parse(raw);
    const res = await createProductFromSuggestion(validated.suggestionId, user, validated);

    revalidatePath("/produits/suggestions");
    revalidatePath(`/produits/suggestions/${validated.suggestionId}`);
    revalidatePath("/produits");
    revalidatePath("/catalogue");
    revalidatePath("/suggestions-produits");

    return {
      ok: true,
      message: `Le produit « ${res.product.name} » a été créé avec succès à partir de la suggestion !`,
      suggestionId: res.suggestion.id,
      productId: res.product.id,
    };
  } catch (err) {
    if (err && typeof err === "object" && "issues" in err) {
      const z = err as { issues: { message: string }[] };
      return { ok: false, error: z.issues[0]?.message ?? "Données invalides." };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors de la création du produit.",
    };
  }
}
