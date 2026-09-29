import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";

export const marketingAssetSchema = z.object({
  productId: z.string().min(1),
  kind: z.enum(["AD_COPY", "HOOK", "CAPTION", "DESCRIPTION", "SCRIPT", "FAQ", "CREATIVE"]),
  title: z.string().trim().max(160).optional().or(z.literal("")),
  content: z.string().trim().max(10000).optional().or(z.literal("")),
  mediaUrl: z.string().trim().max(500).optional().or(z.literal("")),
});

export type MarketingAssetInput = z.infer<typeof marketingAssetSchema>;

export async function createMarketingAsset(input: MarketingAssetInput, actorId: string) {
  const data = marketingAssetSchema.parse(input);
  if (!data.content && !data.mediaUrl) {
    throw new Error("Le contenu ou l URL du média est requis.");
  }
  const asset = await prisma.productMarketingAsset.create({
    data: {
      productId: data.productId,
      kind: data.kind,
      title: data.title || null,
      content: data.content || null,
      mediaUrl: data.mediaUrl || null,
    },
  });
  await recordAudit(prisma, {
    actorId,
    action: "MARKETING_ASSET_CREATED",
    entityType: "ProductMarketingAsset",
    entityId: asset.id,
    after: { productId: data.productId, kind: data.kind, title: data.title },
  });
  return asset;
}

export async function deleteMarketingAsset(id: string, actorId: string) {
  const asset = await prisma.productMarketingAsset.findUniqueOrThrow({ where: { id } });
  await prisma.productMarketingAsset.delete({ where: { id } });
  await recordAudit(prisma, {
    actorId,
    action: "MARKETING_ASSET_DELETED",
    entityType: "ProductMarketingAsset",
    entityId: id,
    before: { productId: asset.productId, kind: asset.kind, title: asset.title },
  });
}

// ── Product media (Google Drive) ──

export async function addProductMedia(
  input: {
    productId: string;
    type: "IMAGE" | "VIDEO" | "THUMBNAIL";
    googleDriveUrl: string;
    title?: string;
    sortOrder?: number;
  },
  actorId: string,
) {
  // If sortOrder is not explicitly provided, place it at the end
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const last = await prisma.productMedia.findFirst({
      where: { productId: input.productId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    sortOrder = (last?.sortOrder ?? -1) + 1;
  }

  const media = await prisma.productMedia.create({
    data: {
      productId: input.productId,
      type: input.type,
      googleDriveUrl: input.googleDriveUrl.trim(),
      title: input.title?.trim() || null,
      sortOrder,
    },
  });

  await recordAudit(prisma, {
    actorId,
    action: "PRODUCT_MEDIA_ADDED",
    entityType: "ProductMedia",
    entityId: media.id,
    after: {
      productId: input.productId,
      type: input.type,
      googleDriveUrl: input.googleDriveUrl,
      title: input.title,
    },
  });
  return media;
}

export async function updateProductMedia(
  id: string,
  input: {
    type?: "IMAGE" | "VIDEO" | "THUMBNAIL";
    googleDriveUrl?: string;
    title?: string;
    sortOrder?: number;
  },
  actorId: string,
) {
  const existing = await prisma.productMedia.findUniqueOrThrow({ where: { id } });

  const updated = await prisma.productMedia.update({
    where: { id },
    data: {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.googleDriveUrl !== undefined ? { googleDriveUrl: input.googleDriveUrl.trim() } : {}),
      ...(input.title !== undefined ? { title: input.title.trim() || null } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });

  await recordAudit(prisma, {
    actorId,
    action: "PRODUCT_MEDIA_UPDATED",
    entityType: "ProductMedia",
    entityId: id,
    before: {
      type: existing.type,
      googleDriveUrl: existing.googleDriveUrl,
      title: existing.title,
      sortOrder: existing.sortOrder,
    },
    after: {
      type: updated.type,
      googleDriveUrl: updated.googleDriveUrl,
      title: updated.title,
      sortOrder: updated.sortOrder,
    },
  });

  return updated;
}

export async function reorderProductMedia(
  productId: string,
  mediaIds: string[],
  actorId: string,
) {
  await prisma.$transaction(
    mediaIds.map((id, index) =>
      prisma.productMedia.update({
        where: { id, productId },
        data: { sortOrder: index },
      }),
    ),
  );

  await recordAudit(prisma, {
    actorId,
    action: "PRODUCT_MEDIA_REORDERED",
    entityType: "ProductMedia",
    entityId: productId,
    after: { mediaIds },
  });
}

export async function deleteProductMedia(id: string, actorId: string) {
  const media = await prisma.productMedia.findUniqueOrThrow({ where: { id } });
  await prisma.productMedia.delete({ where: { id } });
  await recordAudit(prisma, {
    actorId,
    action: "PRODUCT_MEDIA_DELETED",
    entityType: "ProductMedia",
    entityId: id,
    before: { productId: media.productId, googleDriveUrl: media.googleDriveUrl },
  });
}
