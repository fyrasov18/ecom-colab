import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkAndQualifyOrder } from "@/modules/referrals/qualification";
import { countDirectQualifiedReferrals } from "@/modules/referrals/levels";
import type { Prisma } from "@prisma/client";

describe("3 Distinct Delivered & Available Orders Qualification Rule", () => {
  const mockOrder = {
    id: "order-3",
    partnerId: "referred-partner-1",
    status: "DELIVERED",
    earningStatus: "AVAILABLE",
  };

  const mockAttribution = {
    id: "attr-1",
    referrerPartnerId: "referrer-partner-1",
    referredPartnerId: "referred-partner-1",
    status: "PENDING_QUALIFICATION",
  };

  it("keeps attribution PENDING_QUALIFICATION if referred partner has only 1 delivered/available order", async () => {
    const mockDb = {
      order: {
        findUnique: vi.fn().mockResolvedValue(mockOrder),
        count: vi.fn().mockResolvedValue(1), // Only 1 order delivered
      },
      referralAttribution: {
        findUnique: vi.fn().mockResolvedValue(mockAttribution),
        updateMany: vi.fn(),
      },
      systemSetting: {
        findUnique: vi.fn().mockResolvedValue(null), // fallback default: 3
      },
      auditLog: {
        create: vi.fn(),
      },
    } as unknown as Prisma.TransactionClient;

    const result = await checkAndQualifyOrder("order-3", mockDb);
    expect(result.qualified).toBe(false);
    if (!result.qualified) {
      expect(result.reason).toBe("INSUFFICIENT_ORDERS");
      expect(result.ordersCount).toBe(1);
      expect(result.requiredOrders).toBe(3);
    }
    expect(mockDb.referralAttribution.updateMany).not.toHaveBeenCalled();
  });

  it("keeps attribution PENDING_QUALIFICATION if referred partner has 2 delivered/available orders", async () => {
    const mockDb = {
      order: {
        findUnique: vi.fn().mockResolvedValue(mockOrder),
        count: vi.fn().mockResolvedValue(2), // 2 orders delivered
      },
      referralAttribution: {
        findUnique: vi.fn().mockResolvedValue(mockAttribution),
        updateMany: vi.fn(),
      },
      systemSetting: {
        findUnique: vi.fn().mockResolvedValue({ value: 3 }),
      },
      auditLog: {
        create: vi.fn(),
      },
    } as unknown as Prisma.TransactionClient;

    const result = await checkAndQualifyOrder("order-3", mockDb);
    expect(result.qualified).toBe(false);
    if (!result.qualified) {
      expect(result.reason).toBe("INSUFFICIENT_ORDERS");
      expect(result.ordersCount).toBe(2);
      expect(result.requiredOrders).toBe(3);
    }
    expect(mockDb.referralAttribution.updateMany).not.toHaveBeenCalled();
  });

  it("qualifies attribution when the 3rd order is delivered and available", async () => {
    const mockDb = {
      order: {
        findUnique: vi.fn().mockResolvedValue(mockOrder),
        count: vi.fn().mockResolvedValue(3), // 3 orders reached!
      },
      referralAttribution: {
        findUnique: vi.fn().mockResolvedValue(mockAttribution),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        count: vi.fn().mockResolvedValue(1),
      },
      systemSetting: {
        findUnique: vi.fn().mockResolvedValue({ value: 3 }),
        upsert: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      partner: {
        findUnique: vi.fn().mockResolvedValue({ id: "referrer-partner-1", createdAt: new Date() }),
      },
    } as unknown as Prisma.TransactionClient;

    const result = await checkAndQualifyOrder("order-3", mockDb);
    expect(result.qualified).toBe(true);
    if (result.qualified) {
      expect(result.referrerPartnerId).toBe("referrer-partner-1");
      expect(result.attributionId).toBe("attr-1");
    }
    expect(mockDb.referralAttribution.updateMany).toHaveBeenCalledWith({
      where: {
        id: "attr-1",
        status: "PENDING_QUALIFICATION",
      },
      data: expect.objectContaining({
        status: "QUALIFIED",
        qualifyingOrderId: "order-3",
      }),
    });
  });

  it("rejects non-delivered orders even if total count is 3", async () => {
    const pendingOrder = { ...mockOrder, status: "SHIPPED" };
    const mockDb = {
      order: {
        findUnique: vi.fn().mockResolvedValue(pendingOrder),
      },
    } as unknown as Prisma.TransactionClient;

    const result = await checkAndQualifyOrder("order-pending", mockDb);
    expect(result.qualified).toBe(false);
    if (!result.qualified) {
      expect(result.reason).toBe("ORDER_NOT_DELIVERED");
    }
  });

  it("returns ALREADY_QUALIFIED if attribution is already qualified", async () => {
    const qualifiedAttribution = { ...mockAttribution, status: "QUALIFIED" };
    const mockDb = {
      order: {
        findUnique: vi.fn().mockResolvedValue(mockOrder),
      },
      referralAttribution: {
        findUnique: vi.fn().mockResolvedValue(qualifiedAttribution),
      },
    } as unknown as Prisma.TransactionClient;

    const result = await checkAndQualifyOrder("order-3", mockDb);
    expect(result.qualified).toBe(false);
    if (!result.qualified) {
      expect(result.reason).toBe("ALREADY_QUALIFIED");
    }
  });

  it("Option A - Droits Acquis: strictly preserves legacy QUALIFIED attributions in countDirectQualifiedReferrals", async () => {
    const mockDb = {
      referralAttribution: {
        count: vi.fn().mockResolvedValue(5), // 5 previously qualified referrals
      },
    } as unknown as Prisma.TransactionClient;

    const count = await countDirectQualifiedReferrals("referrer-partner-1", mockDb);
    expect(count).toBe(5);
    expect(mockDb.referralAttribution.count).toHaveBeenCalledWith({
      where: {
        referrerPartnerId: "referrer-partner-1",
        status: "QUALIFIED",
      },
    });
  });
});
