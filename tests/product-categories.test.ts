import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createProduct,
  updateProduct,
  listProducts,
} from "@/modules/products/service";
import { prisma } from "@/lib/prisma";
import type { Prisma, Product, AuditLog } from "@prisma/client";

describe("Product Category & Discovery Flags Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const baseProductInput = {
    name: "Fer à Repasser Sans Fil",
    description: "Autonomie 45 min",
    purchaseCost: 35,
    packagingCost: 2,
    deliveryCost: 8,
    sellingPrice: 89,
    stockQuantity: 20,
    lowStockThreshold: 5,
    status: "ACTIVE" as const,
    commissionType: null,
    commissionValue: null,
    categoryId: "cat-maison",
    isWinning: true,
    isNew: false,
    isRecommended: true,
  };

  it("creates a product with categoryId and discovery flags", async () => {
    vi.spyOn(prisma.product, "findUnique").mockResolvedValue(null);
    const createSpy = vi.spyOn(prisma.product, "create").mockResolvedValue({
      id: "prod-101",
      ...baseProductInput,
      slug: "fer-a-repasser-sans-fil",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Product);

    vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as unknown as AuditLog);

    vi.spyOn(prisma, "$transaction").mockImplementation(async (cb) => {
      return typeof cb === "function" ? cb(prisma) : Promise.all(cb);
    });

    const created = await createProduct(baseProductInput, "admin-1");

    expect(created.id).toBe("prod-101");
    expect(createSpy).toHaveBeenCalledWith({
      data: expect.objectContaining({
        categoryId: "cat-maison",
        isWinning: true,
        isNew: false,
        isRecommended: true,
      }),
    });
  });

  it("updates a product's category and flags", async () => {
    vi.spyOn(prisma.product, "findUniqueOrThrow").mockResolvedValue({
      id: "prod-101",
      ...baseProductInput,
      slug: "fer-a-repasser-sans-fil",
      stockQuantity: 20,
      lowStockThreshold: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Product);

    const updateSpy = vi.spyOn(prisma.product, "update").mockResolvedValue({
      id: "prod-101",
      ...baseProductInput,
      categoryId: "cat-nouveau",
      isWinning: false,
      isNew: true,
      isRecommended: false,
      slug: "fer-a-repasser-sans-fil",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Product);

    vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as unknown as AuditLog);

    vi.spyOn(prisma, "$transaction").mockImplementation(async (cb) => {
      return typeof cb === "function" ? cb(prisma) : Promise.all(cb);
    });

    const updated = await updateProduct(
      "prod-101",
      {
        ...baseProductInput,
        categoryId: "cat-nouveau",
        isWinning: false,
        isNew: true,
        isRecommended: false,
      },
      "admin-1",
    );

    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: "prod-101" },
      data: expect.objectContaining({
        categoryId: "cat-nouveau",
        isWinning: false,
        isNew: true,
        isRecommended: false,
      }),
    });
  });

  it("filters products by category and flags in listProducts", async () => {
    const countSpy = vi.spyOn(prisma.product, "count").mockResolvedValue(1);
    type ProductListItem = Prisma.ProductGetPayload<{
      include: {
        categoryRef: {
          select: { id: true; name: true; nameAr: true; slug: true };
        };
        _count: { select: { partnerAssignations: true; orderItems: true } };
      };
    }>;

    const findManySpy = vi.spyOn(prisma.product, "findMany").mockResolvedValue([
      {
        id: "prod-101",
        name: "Fer à Repasser",
        slug: "fer-a-repasser",
        categoryId: "cat-maison",
        isWinning: true,
        categoryRef: { id: "cat-maison", name: "Maison", nameAr: null, slug: "maison" },
        _count: { partnerAssignations: 2, orderItems: 5 },
      },
    ] as unknown as ProductListItem[]);

    const res = await listProducts({
      categoryId: "cat-maison",
      isWinning: true,
    });

    expect(res.total).toBe(1);
    expect(res.items.length).toBe(1);
    expect(countSpy).toHaveBeenCalledWith({
      where: {
        AND: expect.arrayContaining([
          { categoryId: "cat-maison" },
          { isWinning: true },
        ]),
      },
    });
  });
});
