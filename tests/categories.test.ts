import { describe, expect, it, vi, beforeEach } from "vitest";
import { categoryInputSchema, slugifyCategory } from "@/modules/categories/schemas";
import {
  createCategory,
  updateCategory,
  toggleCategoryActive,
  deleteCategory,
} from "@/modules/categories/service";
import { prisma } from "@/lib/prisma";

describe("Category Schema & Slugify", () => {
  it("generates clean slugs from French names", () => {
    expect(slugifyCategory("Maison & Électroménager")).toBe("maison-electromenager");
    expect(slugifyCategory("High-Tech & Accessoires")).toBe("high-tech-accessoires");
    expect(slugifyCategory("Cuisine & Art de la table")).toBe("cuisine-art-de-la-table");
  });

  it("handles Arabic characters in slugs or falls back cleanly", () => {
    const slug = slugifyCategory("الكترونيات ومنزل");
    expect(slug).toBe("الكترونيات-ومنزل");
  });

  it("validates valid category inputs", () => {
    const valid = {
      name: "Mode & Accessoires",
      nameAr: "الموضة والإكسسوارات",
      description: "Vêtements et montres de qualité",
      icon: "Shirt",
      imageUrl: "https://example.com/image.png",
      displayOrder: 1,
      isActive: true,
    };
    const res = categoryInputSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it("rejects names that are too short", () => {
    const invalid = {
      name: "A",
    };
    const res = categoryInputSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });
});

describe("Category Safe Deletion & Business Rules", () => {
  it("rejects deletion of category with products if no reassignment category is provided", async () => {
    vi.spyOn(prisma.category, "findUniqueOrThrow").mockResolvedValue({
      id: "cat-1",
      name: "Catégorie avec produits",
      nameAr: null,
      slug: "cat-avec-produits",
      description: null,
      icon: null,
      imageUrl: null,
      displayOrder: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { products: 5 },
    } as any);

    vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => {
      return cb(prisma);
    });

    await expect(
      deleteCategory("cat-1", "admin-1"),
    ).rejects.toThrow(/Impossible de supprimer cette catégorie car elle contient 5 produit\(s\)/);
  });

  it("rejects reassignment to the exact same category being deleted", async () => {
    vi.spyOn(prisma.category, "findUniqueOrThrow").mockResolvedValue({
      id: "cat-1",
      name: "Catégorie avec produits",
      nameAr: null,
      slug: "cat-avec-produits",
      description: null,
      icon: null,
      imageUrl: null,
      displayOrder: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { products: 3 },
    } as any);

    vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => {
      return cb(prisma);
    });

    await expect(
      deleteCategory("cat-1", "admin-1", { reassignToCategoryId: "cat-1" }),
    ).rejects.toThrow(/La catégorie de destination doit être différente/);
  });

  it("safely reassigns products to the target category before deleting", async () => {
    vi.spyOn(prisma.category, "findUniqueOrThrow").mockResolvedValue({
      id: "cat-1",
      name: "Ancienne Catégorie",
      nameAr: null,
      slug: "ancienne-cat",
      description: null,
      icon: null,
      imageUrl: null,
      displayOrder: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { products: 4 },
    } as any);

    vi.spyOn(prisma.category, "findUnique").mockResolvedValue({
      id: "cat-2",
      name: "Nouvelle Catégorie",
    } as any);

    const updateManySpy = vi.spyOn(prisma.product, "updateMany").mockResolvedValue({ count: 4 });
    const deleteSpy = vi.spyOn(prisma.category, "delete").mockResolvedValue({ id: "cat-1" } as any);
    const auditSpy = vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as any);

    vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => {
      return cb(prisma);
    });

    const result = await deleteCategory("cat-1", "admin-1", { reassignToCategoryId: "cat-2" });

    expect(result.deleted).toBe(true);
    expect(result.reassignedProductsCount).toBe(4);
    expect(result.targetCategoryId).toBe("cat-2");
    expect(updateManySpy).toHaveBeenCalledWith({
      where: { categoryId: "cat-1" },
      data: { categoryId: "cat-2" },
    });
    expect(deleteSpy).toHaveBeenCalledWith({ where: { id: "cat-1" } });
  });

  it("deletes empty category immediately without needing reassignment", async () => {
    vi.spyOn(prisma.category, "findUniqueOrThrow").mockResolvedValue({
      id: "cat-empty",
      name: "Catégorie Vide",
      nameAr: null,
      slug: "cat-vide",
      description: null,
      icon: null,
      imageUrl: null,
      displayOrder: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { products: 0 },
    } as any);

    const deleteSpy = vi.spyOn(prisma.category, "delete").mockResolvedValue({ id: "cat-empty" } as any);
    vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as any);

    vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => {
      return cb(prisma);
    });

    const result = await deleteCategory("cat-empty", "admin-1");
    expect(result.deleted).toBe(true);
    expect(result.reassignedProductsCount).toBe(0);
    expect(deleteSpy).toHaveBeenCalledWith({ where: { id: "cat-empty" } });
  });
});
