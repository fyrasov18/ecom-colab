import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export type PartnerCatalogueFilters = {
  categoryId?: string;
  badge?: "WINNING" | "NEW" | "RECOMMENDED";
  search?: string;
};

/**
 * Partner-facing catalogue: ONLY products actively assigned to the partner.
 * Enforced server-side — never trust IDs from the URL.
 * Automatically hides products belonging to inactive categories.
 */
export async function listAssignedProducts(
  partnerId: string,
  filters: PartnerCatalogueFilters = {},
) {
  const { categoryId, badge, search } = filters;

  const productWhere: Prisma.ProductWhereInput = {
    status: { in: ["ACTIVE", "OUT_OF_STOCK"] },
    OR: [
      { categoryId: null },
      { categoryRef: { isActive: true } },
    ],
    AND: [
      categoryId
        ? {
            OR: [
              { categoryId },
              { category: categoryId },
              { categoryRef: { id: categoryId } },
              { categoryRef: { slug: categoryId } },
            ],
          }
        : {},
      badge === "WINNING" ? { isWinning: true } : {},
      badge === "NEW" ? { isNew: true } : {},
      badge === "RECOMMENDED" ? { isRecommended: true } : {},
      search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };

  return prisma.partnerProduct.findMany({
    where: {
      partnerId,
      status: "ACTIVE",
      product: productWhere,
    },
    orderBy: { assignedAt: "desc" },
    include: {
      product: {
        include: {
          categoryRef: true,
          media: { orderBy: { sortOrder: "asc" } },
          marketingAssets: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] },
        },
      },
    },
  });
}

/**
 * Returns active categories with their assigned product counts for the given partner,
 * as well as overall stats for winning, new, and recommended badges.
 */
export async function getPartnerCatalogueStats(partnerId: string) {
  const [categories, assignedProducts] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        nameAr: true,
        slug: true,
        icon: true,
        imageUrl: true,
        displayOrder: true,
      },
    }),
    prisma.partnerProduct.findMany({
      where: {
        partnerId,
        status: "ACTIVE",
        product: {
          status: { in: ["ACTIVE", "OUT_OF_STOCK"] },
          OR: [{ categoryId: null }, { categoryRef: { isActive: true } }],
        },
      },
      select: {
        product: {
          select: {
            id: true,
            categoryId: true,
            category: true,
            isWinning: true,
            isNew: true,
            isRecommended: true,
          },
        },
      },
    }),
  ]);

  const categoryCounts: Record<string, number> = {};
  let totalAssigned = 0;
  let winningCount = 0;
  let newCount = 0;
  let recommendedCount = 0;

  for (const item of assignedProducts) {
    totalAssigned++;
    const p = item.product;
    if (p.isWinning) winningCount++;
    if (p.isNew) newCount++;
    if (p.isRecommended) recommendedCount++;
  }

  const categoriesWithCounts = categories.map((cat) => {
    const matchingCount = assignedProducts.filter((item) => {
      const p = item.product;
      return (
        p.categoryId === cat.id ||
        p.category === cat.id ||
        (cat.slug && p.category === cat.slug) ||
        p.category === cat.name
      );
    }).length;

    return {
      ...cat,
      productCount: matchingCount,
    };
  });

  return {
    totalAssigned,
    winningCount,
    newCount,
    recommendedCount,
    categories: categoriesWithCounts,
  };
}

/**
 * ACTIVE assignments a partner may order from, with the commission inputs
 * (assignment → partner → product → global) the order form needs.
 */
export async function listOrderableAssignments(partnerId: string) {
  return prisma.partnerProduct.findMany({
    where: { partnerId, status: "ACTIVE" },
    orderBy: { assignedAt: "desc" },
    include: { product: true },
  });
}

/** Single product view for a partner — 404 unless assigned and active. */
export async function getAssignedProduct(partnerId: string, productId: string) {
  const assignment = await prisma.partnerProduct.findUnique({
    where: { partnerId_productId: { partnerId, productId } },
    include: {
      product: {
        include: {
          categoryRef: true,
          media: { orderBy: { sortOrder: "asc" } },
          marketingAssets: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] },
        },
      },
    },
  });
  if (
    !assignment ||
    assignment.status !== "ACTIVE" ||
    (assignment.product.status !== "ACTIVE" && assignment.product.status !== "OUT_OF_STOCK")
  ) {
    notFound();
  }
  return assignment;
}
