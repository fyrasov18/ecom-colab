import { describe, expect, it, vi, beforeEach } from "vitest";
import { deletePartner } from "@/modules/partners/service";
import { deleteOrder } from "@/modules/orders/delete";
import { deleteProduct } from "@/modules/products/service";
import { prisma } from "@/lib/prisma";

// Mock prisma transaction
vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      $transaction: vi.fn(),
    },
  };
});

vi.mock("@/modules/audit/service", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));

describe("Admin Deletion of Test Data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("deleteOrder", () => {
    it("deletes order and all linked cascade entities inside transaction", async () => {
      const mockOrder = {
        id: "order-test-1",
        orderNumber: 1001,
        status: "CONFIRMED",
        partnerId: "partner-1",
        customerId: "cust-1",
      };

      const mockTx = {
        order: {
          findUnique: vi.fn().mockResolvedValue(mockOrder),
          delete: vi.fn().mockResolvedValue(mockOrder),
        },
        referralCommission: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        financialTransaction: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        return: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        shipment: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        orderItem: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
        orderStatusHistory: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as never);
      });

      const result = await deleteOrder("order-test-1", "admin-1");
      expect(result.id).toBe("order-test-1");
      expect(mockTx.referralCommission.deleteMany).toHaveBeenCalledWith({ where: { orderId: "order-test-1" } });
      expect(mockTx.financialTransaction.deleteMany).toHaveBeenCalledWith({ where: { orderId: "order-test-1" } });
      expect(mockTx.orderItem.deleteMany).toHaveBeenCalledWith({ where: { orderId: "order-test-1" } });
      expect(mockTx.order.delete).toHaveBeenCalledWith({ where: { id: "order-test-1" } });
    });

    it("throws error if order is not found", async () => {
      const mockTx = {
        order: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as never);
      });

      await expect(deleteOrder("non-existent", "admin-1")).rejects.toThrow("Commande introuvable.");
    });
  });

  describe("deleteProduct", () => {
    it("deletes product and all related items, assets, media and assignments", async () => {
      const mockProduct = {
        id: "prod-test-1",
        name: "Test Product",
        slug: "test-product",
        status: "ACTIVE",
      };

      const mockTx = {
        product: {
          findUnique: vi.fn().mockResolvedValue(mockProduct),
          delete: vi.fn().mockResolvedValue(mockProduct),
        },
        telegramSession: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        partnerProduct: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
        productMarketingAsset: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        productMedia: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
        orderItem: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as never);
      });

      const result = await deleteProduct("prod-test-1", "admin-1");
      expect(result.id).toBe("prod-test-1");
      expect(mockTx.partnerProduct.deleteMany).toHaveBeenCalledWith({ where: { productId: "prod-test-1" } });
      expect(mockTx.productMarketingAsset.deleteMany).toHaveBeenCalledWith({ where: { productId: "prod-test-1" } });
      expect(mockTx.product.delete).toHaveBeenCalledWith({ where: { id: "prod-test-1" } });
    });

    it("throws error if product is not found", async () => {
      const mockTx = {
        product: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as never);
      });

      await expect(deleteProduct("non-existent-product", "admin-1")).rejects.toThrow("Produit introuvable.");
    });
  });

  describe("deletePartner", () => {
    it("deletes partner, user account, orders, and clean all tenant data", async () => {
      const mockPartner = {
        id: "partner-test-1",
        code: "EP-9999",
        displayName: "Test Partner",
        userId: "user-test-1",
        user: { email: "partner@test.com" },
        orders: [{ id: "order-p1" }],
      };

      const mockTx = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(mockPartner),
          delete: vi.fn().mockResolvedValue(mockPartner),
        },
        referralCommission: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        financialTransaction: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        orderItem: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        orderStatusHistory: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        return: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        shipment: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        order: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        referralAttribution: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        referralLink: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        withdrawal: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        wallet: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        partnerProduct: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        partnerSocialAccount: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        partnerPopupEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        customer: {
          findMany: vi.fn().mockResolvedValue([{ id: "cust-1" }]),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        auditLog: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        notification: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        user: { delete: vi.fn().mockResolvedValue({}) },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as never);
      });

      const result = await deletePartner("partner-test-1", "admin-1");
      expect(result.id).toBe("partner-test-1");
      expect(mockTx.partner.delete).toHaveBeenCalledWith({ where: { id: "partner-test-1" } });
      expect(mockTx.user.delete).toHaveBeenCalledWith({ where: { id: "user-test-1" } });
    });

    it("throws error if partner is not found", async () => {
      const mockTx = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as never);
      });

      await expect(deletePartner("non-existent-partner", "admin-1")).rejects.toThrow("Partenaire introuvable.");
    });
  });
});
