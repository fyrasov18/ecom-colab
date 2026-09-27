"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/rbac";
import {
  createProduct,
  setProductStatus,
  updateProduct,
} from "@/modules/products/service";
import { productStatusSchema } from "@/modules/products/schemas";
import {
  addProductMedia,
  createMarketingAsset,
  deleteMarketingAsset,
  deleteProductMedia,
} from "@/modules/marketing/service";
import { saveUpload } from "@/lib/storage";

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

function num(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : NaN;
}

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

function toInput(fd: FormData) {
  const commissionTypeRaw = str(fd.get("commissionType"));
  const commissionValueRaw = str(fd.get("commissionValue"));
  return {
    name: str(fd.get("name")),
    description: str(fd.get("description")),
    purchaseCost: num(fd.get("purchaseCost")),
    packagingCost: num(fd.get("packagingCost")),
    deliveryCost: num(fd.get("deliveryCost")),
    sellingPrice: num(fd.get("sellingPrice")),
    stockQuantity: str(fd.get("stockQuantity")),
    lowStockThreshold: str(fd.get("lowStockThreshold")),
    status: str(fd.get("status")),
    commissionType:
      commissionTypeRaw === ""
        ? null
        : z.enum(["PERCENTAGE", "FIXED"]).parse(commissionTypeRaw),
    commissionValue: commissionValueRaw === "" ? null : num(commissionValueRaw),
  };
}

export async function saveProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const id = str(formData.get("id"));

  const raw = toInput(formData);
  // Re-coerce numbers that schemas expect as numbers (form sends strings).
  const input = {
    ...raw,
    stockQuantity: Number(raw.stockQuantity),
    lowStockThreshold: Number(raw.lowStockThreshold),
    status: productStatusSchema.parse(raw.status),
  };

  try {
    if (id) {
      await updateProduct(id, input, user.id);
      revalidatePath(`/produits/${id}`);
      return { ok: true, message: "Produit mis à jour." };
    }
    const product = await createProduct(input, user.id);
    revalidatePath("/produits");
    void product;
    return { ok: true, message: "Produit créé." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inattendue.";
    return { ok: false, error: msg.length > 300 ? "Données invalides." : msg };
  }
}

export async function changeProductStatus(
  formData: FormData,
): Promise<void> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const id = str(formData.get("id"));
  const status = productStatusSchema.parse(str(formData.get("status")));
  await setProductStatus(id, status, user.id);
  revalidatePath("/produits");
  if (id) revalidatePath(`/produits/${id}`);
}

export async function uploadProductMedia(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const productId = str(formData.get("productId"));
  const typeRaw = str(formData.get("type")) || "IMAGE";
  const type = z.enum(["IMAGE", "VIDEO", "THUMBNAIL"]).parse(typeRaw);
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Sélectionnez un fichier." };
  }

  try {
    const kind = type === "VIDEO" ? "video" : "image";
    const { url } = await saveUpload(file, { subdir: "products", kind });
    await addProductMedia({ productId, type, url }, user.id);
    revalidatePath(`/produits/${productId}`);
    return { ok: true, message: "Média ajouté." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Upload impossible." };
  }
}

export async function removeProductMedia(formData: FormData): Promise<void> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const id = str(formData.get("id"));
  const productId = str(formData.get("productId"));
  await deleteProductMedia(id, user.id);
  revalidatePath(`/produits/${productId}`);
}

export async function addMarketingAsset(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  try {
    await createMarketingAsset(
      {
        productId: str(formData.get("productId")),
        kind: str(formData.get("kind")),
        title: str(formData.get("title")),
        content: str(formData.get("content")),
        mediaUrl: str(formData.get("mediaUrl")),
      } as never,
      user.id,
    );
    revalidatePath(`/produits/${str(formData.get("productId"))}`);
    revalidatePath("/marketing");
    return { ok: true, message: "Élément marketing ajouté." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur." };
  }
}

export async function removeMarketingAsset(formData: FormData): Promise<void> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const id = str(formData.get("id"));
  const productId = str(formData.get("productId"));
  await deleteMarketingAsset(id, user.id);
  revalidatePath(`/produits/${productId}`);
  revalidatePath("/marketing");
}

