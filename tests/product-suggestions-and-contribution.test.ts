import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  suggestionSubmissionSchema,
  suggestionStatusUpdateSchema,
  linkProductSuggestionSchema,
  createProductFromSuggestionSchema,
} from "@/modules/suggestions/schemas";
import {
  createSuggestion,
  listPartnerSuggestions,
  getPartnerSuggestion,
  listAdminSuggestions,
  getAdminSuggestion,
  updateSuggestionStatus,
  linkSuggestionToProduct,
  createProductFromSuggestion,
  getPartnerContributionAnalytics,
} from "@/modules/suggestions/service";

type TransactionCallback = (tx: unknown) => Promise<unknown>;

describe("Product Suggestions & Partner Contribution Tracking", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Validation & Input Schemas", () => {
    it("validates required fields (name, price, image)", () => {
      const valid = suggestionSubmissionSchema.safeParse({
        name: "Écouteurs Bluetooth Pro",
        estimatedSellingPrice: "59.9",
        imageUrl: "https://example.com/image.jpg",
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.name).toBe("Écouteurs Bluetooth Pro");
        expect(valid.data.estimatedSellingPrice).toBe(59.9);
      }

      // Missing name
      const missingName = suggestionSubmissionSchema.safeParse({
        name: "",
        estimatedSellingPrice: 40,
        imageUrl: "https://example.com/img.jpg",
      });
      expect(missingName.success).toBe(false);

      // Non-positive price
      const zeroPrice = suggestionSubmissionSchema.safeParse({
        name: "Produit Test",
        estimatedSellingPrice: 0,
        imageUrl: "https://example.com/img.jpg",
      });
      expect(zeroPrice.success).toBe(false);

      // Missing image
      const missingImg = suggestionSubmissionSchema.safeParse({
        name: "Produit Test",
        estimatedSellingPrice: 50,
        imageUrl: "",
      });
      expect(missingImg.success).toBe(false);
    });

    it("parses optional fields and validates supplier URL if provided", () => {
      const full = suggestionSubmissionSchema.safeParse({
        name: "Montre Connectée Fit",
        estimatedSellingPrice: 89,
        imageUrl: "/uploads/suggestions/watch.jpg",
        description: "Montre sport étanche avec capteur cardiaque",
        estimatedPurchasePrice: 35,
        supplierName: "Shenzhen Electronics",
        supplierContact: "+216 98 000 000",
        supplierUrl: "https://supplier.example.com/item/123",
        characteristics: "Écran AMOLED, batterie 7 jours",
        targetAudience: "Sportifs, jeunes actifs",
        partnerReason: "Forte demande sur TikTok, marge de 50 DT",
        additionalNotes: "Échantillon déjà testé",
      });
      expect(full.success).toBe(true);
      if (full.success) {
        expect(full.data.estimatedPurchasePrice).toBe(35);
        expect(full.data.supplierUrl).toBe("https://supplier.example.com/item/123");
      }

      // Invalid URL protocol
      const invalidUrl = suggestionSubmissionSchema.safeParse({
        name: "Test",
        estimatedSellingPrice: 20,
        imageUrl: "https://example.com/img.jpg",
        supplierUrl: "ftp://invalid-url.com",
      });
      expect(invalidUrl.success).toBe(false);
    });
  });

  describe("2. Partner Submission & Notification", () => {
    it("creates suggestion with PENDING status, creates initial history, and notifies partner + back-office", async () => {
      const mockPartner = {
        id: "partner_42",
        userId: "user_partner_42",
        displayName: "Sami Ben Ali",
        code: "PRT-42",
        status: "ACTIVE",
        user: { id: "user_partner_42", email: "sami@partner.com", firstName: "Sami", lastName: "Ben Ali" },
      };

      const mockCreatedSuggestion = {
        id: "sugg_1",
        partnerId: "partner_42",
        name: "Diffuseur d'huiles essentielles",
        estimatedSellingPrice: 45,
        imageUrl: "/uploads/suggestions/diffuser.jpg",
        status: "PENDING",
      };

      const mockNotifCreate = vi.fn().mockResolvedValue({});
      const mockNotifCreateMany = vi.fn().mockResolvedValue({ count: 2 });
      const mockHistoryCreate = vi.fn().mockResolvedValue({});

      const txMock = {
        productSuggestion: {
          create: vi.fn().mockResolvedValue(mockCreatedSuggestion),
        },
        productSuggestionHistory: {
          create: mockHistoryCreate,
        },
        notification: {
          create: mockNotifCreate,
          createMany: mockNotifCreateMany,
        },
        user: {
          findMany: vi.fn().mockResolvedValue([
            { id: "admin_1" },
            { id: "admin_2" },
          ]),
        },
      };

      vi.spyOn(prisma.partner, "findUnique").mockResolvedValue(mockPartner as never);
      vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: unknown) => {
        return (cb as TransactionCallback)(txMock);
      });

      const res = await createSuggestion("partner_42", {
        name: "Diffuseur d'huiles essentielles",
        estimatedSellingPrice: 45,
        imageUrl: "/uploads/suggestions/diffuser.jpg",
      });

      expect(res.id).toBe("sugg_1");
      expect(txMock.productSuggestion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            partnerId: "partner_42",
            name: "Diffuseur d'huiles essentielles",
            status: "PENDING",
          }),
        }),
      );

      // Verify history created with initial status
      expect(mockHistoryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            suggestionId: "sugg_1",
            previousStatus: null,
            newStatus: "PENDING",
            actorId: "user_partner_42",
          }),
        }),
      );

      // Partner notification
      expect(mockNotifCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user_partner_42",
            type: "SYSTEM",
            link: "/suggestions-produits/sugg_1",
          }),
        }),
      );

      // Back-office admin notification
      expect(mockNotifCreateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              userId: "admin_1",
              link: "/produits/suggestions/sugg_1",
            }),
          ]),
        }),
      );
    });

    it("rejects submission if partner is not active", async () => {
      vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
        id: "partner_pending",
        status: "PENDING",
        user: { firstName: "A", lastName: "B", email: "a@b.com" },
      } as never);

      await expect(
        createSuggestion("partner_pending", {
          name: "Test",
          estimatedSellingPrice: 10,
          imageUrl: "https://example.com/test.jpg",
        }),
      ).rejects.toThrow("Seuls les partenaires actifs peuvent soumettre des suggestions");
    });
  });

  describe("3. Tenant Isolation & Confidentiality Guarantee", () => {
    it("listPartnerSuggestions enforces partnerId scoping and never returns internalNotes", async () => {
      const mockFindMany = vi.spyOn(prisma.productSuggestion, "findMany").mockResolvedValue([
        {
          id: "sugg_10",
          name: "Lampe LED Sans Fil",
          imageUrl: "/uploads/lampe.jpg",
          estimatedSellingPrice: 39,
          estimatedPurchasePrice: 12,
          status: "ACCEPTED",
          createdAt: new Date("2026-11-01"),
          updatedAt: new Date("2026-11-02"),
          partnerFeedback: "Excellente idée, en cours de sourcing",
          productId: null,
          product: null,
        },
      ] as never);

      const items = await listPartnerSuggestions("partner_secure_1", { status: "ACCEPTED" });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            partnerId: "partner_secure_1",
            status: "ACCEPTED",
          }),
        }),
      );

      expect(items).toHaveLength(1);
      expect((items[0] as unknown as { internalNotes?: unknown }).internalNotes).toBeUndefined();
    });

    it("getPartnerSuggestion verifies ownership and strictly omits internalNotes", async () => {
      const mockFindFirst = vi.spyOn(prisma.productSuggestion, "findFirst").mockResolvedValue({
        id: "sugg_20",
        partnerId: "partner_abc",
        name: "Support Téléphone Voiture",
        imageUrl: "/img.jpg",
        images: null,
        estimatedSellingPrice: 25,
        estimatedPurchasePrice: 7,
        description: "Support magnétique",
        supplierName: "AutoPro",
        supplierContact: "contact@autopro.tn",
        supplierUrl: null,
        characteristics: null,
        targetAudience: null,
        partnerReason: null,
        additionalNotes: null,
        status: "UNDER_REVIEW",
        partnerFeedback: "Nous comparons les devis de livraison",
        statusUpdatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        productId: null,
        productCreatedAt: null,
        product: null,
        history: [
          {
            id: "h_1",
            previousStatus: "PENDING",
            newStatus: "UNDER_REVIEW",
            actorName: "Équipe Catalogue",
            feedback: "Dossier pris en charge",
            createdAt: new Date(),
          },
        ],
      } as never);

      const detail = await getPartnerSuggestion("partner_abc", "sugg_20");

      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "sugg_20",
            partnerId: "partner_abc",
          },
        }),
      );

      expect(detail).not.toBeNull();
      expect((detail as unknown as { internalNotes?: unknown }).internalNotes).toBeUndefined();
      expect(detail?.history[0]).not.toHaveProperty("internalNotes");
    });

    it("getAdminSuggestion includes partner info and confidential internal notes", async () => {
      vi.spyOn(prisma.productSuggestion, "findUnique").mockResolvedValue({
        id: "sugg_admin_1",
        partnerId: "partner_42",
        name: "Robot Aspirateur Compact",
        imageUrl: "/img.jpg",
        images: ["/img1.jpg", "/img2.jpg"],
        estimatedSellingPrice: 290,
        estimatedPurchasePrice: 120,
        description: "Aspirateur intelligent",
        supplierName: "Shenzhen Tech",
        supplierContact: "+86 123",
        supplierUrl: "https://shenzhen.example.com",
        characteristics: "Capteur laser",
        targetAudience: "Familles",
        partnerReason: "Marge exceptionnelle",
        additionalNotes: null,
        status: "ACCEPTED",
        partnerFeedback: "Produit retenu pour notre prochain arrivage !",
        internalNotes: "Fournisseur A propose 110 DT si commande > 100 pièces. Marge nette 140 DT.",
        statusUpdatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        partner: {
          id: "partner_42",
          code: "PRT-42",
          displayName: "Sami Ben Ali",
          phone: "98123456",
        },
        statusUpdatedBy: {
          id: "admin_user_1",
          firstName: "Karim",
          lastName: "Admin",
          email: "admin@ecom.tn",
        },
        productId: null,
        product: null,
        productCreatedAt: null,
        history: [
          {
            id: "h_2",
            previousStatus: "UNDER_REVIEW",
            newStatus: "ACCEPTED",
            actorName: "Karim Admin",
            feedback: "Produit retenu pour arrivage",
            internalNotes: "Fournisseur A validé",
            createdAt: new Date(),
          },
        ],
      } as never);

      const adminDetail = await getAdminSuggestion("sugg_admin_1");

      expect(adminDetail).not.toBeNull();
      expect(adminDetail?.internalNotes).toContain("Fournisseur A propose 110 DT");
      expect(adminDetail?.partner.code).toBe("PRT-42");
      expect(adminDetail?.history[0].internalNotes).toBe("Fournisseur A validé");
    });
  });

  describe("4. Status Updates & No-Auto-Product Guarantee", () => {
    it("updating status to ACCEPTED does not create a product in catalog automatically", async () => {
      const mockSuggestion = {
        id: "sugg_accept",
        name: "Tapis de Yoga Antidérapant",
        partner: { userId: "user_partner_99" },
        status: "UNDER_REVIEW",
      };

      const mockProductCreate = vi.fn();
      const mockHistoryCreate = vi.fn().mockResolvedValue({});
      const mockNotifCreate = vi.fn().mockResolvedValue({});

      const txMock = {
        productSuggestion: {
          update: vi.fn().mockResolvedValue({
            ...mockSuggestion,
            status: "ACCEPTED",
          }),
        },
        productSuggestionHistory: {
          create: mockHistoryCreate,
        },
        product: {
          create: mockProductCreate, // MUST NOT BE CALLED
        },
        notification: {
          create: mockNotifCreate,
        },
      };

      vi.spyOn(prisma.productSuggestion, "findUnique").mockResolvedValue(mockSuggestion as never);
      vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: unknown) => {
        return (cb as TransactionCallback)(txMock);
      });

      const res = await updateSuggestionStatus(
        "sugg_accept",
        { id: "admin_1", firstName: "Admin", lastName: "Ecom", email: "admin@ecom.tn", role: "ADMIN" },
        {
          status: "ACCEPTED",
          partnerFeedback: "Votre suggestion est acceptée pour étude d'approvisionnement !",
          internalNotes: "Contacter le transitaire pour fret maritime.",
        },
      );

      expect(res.status).toBe("ACCEPTED");
      expect(mockProductCreate).not.toHaveBeenCalled();
      expect(mockHistoryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            newStatus: "ACCEPTED",
            feedback: "Votre suggestion est acceptée pour étude d'approvisionnement !",
            internalNotes: "Contacter le transitaire pour fret maritime.",
          }),
        }),
      );
    });
  });

  describe("5. Product Introduction & Strict 1-to-1 Attribution", () => {
    it("creates official product from suggestion with source PARTNER_SUGGESTION and links 1-to-1", async () => {
      const mockSuggestion = {
        id: "sugg_to_prod",
        name: "Mini Projecteur Portable",
        description: "Projecteur HD compact",
        imageUrl: "/img/proj.jpg",
        partnerId: "partner_88",
        status: "ACCEPTED",
        internalNotes: "Coût vérifié",
        partner: {
          id: "partner_88",
          userId: "user_p_88",
          displayName: "Tech Store TN",
        },
      };

      const mockProduct = {
        id: "prod_new_101",
        name: "Mini Projecteur Portable HD",
        slug: "mini-projecteur-portable-hd",
        source: "PARTNER_SUGGESTION",
        sellingPrice: 189,
      };

      const mockHistoryCreate = vi.fn().mockResolvedValue({});
      const mockPartnerProductUpsert = vi.fn().mockResolvedValue({});
      const mockNotifCreate = vi.fn().mockResolvedValue({});

      const txMock = {
        product: {
          findUnique: vi.fn().mockResolvedValue(null), // slug is unique
          create: vi.fn().mockResolvedValue(mockProduct),
        },
        productMedia: {
          create: vi.fn().mockResolvedValue({}),
        },
        partnerProduct: {
          upsert: mockPartnerProductUpsert,
        },
        productSuggestion: {
          update: vi.fn().mockResolvedValue({
            ...mockSuggestion,
            status: "PRODUCT_CREATED",
            productId: "prod_new_101",
          }),
        },
        productSuggestionHistory: {
          create: mockHistoryCreate,
        },
        notification: {
          create: mockNotifCreate,
        },
      };

      vi.spyOn(prisma.productSuggestion, "findUnique").mockResolvedValue(mockSuggestion as never);
      vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: unknown) => {
        return (cb as TransactionCallback)(txMock);
      });

      const res = await createProductFromSuggestion(
        "sugg_to_prod",
        { id: "admin_1", firstName: "Admin", lastName: "Catalog", email: "admin@ecom.tn", role: "ADMIN" },
        {
          suggestionId: "sugg_to_prod",
          name: "Mini Projecteur Portable HD",
          sellingPrice: 189,
          purchaseCost: 95,
          packagingCost: 2,
          deliveryCost: 7,
          stockQuantity: 25,
          lowStockThreshold: 5,
          autoAssignToPartner: true,
          internalNotes: "Premier lot de 25 pièces réceptionné.",
        },
      );

      expect(res.product.id).toBe("prod_new_101");
      expect(txMock.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Mini Projecteur Portable HD",
            source: "PARTNER_SUGGESTION",
            sellingPrice: expect.anything(),
          }),
        }),
      );

      // 1-to-1 link updated on suggestion
      expect(txMock.productSuggestion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sugg_to_prod" },
          data: expect.objectContaining({
            status: "PRODUCT_CREATED",
            productId: "prod_new_101",
          }),
        }),
      );

      // Auto-assigned partner product
      expect(mockPartnerProductUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            partnerId_productId: {
              partnerId: "partner_88",
              productId: "prod_new_101",
            },
          },
        }),
      );

      // Partner celebration notification
      expect(mockNotifCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user_p_88",
            title: expect.stringContaining("Produit créé"),
            link: "/catalogue/prod_new_101",
          }),
        }),
      );
    });

    it("prevents duplicate attribution when linking to an already-attributed product", async () => {
      vi.spyOn(prisma.productSuggestion, "findUnique")
        .mockResolvedValueOnce({
          id: "sugg_duplicate",
          name: "Suggestion A",
          partnerId: "partner_1",
          productId: null,
          partner: { id: "partner_1", userId: "u1", displayName: "Partner 1" },
        } as never)
        // Check if product exists
        .mockResolvedValueOnce({
          id: "sugg_existing",
          name: "Suggestion B (Déjà liée)",
          productId: "prod_already_linked",
        } as never);

      vi.spyOn(prisma.product, "findUnique").mockResolvedValue({
        id: "prod_already_linked",
        name: "Produit Existant",
      } as never);

      await expect(
        linkSuggestionToProduct(
          "sugg_duplicate",
          "prod_already_linked",
          { id: "admin_1", firstName: "Admin", lastName: "Admin", email: "a@e.tn", role: "ADMIN" },
        ),
      ).rejects.toThrow("Ce produit est déjà attribué à une autre suggestion");
    });
  });

  describe("6. Partner Contribution Analytics", () => {
    it("computes global KPIs and partner acceptance rate correctly", async () => {
      const mockSuggestions = [
        {
          id: "s1",
          partnerId: "p1",
          status: "ACCEPTED",
          productId: null,
          productCreatedAt: null,
          product: null,
        },
        {
          id: "s2",
          partnerId: "p1",
          status: "PRODUCT_CREATED",
          productId: "prod_1",
          productCreatedAt: new Date(),
          product: { id: "prod_1", name: "Produit Créé 1", slug: "p1", createdAt: new Date() },
        },
        {
          id: "s3",
          partnerId: "p1",
          status: "REJECTED",
          productId: null,
          productCreatedAt: null,
          product: null,
        },
        {
          id: "s4",
          partnerId: "p1",
          status: "PENDING",
          productId: null,
          productCreatedAt: null,
          product: null,
        },
        {
          id: "s5",
          partnerId: "p2",
          status: "PENDING",
          productId: null,
          productCreatedAt: null,
          product: null,
        },
      ];

      const mockPartners = [
        { id: "p1", code: "PRT-01", displayName: "Karim Salah", phone: "98111222" },
        { id: "p2", code: "PRT-02", displayName: "Nadia Mansour", phone: "98333444" },
      ];

      vi.spyOn(prisma.productSuggestion, "findMany").mockResolvedValue(mockSuggestions as never);
      vi.spyOn(prisma.partner, "findMany").mockResolvedValue(mockPartners as never);

      const analytics = await getPartnerContributionAnalytics();

      // Global metrics
      expect(analytics.global.totalSuggestions).toBe(5);
      expect(analytics.global.pendingReview).toBe(2);
      expect(analytics.global.accepted).toBe(1);
      expect(analytics.global.rejected).toBe(1);
      expect(analytics.global.productsCreated).toBe(1);

      // Partner 1 metrics
      const p1 = analytics.partners.find((p) => p.partnerId === "p1");
      expect(p1).toBeDefined();
      expect(p1?.totalSuggestions).toBe(4);
      expect(p1?.acceptedSuggestions).toBe(1);
      expect(p1?.rejectedSuggestions).toBe(1);
      expect(p1?.productsCreated).toBe(1);
      // Denominator: accepted(1) + created(1) + rejected(1) = 3 decisions.
      // Accepted + Created = 2.
      // Rate = (2 / 3) * 100 = 66.7%
      expect(p1?.acceptanceRate).toBe(66.7);
      expect(p1?.linkedProducts).toHaveLength(1);
      expect(p1?.linkedProducts[0].name).toBe("Produit Créé 1");

      // Partner 2 metrics (only PENDING suggestion -> 0 decisions taken)
      const p2 = analytics.partners.find((p) => p.partnerId === "p2");
      expect(p2).toBeDefined();
      expect(p2?.totalSuggestions).toBe(1);
      expect(p2?.acceptanceRate).toBeNull(); // No decisions taken yet
      expect(p2?.linkedProducts).toHaveLength(0);
    });
  });
});
