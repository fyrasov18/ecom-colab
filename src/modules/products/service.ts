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
  page?: number;
};

export async function listProducts(filters: ProductFilters = {}) {
  const { search, status, page = 1 } = filters;
  const where: Prisma.ProductWhereInput = {
    AND: [
      status ? { status } : {},
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
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
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
    select: { id: true, name: true, status: true },
  });
}

export async function getProductAdmin(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
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
  };
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "produit";
  let candidate = root;
  let i = 1;
  // eslint-disable-next-line no-constant-condition
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
      after: { name: product.name, slug: product.slug, sellingPrice: product.sellingPrice },
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
