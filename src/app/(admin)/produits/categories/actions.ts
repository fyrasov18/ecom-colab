"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import {
  createCategory,
  updateCategory,
  toggleCategoryActive,
  deleteCategory,
} from "@/modules/categories/service";
import { categoryInputSchema } from "@/modules/categories/schemas";

export type CategoryActionState = {
  ok: boolean;
  message?: string;
  error?: string;
};

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

function num(v: FormDataEntryValue | null, defaultValue = 0): number {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : defaultValue;
}

export async function saveCategoryAction(
  _prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const id = str(formData.get("id"));

  const raw = {
    name: str(formData.get("name")),
    nameAr: str(formData.get("nameAr")),
    description: str(formData.get("description")),
    icon: str(formData.get("icon")),
    imageUrl: str(formData.get("imageUrl")),
    displayOrder: num(formData.get("displayOrder"), 0),
    isActive: formData.get("isActive") === "true" || formData.get("isActive") === "on",
  };

  const parsed = categoryInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }

  try {
    if (id) {
      await updateCategory(id, parsed.data, user.id);
      revalidatePath("/produits/categories");
      revalidatePath("/produits");
      revalidatePath("/catalogue");
      return { ok: true, message: "Catégorie mise à jour avec succès." };
    }

    await createCategory(parsed.data, user.id);
    revalidatePath("/produits/categories");
    revalidatePath("/produits");
    revalidatePath("/catalogue");
    return { ok: true, message: "Catégorie créée avec succès." };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inattendue.";
    return { ok: false, error: msg };
  }
}

export async function toggleCategoryActiveAction(formData: FormData): Promise<void> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const id = str(formData.get("id"));
  const isActive = formData.get("isActive") === "true";

  if (!id) return;

  await toggleCategoryActive(id, isActive, user.id);
  revalidatePath("/produits/categories");
  revalidatePath("/produits");
  revalidatePath("/catalogue");
}

export async function deleteCategoryAction(
  _prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const id = str(formData.get("id"));
  const reassignToCategoryId = str(formData.get("reassignToCategoryId")) || undefined;

  if (!id) {
    return { ok: false, error: "Identifiant de catégorie manquant." };
  }

  try {
    const result = await deleteCategory(id, user.id, { reassignToCategoryId });
    revalidatePath("/produits/categories");
    revalidatePath("/produits");
    revalidatePath("/catalogue");

    const reassignedMsg =
      result.reassignedProductsCount > 0
        ? ` (${result.reassignedProductsCount} produit(s) réaffecté(s))`
        : "";

    return {
      ok: true,
      message: `Catégorie supprimée avec succès${reassignedMsg}.`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur lors de la suppression.";
    return { ok: false, error: msg };
  }
}
