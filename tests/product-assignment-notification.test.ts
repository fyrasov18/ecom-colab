import { describe, it, expect, vi, beforeEach } from "vitest";
import { assignProductToPartner } from "@/modules/partners/service";
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
