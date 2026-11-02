import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";
import {
  categoryInputSchema,
  slugifyCategory,
  type CategoryInput,
} from "./schemas";

export type CategoryFilterOptions = {
  search?: string;
  status?: "ACTIVE" | "INACTIVE";
};

export async function listCategoriesAdmin(options: CategoryFilterOptions = {}) {
  const { search, status } = options;

  const where: Prisma.CategoryWhereInput = {
    AND: [
      status ? { isActive: status === "ACTIVE" } : {},
      search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { nameAr: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };

  return prisma.category.findMany({
    where,
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: { products: true },
      },
    },
  });
}

export async function listActiveCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          products: {
            where: {
              status: { in: ["ACTIVE", "OUT_OF_STOCK"] },
            },
          },
        },
      },
    },
  });
}

export async function getCategoryById(id: string) {
  return prisma.category.findUnique({
    where: { id },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });
}

async function uniqueCategorySlug(name: string, excludeId?: string): Promise<string> {
  const base = slugifyCategory(name);
  let candidate = base;
  let counter = 1;

  while (true) {
    const existing = await prisma.category.findUnique({
      where: { slug: candidate },
    });
    if (!existing || existing.id === excludeId) {
      return candidate;
    }
    candidate = `${base}-${++counter}`;
  }
}

export async function createCategory(input: CategoryInput, actorId: string) {
  const parsed = categoryInputSchema.parse(input);
  const slug = await uniqueCategorySlug(parsed.name);

  return prisma.$transaction(async (tx) => {
    const category = await tx.category.create({
      data: {
        name: parsed.name,
        nameAr: parsed.nameAr || null,
        slug,
        description: parsed.description || null,
        icon: parsed.icon || null,
        imageUrl: parsed.imageUrl || null,
        displayOrder: parsed.displayOrder,
        isActive: parsed.isActive,
      },
    });

    await recordAudit(tx, {
      actorId,
      action: "CATEGORY_CREATED",
      entityType: "Category",
      entityId: category.id,
      after: {
        name: category.name,
        slug: category.slug,
        displayOrder: category.displayOrder,
        isActive: category.isActive,
      },
    });

    return category;
  });
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
  actorId: string,
) {
  const parsed = categoryInputSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const before = await tx.category.findUniqueOrThrow({
      where: { id },
    });

    let slug = before.slug;
    if (parsed.name.toLowerCase() !== before.name.toLowerCase()) {
      slug = await uniqueCategorySlug(parsed.name, id);
    }

    const category = await tx.category.update({
      where: { id },
      data: {
        name: parsed.name,
        nameAr: parsed.nameAr || null,
        slug,
        description: parsed.description || null,
        icon: parsed.icon || null,
        imageUrl: parsed.imageUrl || null,
        displayOrder: parsed.displayOrder,
        isActive: parsed.isActive,
      },
    });

    await recordAudit(tx, {
      actorId,
      action: "CATEGORY_UPDATED",
      entityType: "Category",
      entityId: id,
      before: {
        name: before.name,
        nameAr: before.nameAr,
        slug: before.slug,
        displayOrder: before.displayOrder,
        isActive: before.isActive,
      },
      after: {
        name: category.name,
        nameAr: category.nameAr,
        slug: category.slug,
        displayOrder: category.displayOrder,
        isActive: category.isActive,
      },
    });

    return category;
  });
}

export async function toggleCategoryActive(
  id: string,
  isActive: boolean,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.category.findUniqueOrThrow({
      where: { id },
    });

    const category = await tx.category.update({
      where: { id },
      data: { isActive },
    });

    await recordAudit(tx, {
      actorId,
      action: "CATEGORY_STATUS_CHANGED",
      entityType: "Category",
      entityId: id,
      before: { isActive: before.isActive },
      after: { isActive: category.isActive },
    });

    return category;
  });
}

export type DeleteCategoryOptions = {
  reassignToCategoryId?: string;
};

export async function deleteCategory(
  id: string,
  actorId: string,
  options?: DeleteCategoryOptions,
) {
  return prisma.$transaction(async (tx) => {
    const category = await tx.category.findUniqueOrThrow({
      where: { id },
      include: {
        _count: { select: { products: true } },
      },
    });

    const productCount = category._count.products;

    if (productCount > 0) {
      if (!options?.reassignToCategoryId) {
        throw new Error(
          `Impossible de supprimer cette catégorie car elle contient ${productCount} produit(s). Veuillez réaffecter les produits avant la suppression.`,
        );
      }

      if (options.reassignToCategoryId === id) {
        throw new Error(
          "La catégorie de destination doit être différente de la catégorie à supprimer.",
        );
      }

      // Verify destination category exists
      const targetCategory = await tx.category.findUnique({
        where: { id: options.reassignToCategoryId },
      });

      if (!targetCategory) {
        throw new Error("La catégorie de destination sélectionnée n'existe pas.");
      }

      // Reassign products to new category
      await tx.product.updateMany({
        where: { categoryId: id },
        data: { categoryId: options.reassignToCategoryId },
      });
    }

    // Now safely delete
    await tx.category.delete({
      where: { id },
    });

    await recordAudit(tx, {
      actorId,
      action: "CATEGORY_DELETED",
      entityType: "Category",
      entityId: id,
      before: {
        name: category.name,
        slug: category.slug,
        productCount,
        reassignedTo: options?.reassignToCategoryId ?? null,
      },
    });

    return {
      deleted: true,
      reassignedProductsCount: productCount,
      targetCategoryId: options?.reassignToCategoryId ?? null,
    };
  });
}
