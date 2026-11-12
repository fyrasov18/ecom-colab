import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  listAssignedProducts,
  getPartnerCatalogueStats,
} from "@/modules/products/partner-catalogue";
import { prisma } from "@/lib/prisma";
import type { Category, PartnerProduct } from "@prisma/client";

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
    ] as unknown as PartnerProduct[]);

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
    ] as unknown as Category[]);

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
    ] as unknown as PartnerProduct[]);

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

  it("retrieves product purchaseCost alongside sellingPrice for partner margin calculation", async () => {
    vi.spyOn(prisma.partnerProduct, "findMany").mockResolvedValue([
      {
        partnerId: mockPartnerId,
        productId: "p1",
        status: "ACTIVE",
        assignedAt: new Date(),
        product: {
          id: "p1",
          name: "Casque Audio Bluetooth",
          sellingPrice: 89.0,
          purchaseCost: 35.5,
          status: "ACTIVE",
          media: [
            {
              id: "m1",
              type: "THUMBNAIL",
              googleDriveUrl: "https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j/view",
              title: "Vue principale",
              sortOrder: 0,
            },
            {
              id: "m2",
              type: "IMAGE",
              googleDriveUrl: "https://drive.google.com/file/d/0j9i8h7g6f5e4d3c2b1a/view",
              title: "Vue latérale",
              sortOrder: 1,
            },
          ],
          marketingAssets: [
            { id: "a1", kind: "AD_COPY", title: "Argumentaire de vente" },
          ],
        },
      },
      {
        partnerId: mockPartnerId,
        productId: "p2",
        status: "ACTIVE",
        assignedAt: new Date(),
        product: {
          id: "p2",
          name: "Produit Sans Coût d'Achat",
          sellingPrice: 45.0,
          purchaseCost: null, // Graceful null handling
          status: "ACTIVE",
          media: [],
          marketingAssets: [],
        },
      },
    ] as unknown as PartnerProduct[]);

    const assignments = await listAssignedProducts(mockPartnerId);

    expect(assignments).toHaveLength(2);

    // Product 1: Complete pricing and multiple media
    const prod1 = assignments[0].product;
    expect(prod1.sellingPrice).toBe(89.0);
    expect(prod1.purchaseCost).toBe(35.5);
    expect(prod1.media).toHaveLength(2);
    expect(prod1.marketingAssets).toHaveLength(1);

    // Product 2: Gracefully handles missing purchaseCost
    const prod2 = assignments[1].product;
    expect(prod2.sellingPrice).toBe(45.0);
    expect(prod2.purchaseCost).toBeNull();
  });
});
