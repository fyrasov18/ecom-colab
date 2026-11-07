import { Prisma, ProductStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";
import { notifyBackOffice } from "@/modules/notifications/service";
import { buildLowStockBody, shouldAlertLowStock } from "./labels";
import { productSchema, slugify, type ProductInput } from "./schemas";

type Db = PrismaClient | Prisma.TransactionClient;

const PAGE_SIZE = 20;

/**
 * Raise a low-stock alert — but only when the change pushes the product *into*
 * the low zone (see `shouldAlertLowStock`), so a product that stays below its
 * threshold stops generating alerts until it is restocked above it.
 *
 * Called inside the caller's transaction so an alert can never survive a
 * failed stock write, and never survives without one.
 */
export async function alertIfLowStock(
  db: Db,
  product: {
    id: string;
    name: string;
    stockQuantity: number;
    lowStockThreshold: number;
  },
  before: { stockQuantity: number; lowStockThreshold: number },
): Promise<boolean> {
  const alert = shouldAlertLowStock({
    stockBefore: before.stockQuantity,
    stockAfter: product.stockQuantity,
    thresholdBefore: before.lowStockThreshold,
    thresholdAfter: product.lowStockThreshold,
  });
  if (!alert) return false;

  await notifyBackOffice(db, {
    type: "STOCK",
    title: `Stock bas — ${product.name}`,
    body: buildLowStockBody(
      product.name,
      product.stockQuantity,
      product.lowStockThreshold,
    ),
    link: `/produits/${product.id}`,
  });
  return true;
}

export type ProductFilters = {
  search?: string;
  status?: ProductStatus;
  categoryId?: string;
  isWinning?: boolean;
  isNew?: boolean;
  isRecommended?: boolean;
  page?: number;
};

export async function listProducts(filters: ProductFilters = {}) {
  const {
    search,
    status,
    categoryId,
    isWinning,
    isNew,
    isRecommended,
    page = 1,
  } = filters;

  const where: Prisma.ProductWhereInput = {
    AND: [
      status ? { status } : {},
      categoryId ? { categoryId } : {},
      isWinning !== undefined ? { isWinning } : {},
      isNew !== undefined ? { isNew } : {},
      isRecommended !== undefined ? { isRecommended } : {},
      search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };

  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      // id tie-breaker: stable total order across pages on createdAt ties.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        categoryRef: {
          select: { id: true, name: true, nameAr: true, slug: true },
        },
        _count: { select: { partnerAssignations: true, orderItems: true } },
      },
    }),
  ]);

  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function listProductOptions() {
  return prisma.product.findMany({
    where: { status: { in: ["ACTIVE", "OUT_OF_STOCK", "INACTIVE"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, status: true, categoryId: true },
  });
}

export async function getProductAdmin(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      categoryRef: true,
      media: { orderBy: { sortOrder: "asc" } },
      marketingAssets: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] },
      partnerAssignations: {
        include: { partner: { include: { user: { select: { email: true } } } } },
        orderBy: { assignedAt: "asc" },
      },
      _count: { select: { orderItems: true } },
    },
  });
}

function parseInput(input: ProductInput) {
  const parsed = productSchema.parse(input);
  return {
    name: parsed.name,
    description: parsed.description || null,
    purchaseCost: parsed.purchaseCost,
    packagingCost: parsed.packagingCost,
    deliveryCost: parsed.deliveryCost,
    sellingPrice: parsed.sellingPrice,
    stockQuantity: parsed.stockQuantity,
    lowStockThreshold: parsed.lowStockThreshold,
    status: parsed.status,
    commissionType: parsed.commissionType,
    commissionValue: parsed.commissionValue,
    categoryId: parsed.categoryId || null,
    isWinning: parsed.isWinning ?? false,
    isNew: parsed.isNew ?? false,
    isRecommended: parsed.isRecommended ?? false,
  };
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "produit";
  let candidate = root;
  let i = 1;
  while (true) {
    const existing = await prisma.product.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${root}-${++i}`;
  }
}

export async function createProduct(input: ProductInput, actorId: string) {
  const data = parseInput(input);
  const slug = await uniqueSlug(data.name);
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({ data: { ...data, slug } });
    await recordAudit(tx, {
      actorId,
      action: "PRODUCT_CREATED",
      entityType: "Product",
      entityId: product.id,
      after: {
        name: product.name,
        slug: product.slug,
        sellingPrice: product.sellingPrice,
        categoryId: product.categoryId,
        isWinning: product.isWinning,
        isNew: product.isNew,
        isRecommended: product.isRecommended,
      },
    });
    return product;
  });
}

export async function updateProduct(id: string, input: ProductInput, actorId: string) {
  const data = parseInput(input);
  return prisma.$transaction(async (tx) => {
    const before = await tx.product.findUniqueOrThrow({ where: { id } });
    const product = await tx.product.update({ where: { id }, data });
    // Audit sensitive pricing/cost/stock changes explicitly.
    await recordAudit(tx, {
      actorId,
      action: "PRODUCT_UPDATED",
      entityType: "Product",
      entityId: id,
      before: {
        purchaseCost: before.purchaseCost,
        packagingCost: before.packagingCost,
        deliveryCost: before.deliveryCost,
        sellingPrice: before.sellingPrice,
        stockQuantity: before.stockQuantity,
        status: before.status,
        commissionType: before.commissionType,
        commissionValue: before.commissionValue,
        categoryId: before.categoryId,
        isWinning: before.isWinning,
        isNew: before.isNew,
        isRecommended: before.isRecommended,
      },
      after: {
        purchaseCost: product.purchaseCost,
        packagingCost: product.packagingCost,
        deliveryCost: product.deliveryCost,
        sellingPrice: product.sellingPrice,
        stockQuantity: product.stockQuantity,
        status: product.status,
        commissionType: product.commissionType,
        commissionValue: product.commissionValue,
        categoryId: product.categoryId,
        isWinning: product.isWinning,
        isNew: product.isNew,
        isRecommended: product.isRecommended,
      },
    });

    // Phase 7: a manual stock correction (or a threshold change) can also push
    // the product under its low-stock line.
    await alertIfLowStock(tx, product, before);
    return product;
  });
}

export async function setProductStatus(
  id: string,
  status: ProductStatus,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.product.findUniqueOrThrow({ where: { id } });
    const product = await tx.product.update({ where: { id }, data: { status } });
    await recordAudit(tx, {
      actorId,
      action: "PRODUCT_STATUS_CHANGED",
      entityType: "Product",
      entityId: id,
      before: { status: before.status },
      after: { status: product.status },
    });
    return product;
  });
}

/**
 * Permanently deletes a product and all associated test data
 * (marketing assets, media, partner product assignations, order items, telegram sessions).
 */
export async function deleteProduct(id: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id },
    });
    if (!product) {
      throw new Error("Produit introuvable.");
    }

    // 1. Unlink any TelegramSession
    await tx.telegramSession.updateMany({
      where: { productId: id },
      data: { productId: null },
    });

    // 2. Delete partner product assignations
    await tx.partnerProduct.deleteMany({
      where: { productId: id },
    });

    // 3. Delete marketing assets and media
    await tx.productMarketingAsset.deleteMany({
      where: { productId: id },
    });
    await tx.productMedia.deleteMany({
      where: { productId: id },
    });

    // 4. Delete order items referencing this product
    await tx.orderItem.deleteMany({
      where: { productId: id },
    });

    // 5. Record audit
    await recordAudit(tx, {
      actorId,
      action: "PRODUCT_DELETED",
      entityType: "Product",
      entityId: id,
      before: {
        name: product.name,
        slug: product.slug,
        status: product.status,
      },
    });

    // 6. Delete product
    await tx.product.delete({
      where: { id },
    });

    return product;
  });
}
