import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  checkAndQualifyOrder,
  checkAndQualifyReferral,
  type QualifyOrderResult,
} from "@/modules/referrals/qualification";
import { SETTING_KEYS } from "@/modules/settings/defaults";

describe("Adversarial Empirical Challenger: checkAndQualifyOrder Invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // 1. Non-Qualifying Status Invariants
  // ==========================================================================
  describe("1. Non-Qualifying Status Combinations", () => {
    it("REJECTS when order is DELIVERED but earningStatus is PENDING", async () => {
      const mockOrder = {
        id: "ord-delivered-pending-earning",
        partnerId: "partner-ref-1",
        status: "DELIVERED",
        earningStatus: "PENDING",
      };

      const mockDb = {
        order: { findUnique: vi.fn().mockResolvedValue(mockOrder) },
        referralAttribution: {
          findUnique: vi.fn(),
          updateMany: vi.fn(),
        },
        auditLog: { create: vi.fn() },
      } as unknown as Prisma.TransactionClient;

      const result = await checkAndQualifyOrder("ord-delivered-pending-earning", mockDb);

      expect(result.qualified).toBe(false);
      expect(result.reason).toBe("EARNING_NOT_AVAILABLE");
      // Attribution must not be looked up or updated
      expect(mockDb.referralAttribution.findUnique).not.toHaveBeenCalled();
      expect(mockDb.referralAttribution.updateMany).not.toHaveBeenCalled();
      expect(mockDb.auditLog.create).not.toHaveBeenCalled();
    });

    it("REJECTS when order is DELIVERED but earningStatus is NONE or REVERSED", async () => {
      for (const earningStatus of ["NONE", "REVERSED"]) {
        const mockOrder = {
          id: `ord-delivered-${earningStatus.toLowerCase()}`,
          partnerId: "partner-ref-1",
          status: "DELIVERED",
          earningStatus,
        };

        const mockDb = {
          order: { findUnique: vi.fn().mockResolvedValue(mockOrder) },
          referralAttribution: { updateMany: vi.fn() },
          auditLog: { create: vi.fn() },
        } as unknown as Prisma.TransactionClient;

        const result = await checkAndQualifyOrder(mockOrder.id, mockDb);

        expect(result.qualified).toBe(false);
        expect(result.reason).toBe("EARNING_NOT_AVAILABLE");
        expect(mockDb.referralAttribution.updateMany).not.toHaveBeenCalled();
        expect(mockDb.auditLog.create).not.toHaveBeenCalled();
      }
    });

    it("REJECTS when order is SHIPPED even if earningStatus is AVAILABLE", async () => {
      const mockOrder = {
        id: "ord-shipped-available",
        partnerId: "partner-ref-1",
        status: "SHIPPED",
        earningStatus: "AVAILABLE",
      };

      const mockDb = {
        order: { findUnique: vi.fn().mockResolvedValue(mockOrder) },
        referralAttribution: {
          findUnique: vi.fn(),
          updateMany: vi.fn(),
        },
        auditLog: { create: vi.fn() },
      } as unknown as Prisma.TransactionClient;

      const result = await checkAndQualifyOrder("ord-shipped-available", mockDb);

      expect(result.qualified).toBe(false);
      expect(result.reason).toBe("ORDER_NOT_DELIVERED");
      expect(mockDb.referralAttribution.findUnique).not.toHaveBeenCalled();
      expect(mockDb.referralAttribution.updateMany).not.toHaveBeenCalled();
      expect(mockDb.auditLog.create).not.toHaveBeenCalled();
    });

    it("REJECTS for CONFIRMED, VALIDATED, PREPARING, IN_DELIVERY, RETURNED, REFUSED, CANCELLED", async () => {
      const nonDeliveredStatuses = [
        "CONFIRMED",
        "VALIDATED",
        "ON_HOLD",
        "PREPARING",
        "PACKAGED",
        "IN_DELIVERY",
        "RETURNED",
        "REFUSED",
        "CANCELLED",
      ];

      for (const status of nonDeliveredStatuses) {
        const mockOrder = {
          id: `ord-${status.toLowerCase()}`,
          partnerId: "partner-ref-1",
          status,
          earningStatus: "AVAILABLE",
        };

        const mockDb = {
          order: { findUnique: vi.fn().mockResolvedValue(mockOrder) },
          referralAttribution: { updateMany: vi.fn() },
          auditLog: { create: vi.fn() },
        } as unknown as Prisma.TransactionClient;

        const result = await checkAndQualifyOrder(mockOrder.id, mockDb);

        expect(result.qualified).toBe(false);
        expect(result.reason).toBe("ORDER_NOT_DELIVERED");
        expect(mockDb.referralAttribution.updateMany).not.toHaveBeenCalled();
      }
    });
  });

  // ==========================================================================
  // 2. Unreferred Partners (No Attribution Record)
  // ==========================================================================
  describe("2. Unreferred Partners", () => {
    it("returns NO_ATTRIBUTION when partner registered organically without referral", async () => {
      const mockOrder = {
        id: "ord-organic-partner",
        partnerId: "organic-partner-id",
        status: "DELIVERED",
        earningStatus: "AVAILABLE",
      };

      const mockDb = {
        order: { findUnique: vi.fn().mockResolvedValue(mockOrder) },
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue(null), // No attribution
          updateMany: vi.fn(),
        },
        auditLog: { create: vi.fn() },
      } as unknown as Prisma.TransactionClient;

      const result = await checkAndQualifyOrder("ord-organic-partner", mockDb);

      expect(result.qualified).toBe(false);
      expect(result.reason).toBe("NO_ATTRIBUTION");
      expect(mockDb.referralAttribution.updateMany).not.toHaveBeenCalled();
      expect(mockDb.auditLog.create).not.toHaveBeenCalled();
    });

    it("returns ORDER_NOT_FOUND when order does not exist", async () => {
      const mockDb = {
        order: { findUnique: vi.fn().mockResolvedValue(null) },
        referralAttribution: { updateMany: vi.fn() },
      } as unknown as Prisma.TransactionClient;

      const result = await checkAndQualifyOrder("non-existent-order", mockDb);

      expect(result.qualified).toBe(false);
      expect(result.reason).toBe("ORDER_NOT_FOUND");
      expect(mockDb.referralAttribution.updateMany).not.toHaveBeenCalled();
    });

    it("returns ORDER_HAS_NO_PARTNER when order has no associated partner", async () => {
      const mockOrder = {
        id: "ord-no-partner",
        partnerId: null,
        status: "DELIVERED",
        earningStatus: "AVAILABLE",
      };

      const mockDb = {
        order: { findUnique: vi.fn().mockResolvedValue(mockOrder) },
        referralAttribution: { updateMany: vi.fn() },
      } as unknown as Prisma.TransactionClient;

      const result = await checkAndQualifyOrder("ord-no-partner", mockDb);

      expect(result.qualified).toBe(false);
      expect(result.reason).toBe("ORDER_HAS_NO_PARTNER");
      expect(mockDb.referralAttribution.updateMany).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 3. Idempotency & Subsequent Orders from Same Referred Partner
  // ==========================================================================
  describe("3. Idempotency and Re-Qualification Attempts", () => {
    it("subsequent orders from the same referred partner return ALREADY_QUALIFIED", async () => {
      // Order 2 arrives after Order 1 already qualified the partner
      const mockOrder2 = {
        id: "ord-second",
        partnerId: "referred-partner-p1",
        status: "DELIVERED",
        earningStatus: "AVAILABLE",
      };

      const mockAlreadyQualifiedAttribution = {
        id: "attr-p1",
        referrerPartnerId: "referrer-mentor-1",
        referredPartnerId: "referred-partner-p1",
        status: "QUALIFIED",
        qualifyingOrderId: "ord-first",
        qualifiedAt: new Date("2026-03-01T10:00:00Z"),
      };

      const mockDb = {
        order: { findUnique: vi.fn().mockResolvedValue(mockOrder2) },
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue(mockAlreadyQualifiedAttribution),
          updateMany: vi.fn(),
        },
        auditLog: { create: vi.fn() },
      } as unknown as Prisma.TransactionClient;

      const result = await checkAndQualifyOrder("ord-second", mockDb);

      expect(result.qualified).toBe(false);
      expect(result.reason).toBe("ALREADY_QUALIFIED");
      expect(result.referrerPartnerId).toBe("referrer-mentor-1");
      expect(result.attributionId).toBe("attr-p1");

      // Invariant: no database update occurs
      expect(mockDb.referralAttribution.updateMany).not.toHaveBeenCalled();
      expect(mockDb.auditLog.create).not.toHaveBeenCalled();
    });

    it("retry of the qualifying order itself returns ALREADY_QUALIFIED idempotently", async () => {
      const mockOrder1 = {
        id: "ord-first",
        partnerId: "referred-partner-p1",
        status: "DELIVERED",
        earningStatus: "AVAILABLE",
      };

      const mockAlreadyQualifiedAttribution = {
        id: "attr-p1",
        referrerPartnerId: "referrer-mentor-1",
        referredPartnerId: "referred-partner-p1",
        status: "QUALIFIED",
        qualifyingOrderId: "ord-first",
        qualifiedAt: new Date("2026-03-01T10:00:00Z"),
      };

      const mockDb = {
        order: { findUnique: vi.fn().mockResolvedValue(mockOrder1) },
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue(mockAlreadyQualifiedAttribution),
          updateMany: vi.fn(),
        },
        auditLog: { create: vi.fn() },
      } as unknown as Prisma.TransactionClient;

      const retryResult = await checkAndQualifyOrder("ord-first", mockDb);

      expect(retryResult.qualified).toBe(false);
      expect(retryResult.reason).toBe("ALREADY_QUALIFIED");
      expect(retryResult.referrerPartnerId).toBe("referrer-mentor-1");
      expect(mockDb.referralAttribution.updateMany).not.toHaveBeenCalled();
    });

    it("handles concurrent qualifying race conditions: updateMany returning 0 rows returns ALREADY_QUALIFIED", async () => {
      // In a concurrent execution, two orders for the same partner settle simultaneously.
      // Both find the attribution in PENDING_QUALIFICATION.
      // But only the first updateMany succeeds (count: 1); the second sees count: 0.
      const mockOrderRace = {
        id: "ord-race-loser",
        partnerId: "referred-partner-race",
        status: "DELIVERED",
        earningStatus: "AVAILABLE",
      };

      const mockAttribution = {
        id: "attr-race",
        referrerPartnerId: "referrer-race",
        referredPartnerId: "referred-partner-race",
        status: "PENDING_QUALIFICATION",
      };

      const mockDb = {
        order: { findUnique: vi.fn().mockResolvedValue(mockOrderRace) },
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue(mockAttribution),
          // updateMany fails to update because another concurrent transaction updated it first
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        auditLog: { create: vi.fn() },
      } as unknown as Prisma.TransactionClient;

      const result = await checkAndQualifyOrder("ord-race-loser", mockDb);

      expect(result.qualified).toBe(false);
      expect(result.reason).toBe("ALREADY_QUALIFIED");
      expect(result.referrerPartnerId).toBe("referrer-race");
      expect(result.attributionId).toBe("attr-race");
      // Must NOT record audit log for the loser of the race
      expect(mockDb.auditLog.create).not.toHaveBeenCalled();
    });

    it("returns ATTRIBUTION_REJECTED if attribution status is REJECTED", async () => {
      const mockOrder = {
        id: "ord-rejected-attr",
        partnerId: "referred-partner-rejected",
        status: "DELIVERED",
        earningStatus: "AVAILABLE",
      };

      const mockRejectedAttribution = {
        id: "attr-rejected",
        referrerPartnerId: "referrer-1",
        referredPartnerId: "referred-partner-rejected",
        status: "REJECTED",
      };

      const mockDb = {
        order: { findUnique: vi.fn().mockResolvedValue(mockOrder) },
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue(mockRejectedAttribution),
          updateMany: vi.fn(),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await checkAndQualifyOrder("ord-rejected-attr", mockDb);

      expect(result.qualified).toBe(false);
      expect(result.reason).toBe("ATTRIBUTION_REJECTED");
      expect(result.referrerPartnerId).toBe("referrer-1");
      expect(result.attributionId).toBe("attr-rejected");
      expect(mockDb.referralAttribution.updateMany).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 4. Positive Qualification & Side Effects
  // ==========================================================================
  describe("4. Positive Qualification and Invariant Guarantees", () => {
    it("successfully qualifies when DELIVERED + AVAILABLE + PENDING_QUALIFICATION", async () => {
      const mockOrder = {
        id: "ord-winner",
        partnerId: "referred-p1",
        status: "DELIVERED",
        earningStatus: "AVAILABLE",
      };

      const mockAttribution = {
        id: "attr-winner",
        referrerPartnerId: "referrer-p1",
        referredPartnerId: "referred-p1",
        status: "PENDING_QUALIFICATION",
      };

      const mockDb = {
        order: { findUnique: vi.fn().mockResolvedValue(mockOrder) },
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue(mockAttribution),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
        systemSetting: {
          findUnique: vi.fn().mockResolvedValue({ value: false }), // Auto-promotion disabled
        },
      } as unknown as Prisma.TransactionClient;

      const result = await checkAndQualifyOrder("ord-winner", mockDb);

      expect(result.qualified).toBe(true);
      if (result.qualified) {
        expect(result.referrerPartnerId).toBe("referrer-p1");
        expect(result.attributionId).toBe("attr-winner");
      }

      // Exact update payload check
      expect(mockDb.referralAttribution.updateMany).toHaveBeenCalledWith({
        where: {
          id: "attr-winner",
          status: "PENDING_QUALIFICATION",
        },
        data: {
          status: "QUALIFIED",
          qualifyingOrderId: "ord-winner",
          qualifiedAt: expect.any(Date),
        },
      });

      // Exact audit log payload check
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "REFERRAL_QUALIFIED",
          entityType: "ReferralAttribution",
          entityId: "attr-winner",
          before: { status: "PENDING_QUALIFICATION" },
          after: expect.objectContaining({
            status: "QUALIFIED",
            qualifyingOrderId: "ord-winner",
            referrerPartnerId: "referrer-p1",
            referredPartnerId: "referred-p1",
          }),
        }),
      });
    });

    it("triggers level evaluation when autoPromotionEnabled is true", async () => {
      const mockOrder = {
        id: "ord-winner-autopromo",
        partnerId: "referred-p2",
        status: "DELIVERED",
        earningStatus: "AVAILABLE",
      };

      const mockAttribution = {
        id: "attr-winner-autopromo",
        referrerPartnerId: "referrer-p2",
        referredPartnerId: "referred-p2",
        status: "PENDING_QUALIFICATION",
      };

      let settingsUpsertCalled = false;
      const mockDb = {
        order: { findUnique: vi.fn().mockResolvedValue(mockOrder) },
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue(mockAttribution),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          count: vi.fn().mockResolvedValue(3), // 3 qualified referrals
        },
        auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
        partner: {
          findUnique: vi.fn().mockResolvedValue({ id: "referrer-p2", createdAt: new Date() }),
        },
        systemSetting: {
          findUnique: vi.fn().mockImplementation(({ where: { key } }) => {
            if (key === SETTING_KEYS.REFERRAL_AUTO_PROMOTION_ENABLED) {
              return Promise.resolve({ value: true }); // AUTO PROMOTION ENABLED!
            }
            return Promise.resolve(null);
          }),
          upsert: vi.fn().mockImplementation(() => {
            settingsUpsertCalled = true;
            return Promise.resolve({});
          }),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await checkAndQualifyOrder("ord-winner-autopromo", mockDb);

      expect(result.qualified).toBe(true);
      // Auto promotion was evaluated because autoPromotionEnabled was true
      expect(settingsUpsertCalled).toBe(true);
    });

    it("PROJECT.md contract alias checkAndQualifyReferral conforms identically", async () => {
      const mockOrder = {
        id: "ord-contract-alias",
        partnerId: "referred-alias",
        status: "DELIVERED",
        earningStatus: "AVAILABLE",
      };

      const mockAttribution = {
        id: "attr-contract-alias",
        referrerPartnerId: "referrer-alias",
        referredPartnerId: "referred-alias",
        status: "PENDING_QUALIFICATION",
      };

      const mockDb = {
        order: { findUnique: vi.fn().mockResolvedValue(mockOrder) },
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue(mockAttribution),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
        systemSetting: { findUnique: vi.fn().mockResolvedValue(null) },
      } as unknown as Prisma.TransactionClient;

      const result = await checkAndQualifyReferral(mockDb, "ord-contract-alias");

      expect(result.qualified).toBe(true);
      if (result.qualified) {
        expect(result.referrerPartnerId).toBe("referrer-alias");
        expect(result.attributionId).toBe("attr-contract-alias");
      }
    });
  });

  // ==========================================================================
  // 5. Stress Simulation: Multi-Order Batch Settlement
  // ==========================================================================
  describe("5. Multi-Order Batch Settlement Invariants", () => {
    it("processes a realistic batch of mixed orders without over-qualifying or cross-leaking", async () => {
      // Setup batch:
      // Order 1: Partner A (Referred, Pending) -> QUALIFIES
      // Order 2: Partner A (Referred, 2nd order) -> ALREADY_QUALIFIED
      // Order 3: Partner B (Organic, unreferred) -> NO_ATTRIBUTION
      // Order 4: Partner C (Referred, Shipped not Delivered) -> ORDER_NOT_DELIVERED
      // Order 5: Partner D (Referred, Delivered but Earning Pending) -> EARNING_NOT_AVAILABLE

      const dbOrders: Record<string, any> = {
        "ord-1": { id: "ord-1", partnerId: "partner-A", status: "DELIVERED", earningStatus: "AVAILABLE" },
        "ord-2": { id: "ord-2", partnerId: "partner-A", status: "DELIVERED", earningStatus: "AVAILABLE" },
        "ord-3": { id: "ord-3", partnerId: "partner-B", status: "DELIVERED", earningStatus: "AVAILABLE" },
        "ord-4": { id: "ord-4", partnerId: "partner-C", status: "SHIPPED", earningStatus: "AVAILABLE" },
        "ord-5": { id: "ord-5", partnerId: "partner-D", status: "DELIVERED", earningStatus: "PENDING" },
      };

      const dbAttributions: Record<string, any> = {
        "partner-A": {
          id: "attr-A",
          referrerPartnerId: "referrer-mentor",
          referredPartnerId: "partner-A",
          status: "PENDING_QUALIFICATION",
        },
        // partner-B has no attribution (organic)
        "partner-C": {
          id: "attr-C",
          referrerPartnerId: "referrer-mentor",
          referredPartnerId: "partner-C",
          status: "PENDING_QUALIFICATION",
        },
        "partner-D": {
          id: "attr-D",
          referrerPartnerId: "referrer-mentor",
          referredPartnerId: "partner-D",
          status: "PENDING_QUALIFICATION",
        },
      };

      const auditLogs: any[] = [];

      const mockDb = {
        order: {
          findUnique: vi.fn().mockImplementation(({ where: { id } }) => Promise.resolve(dbOrders[id] ?? null)),
        },
        referralAttribution: {
          findUnique: vi.fn().mockImplementation(({ where: { referredPartnerId } }) =>
            Promise.resolve(dbAttributions[referredPartnerId] ?? null),
          ),
          updateMany: vi.fn().mockImplementation(({ where: { id, status }, data }) => {
            const attr = Object.values(dbAttributions).find((a) => a.id === id);
            if (attr && attr.status === status) {
              Object.assign(attr, data);
              return Promise.resolve({ count: 1 });
            }
            return Promise.resolve({ count: 0 });
          }),
        },
        auditLog: {
          create: vi.fn().mockImplementation(({ data }) => {
            auditLogs.push(data);
            return Promise.resolve({ id: `audit-${auditLogs.length}` });
          }),
        },
        systemSetting: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      } as unknown as Prisma.TransactionClient;

      // Execute order 1
      const res1 = await checkAndQualifyOrder("ord-1", mockDb);
      expect(res1.qualified).toBe(true);
      expect(dbAttributions["partner-A"].status).toBe("QUALIFIED");

      // Execute order 2 (same partner A)
      const res2 = await checkAndQualifyOrder("ord-2", mockDb);
      expect(res2.qualified).toBe(false);
      expect(res2.reason).toBe("ALREADY_QUALIFIED");

      // Execute order 3 (organic partner B)
      const res3 = await checkAndQualifyOrder("ord-3", mockDb);
      expect(res3.qualified).toBe(false);
      expect(res3.reason).toBe("NO_ATTRIBUTION");

      // Execute order 4 (shipped partner C)
      const res4 = await checkAndQualifyOrder("ord-4", mockDb);
      expect(res4.qualified).toBe(false);
      expect(res4.reason).toBe("ORDER_NOT_DELIVERED");
      expect(dbAttributions["partner-C"].status).toBe("PENDING_QUALIFICATION");

      // Execute order 5 (pending earning partner D)
      const res5 = await checkAndQualifyOrder("ord-5", mockDb);
      expect(res5.qualified).toBe(false);
      expect(res5.reason).toBe("EARNING_NOT_AVAILABLE");
      expect(dbAttributions["partner-D"].status).toBe("PENDING_QUALIFICATION");

      // Crucial invariant: Exactly 1 attribution qualified across the entire batch
      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].action).toBe("REFERRAL_QUALIFIED");
      expect(auditLogs[0].entityId).toBe("attr-A");
    });
  });
});
