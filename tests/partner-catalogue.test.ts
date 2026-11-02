import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  listAssignedProducts,
  getPartnerCatalogueStats,
} from "@/modules/products/partner-catalogue";
import { prisma } from "@/lib/prisma";

describe("Partner Catalogue Service", () => {
  const mockPartnerId = "partner-123";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists assigned products and enforces active category filter", async () => {
    const findManySpy = vi.spyOn(prisma.partnerProduct, "findMany").mockResolvedValue([
      {
        partnerId: mockPartnerId,
        productId: "p1",
        status: "ACTIVE",
        assignedAt: new Date(),
        product: {
          id: "p1",
          name: "Blendeuse Pro",
          description: "Mixeur haute vitesse",
          sellingPrice: 120,
          status: "ACTIVE",
          categoryId: "cat-cuisine",
          isWinning: true,
          isNew: false,
          isRecommended: true,
          categoryRef: { id: "cat-cuisine", name: "Cuisine", isActive: true },
          media: [],
          marketingAssets: [],
        },
      },
    ] as any);

    const products = await listAssignedProducts(mockPartnerId, {
      badge: "WINNING",
    });

    expect(products.length).toBe(1);
    expect(products[0].product.name).toBe("Blendeuse Pro");
    expect(products[0].product.isWinning).toBe(true);

    expect(findManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          partnerId: mockPartnerId,
          status: "ACTIVE",
          product: expect.objectContaining({
            status: { in: ["ACTIVE", "OUT_OF_STOCK"] },
            OR: [
              { categoryId: null },
              { categoryRef: { isActive: true } },
            ],
            AND: expect.arrayContaining([
              { isWinning: true },
            ]),
          }),
        }),
      }),
    );
  });

  it("calculates partner catalogue stats correctly per category and badge", async () => {
    vi.spyOn(prisma.category, "findMany").mockResolvedValue([
      {
        id: "cat-1",
        name: "Maison",
        nameAr: "المنزل",
        slug: "maison",
        icon: "Home",
        imageUrl: null,
        displayOrder: 1,
      },
      {
        id: "cat-2",
        name: "Cuisine",
        nameAr: "المطبخ",
        slug: "cuisine",
        icon: "Utensils",
        imageUrl: null,
        displayOrder: 2,
      },
    ] as any);

    vi.spyOn(prisma.partnerProduct, "findMany").mockResolvedValue([
      {
        product: {
          id: "p1",
          categoryId: "cat-1",
          isWinning: true,
          isNew: true,
          isRecommended: false,
        },
      },
      {
        product: {
          id: "p2",
          categoryId: "cat-1",
          isWinning: false,
          isNew: false,
          isRecommended: true,
        },
      },
      {
        product: {
          id: "p3",
          categoryId: "cat-2",
          isWinning: true,
          isNew: false,
          isRecommended: true,
        },
      },
    ] as any);

    const stats = await getPartnerCatalogueStats(mockPartnerId);

    expect(stats.totalAssigned).toBe(3);
    expect(stats.winningCount).toBe(2);
    expect(stats.newCount).toBe(1);
    expect(stats.recommendedCount).toBe(2);

    const maisonCat = stats.categories.find((c) => c.id === "cat-1");
    expect(maisonCat?.productCount).toBe(2);

    const cuisineCat = stats.categories.find((c) => c.id === "cat-2");
    expect(cuisineCat?.productCount).toBe(1);
  });
});
