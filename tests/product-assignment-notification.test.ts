import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  assignProductToPartner,
  assignProductWithTarget,
  listPartnersWithoutLevel,
} from "@/modules/partners/service";
import { prisma } from "@/lib/prisma";

type TransactionCallback = (tx: unknown) => Promise<unknown>;

describe("Product Assignment Notifications (Requirement 1)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("automatically creates a notification for the partner when a product is assigned", async () => {
    const mockPartner = { id: "partner_1", userId: "user_partner_1" };
    const mockProduct = { id: "product_101", name: "Montre Connectée Sport Pro" };

    const mockPartnerProductUpsert = vi.fn().mockResolvedValue({
      id: "pp_1",
      partnerId: "partner_1",
      productId: "product_101",
      status: "ACTIVE",
      commissionType: null,
      commissionValue: null,
    });

    const mockNotificationCreate = vi.fn().mockResolvedValue({
      id: "notif_1",
      userId: "user_partner_1",
      type: "SYSTEM",
      title: "Nouveau produit assigné : Montre Connectée Sport Pro",
      body: "...",
      link: "/catalogue/product_101",
      readAt: null,
    });

    const txMock = {
      partnerProduct: {
        findUnique: vi.fn().mockResolvedValue(null), // first time assignment
        upsert: mockPartnerProductUpsert,
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
      partner: {
        findUnique: vi.fn().mockResolvedValue(mockPartner),
      },
      product: {
        findUnique: vi.fn().mockResolvedValue(mockProduct),
      },
      notification: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: mockNotificationCreate,
      },
    };

    vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: unknown) => {
      return (callback as TransactionCallback)(txMock) as never;
    });

    const result = await assignProductToPartner(
      {
        partnerId: "partner_1",
        productId: "product_101",
        commissionType: null,
        commissionValue: null,
      },
      "admin_user_1",
      { allowCommission: true },
    );

    expect(result.id).toBe("pp_1");
    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);

    const callArgs = mockNotificationCreate.mock.calls[0][0].data;
    expect(callArgs.userId).toBe("user_partner_1");
    expect(callArgs.type).toBe("SYSTEM");
    expect(callArgs.title).toBe("Nouveau produit assigné : Montre Connectée Sport Pro");
    expect(callArgs.link).toBe("/catalogue/product_101");
    expect(callArgs.body).toContain("Montre Connectée Sport Pro");
    expect(callArgs.body).toContain("Un nouveau produit vous a été assigné");
    // Verify presence of date/time in body
    expect(callArgs.body).toMatch(/le\s+\d+.*à\s+\d{2}:\d{2}/i);
  });

  it("does not send duplicate notification when product is already active (e.g. commission update)", async () => {
    const existingActiveAssignment = {
      id: "pp_1",
      partnerId: "partner_1",
      productId: "product_101",
      status: "ACTIVE",
      commissionType: null,
      commissionValue: null,
    };

    const mockNotificationCreate = vi.fn();

    const txMock = {
      partnerProduct: {
        findUnique: vi.fn().mockResolvedValue(existingActiveAssignment),
        upsert: vi.fn().mockResolvedValue({
          ...existingActiveAssignment,
          commissionType: "FIXED",
          commissionValue: "15.000",
        }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
      partner: {
        findUnique: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
      },
      notification: {
        findFirst: vi.fn(),
        create: mockNotificationCreate,
      },
    };

    vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: unknown) => {
      return (callback as TransactionCallback)(txMock) as never;
    });

    await assignProductToPartner(
      {
        partnerId: "partner_1",
        productId: "product_101",
        commissionType: "FIXED",
        commissionValue: 15,
      },
      "admin_user_1",
      { allowCommission: true },
    );

    // Should NOT have created a notification since assignment was already active
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("does not send duplicate notification if an unread notification for the product already exists", async () => {
    const mockPartner = { id: "partner_1", userId: "user_partner_1" };
    const mockProduct = { id: "product_101", name: "Écouteurs Bluetooth" };

    const mockNotificationCreate = vi.fn();

    const txMock = {
      partnerProduct: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({
          id: "pp_1",
          partnerId: "partner_1",
          productId: "product_101",
          status: "ACTIVE",
        }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
      partner: {
        findUnique: vi.fn().mockResolvedValue(mockPartner),
      },
      product: {
        findUnique: vi.fn().mockResolvedValue(mockProduct),
      },
      notification: {
        findFirst: vi.fn().mockResolvedValue({
          id: "existing_unread_notif",
          userId: "user_partner_1",
          link: "/catalogue/product_101",
          readAt: null,
        }),
        create: mockNotificationCreate,
      },
    };

    vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: unknown) => {
      return (callback as TransactionCallback)(txMock) as never;
    });

    await assignProductToPartner(
      {
        partnerId: "partner_1",
        productId: "product_101",
        commissionType: null,
        commissionValue: null,
      },
      "admin_user_1",
      { allowCommission: true },
    );

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("sends notification when reactivating an INACTIVE assignment", async () => {
    const existingInactiveAssignment = {
      id: "pp_1",
      partnerId: "partner_1",
      productId: "product_101",
      status: "INACTIVE",
      commissionType: null,
      commissionValue: null,
    };

    const mockPartner = { id: "partner_1", userId: "user_partner_1" };
    const mockProduct = { id: "product_101", name: "Sac à Dos Voyage" };
    const mockNotificationCreate = vi.fn().mockResolvedValue({});

    const txMock = {
      partnerProduct: {
        findUnique: vi.fn().mockResolvedValue(existingInactiveAssignment),
        upsert: vi.fn().mockResolvedValue({
          ...existingInactiveAssignment,
          status: "ACTIVE",
        }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
      partner: {
        findUnique: vi.fn().mockResolvedValue(mockPartner),
      },
      product: {
        findUnique: vi.fn().mockResolvedValue(mockProduct),
      },
      notification: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: mockNotificationCreate,
      },
    };

    vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: unknown) => {
      return (callback as TransactionCallback)(txMock) as never;
    });

    await assignProductToPartner(
      {
        partnerId: "partner_1",
        productId: "product_101",
        commissionType: null,
        commissionValue: null,
      },
      "admin_user_1",
      { allowCommission: true },
    );

    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockNotificationCreate.mock.calls[0][0].data;
    expect(callArgs.title).toBe("Nouveau produit assigné : Sac à Dos Voyage");
    expect(callArgs.link).toBe("/catalogue/product_101");
  });
});

describe("Advanced Partner Assignment Targeting (All, By Level, Individual, No Level)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("listPartnersWithoutLevel returns only ACTIVE partners where performanceLevelId is null", async () => {
    const mockFindMany = vi.spyOn(prisma.partner, "findMany").mockResolvedValue([
      { id: "partner_no_lvl_1", displayName: "Partenaire Sans Palier", code: "P-NOLVL-1" } as never,
    ]);

    const result = await listPartnersWithoutLevel();

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { status: "ACTIVE", performanceLevelId: null },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, code: true },
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("partner_no_lvl_1");
  });

  it("Scenario 1 — ALL: assigns product to all active partners, skipping already assigned", async () => {
    vi.spyOn(prisma.product, "findUnique").mockResolvedValue({ id: "prod_1", name: "Produit A" } as never);
    vi.spyOn(prisma.partner, "findMany").mockResolvedValue([
      { id: "partner_1", userId: "u1" },
      { id: "partner_2", userId: "u2" },
      { id: "partner_3", userId: "u3" },
    ] as never);

    // Partner 1 already has active assignment
    vi.spyOn(prisma.partnerProduct, "findMany").mockResolvedValue([
      { partnerId: "partner_1" },
    ] as never);

    const txMock = {
      partnerProduct: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: "pp_new", status: "ACTIVE" }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      partner: { findUnique: vi.fn().mockResolvedValue({ id: "p", userId: "u" }) },
      product: { findUnique: vi.fn().mockResolvedValue({ id: "prod_1", name: "Produit A" }) },
      notification: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
    };

    vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: unknown) => {
      return (callback as TransactionCallback)(txMock) as never;
    });

    const res = await assignProductWithTarget(
      { productId: "prod_1", targetType: "ALL" },
      "admin_1",
      { allowCommission: false },
    );

    expect(res.totalEligible).toBe(3);
    expect(res.alreadyAssignedCount).toBe(1);
    expect(res.assignedCount).toBe(2);
    // Verified tx called exactly for partner_2 and partner_3 (partner_1 skipped)
    expect(txMock.partnerProduct.upsert).toHaveBeenCalledTimes(2);
  });

  it("Scenario 2 — BY_LEVEL: assigns only to partners in the specified performance level", async () => {
    vi.spyOn(prisma.product, "findUnique").mockResolvedValue({ id: "prod_1", name: "Produit A" } as never);
    const mockPartnerFindMany = vi.spyOn(prisma.partner, "findMany").mockResolvedValue([
      { id: "partner_gold_1", userId: "u_gold" },
    ] as never);

    vi.spyOn(prisma.partnerProduct, "findMany").mockResolvedValue([] as never);

    const txMock = {
      partnerProduct: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: "pp_gold", status: "ACTIVE" }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      partner: { findUnique: vi.fn().mockResolvedValue({ id: "p", userId: "u" }) },
      product: { findUnique: vi.fn().mockResolvedValue({ id: "prod_1", name: "Produit A" }) },
      notification: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
    };

    vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: unknown) => {
      return (callback as TransactionCallback)(txMock) as never;
    });

    const res = await assignProductWithTarget(
      { productId: "prod_1", targetType: "BY_LEVEL", performanceLevelId: "level_gold" },
      "admin_1",
      { allowCommission: false },
    );

    expect(mockPartnerFindMany).toHaveBeenCalledWith({
      where: { status: "ACTIVE", performanceLevelId: "level_gold" },
      select: { id: true, userId: true },
    });
    expect(res.totalEligible).toBe(1);
    expect(res.assignedCount).toBe(1);
  });

  it("Scenario 3 — INDIVIDUAL: assigns to one specific partner with custom commission override", async () => {
    vi.spyOn(prisma.product, "findUnique").mockResolvedValue({ id: "prod_1", name: "Produit A" } as never);
    vi.spyOn(prisma.partner, "findFirst").mockResolvedValue({ id: "partner_vip", userId: "u_vip" } as never);
    vi.spyOn(prisma.partnerProduct, "findMany").mockResolvedValue([] as never);

    const txMock = {
      partnerProduct: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({
          id: "pp_vip",
          commissionType: "PERCENTAGE",
          commissionValue: "35",
          status: "ACTIVE",
        }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      partner: { findUnique: vi.fn().mockResolvedValue({ id: "partner_vip", userId: "u_vip" }) },
      product: { findUnique: vi.fn().mockResolvedValue({ id: "prod_1", name: "Produit A" }) },
      notification: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
    };

    vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: unknown) => {
      return (callback as TransactionCallback)(txMock) as never;
    });

    const res = await assignProductWithTarget(
      {
        productId: "prod_1",
        targetType: "INDIVIDUAL",
        partnerId: "partner_vip",
        commissionType: "PERCENTAGE",
        commissionValue: 35,
      },
      "admin_super",
      { allowCommission: true },
    );

    expect(res.totalEligible).toBe(1);
    expect(res.assignedCount).toBe(1);
    expect(txMock.partnerProduct.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          partnerId: "partner_vip",
          productId: "prod_1",
          commissionType: "PERCENTAGE",
          commissionValue: "35",
        }),
      }),
    );
  });

  it("Scenario 4 — NO_LEVEL: assigns ONLY to partners whose performanceLevelId is NULL", async () => {
    vi.spyOn(prisma.product, "findUnique").mockResolvedValue({ id: "prod_1", name: "Produit A" } as never);

    // Verify Prisma query strictly specifies performanceLevelId: null
    const mockPartnerFindMany = vi.spyOn(prisma.partner, "findMany").mockResolvedValue([
      { id: "partner_no_level_1", userId: "u_nl1" },
      { id: "partner_no_level_2", userId: "u_nl2" },
    ] as never);

    // partner_no_level_2 is already actively assigned
    vi.spyOn(prisma.partnerProduct, "findMany").mockResolvedValue([
      { partnerId: "partner_no_level_2" },
    ] as never);

    const txMock = {
      partnerProduct: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: "pp_assigned", status: "ACTIVE" }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      partner: { findUnique: vi.fn().mockResolvedValue({ id: "p", userId: "u" }) },
      product: { findUnique: vi.fn().mockResolvedValue({ id: "prod_1", name: "Produit A" }) },
      notification: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
    };

    vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: unknown) => {
      return (callback as TransactionCallback)(txMock) as never;
    });

    const res = await assignProductWithTarget(
      { productId: "prod_1", targetType: "NO_LEVEL" },
      "admin_1",
      { allowCommission: false },
    );

    // Strictly queried with performanceLevelId: null
    expect(mockPartnerFindMany).toHaveBeenCalledWith({
      where: { status: "ACTIVE", performanceLevelId: null },
      select: { id: true, userId: true },
    });

    expect(res.totalEligible).toBe(2);
    expect(res.alreadyAssignedCount).toBe(1);
    expect(res.assignedCount).toBe(1);

    // Only partner_no_level_1 was assigned; partner_no_level_2 was prevented as duplicate
    expect(txMock.partnerProduct.upsert).toHaveBeenCalledTimes(1);
  });

  it("validates input and throws if required parameters are missing", async () => {
    vi.spyOn(prisma.product, "findUnique").mockResolvedValue({ id: "prod_1", name: "Produit A" } as never);

    await expect(
      assignProductWithTarget(
        { productId: "prod_1", targetType: "INDIVIDUAL" }, // missing partnerId
        "admin_1",
        { allowCommission: false },
      ),
    ).rejects.toThrow("Veuillez sélectionner un partenaire.");

    await expect(
      assignProductWithTarget(
        { productId: "prod_1", targetType: "BY_LEVEL" }, // missing performanceLevelId
        "admin_1",
        { allowCommission: false },
      ),
    ).rejects.toThrow("Veuillez sélectionner un niveau de performance.");
  });
});
