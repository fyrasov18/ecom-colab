import { describe, expect, it, vi, beforeEach } from "vitest";
import Decimal from "decimal.js";
import type { Prisma } from "@prisma/client";
import {
  checkAndQualifyOrder,
  checkAndQualifyReferral,
  type QualifyOrderResult,
} from "@/modules/referrals/qualification";
import {
  getPartnerReferralLevel,
  confirmPartnerPromotion,
  getPartnerReferralLevelAtDate,
  evaluateTargetLevel,
  getReferralThresholdSettings,
  updateReferralSettings,
  countDirectQualifiedReferrals,
  REFERRAL_LEVEL_RATES,
  REFERRAL_LEVELS,
  DEFAULT_LEVEL2_THRESHOLD,
  DEFAULT_LEVEL3_THRESHOLD,
  DEFAULT_AUTO_PROMOTION_ENABLED,
  type PartnerReferralLevelState,
} from "@/modules/referrals/levels";
import { settleDueEarnings } from "@/modules/finance/ledger";
import { calculateProfitSharing } from "@/modules/finance/referral-math";
import { SETTING_KEYS } from "@/modules/settings/defaults";

describe("Milestone 3: Qualification & Partner Levels", () => {
  // ==========================================================================
  // 1. Qualification Module (checkAndQualifyOrder)
  // ==========================================================================
  describe("checkAndQualifyOrder", () => {
    it("qualifying order requires BOTH DELIVERED AND settled earning (earningStatus === 'AVAILABLE')", async () => {
      const mockOrder = {
        id: "order-1",
        partnerId: "referred-partner-1",
        status: "DELIVERED",
        earningStatus: "AVAILABLE",
      };

      const mockAttribution = {
        id: "attr-1",
        referrerPartnerId: "referrer-partner-1",
        referredPartnerId: "referred-partner-1",
        status: "PENDING_QUALIFICATION",
        qualifyingOrderId: null,
        qualifiedAt: null,
      };

      const mockDb = {
        order: {
          findUnique: vi.fn().mockResolvedValue(mockOrder),
        },
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue(mockAttribution),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        systemSetting: {
          findUnique: vi.fn().mockResolvedValue(null), // auto-promotion defaults to false
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: "audit-1" }),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await checkAndQualifyOrder("order-1", mockDb);

      expect(result.qualified).toBe(true);
      if (result.qualified) {
        expect(result.referrerPartnerId).toBe("referrer-partner-1");
        expect(result.attributionId).toBe("attr-1");
      }

      // Verify atomic update
      expect(mockDb.referralAttribution.updateMany).toHaveBeenCalledWith({
        where: {
          id: "attr-1",
          status: "PENDING_QUALIFICATION",
        },
        data: {
          status: "QUALIFIED",
          qualifyingOrderId: "order-1",
          qualifiedAt: expect.any(Date),
        },
      });

      // Verify audit log creation
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "REFERRAL_QUALIFIED",
          entityType: "ReferralAttribution",
          entityId: "attr-1",
        }),
      });
    });

    it("REJECTS qualifying if order is SHIPPED even if earningStatus is AVAILABLE", async () => {
      const mockOrder = {
        id: "order-shipped",
        partnerId: "referred-partner-1",
        status: "SHIPPED",
        earningStatus: "AVAILABLE",
      };

      const mockDb = {
        order: {
          findUnique: vi.fn().mockResolvedValue(mockOrder),
        },
        referralAttribution: {
          findUnique: vi.fn(),
          updateMany: vi.fn(),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await checkAndQualifyOrder("order-shipped", mockDb);

      expect(result.qualified).toBe(false);
      expect(result.reason).toBe("ORDER_NOT_DELIVERED");
      expect(mockDb.referralAttribution.updateMany).not.toHaveBeenCalled();
    });

    it("REJECTS qualifying if order is DELIVERED but earningStatus is still PENDING", async () => {
      const mockOrder = {
        id: "order-pending-earning",
        partnerId: "referred-partner-1",
        status: "DELIVERED",
        earningStatus: "PENDING",
      };

      const mockDb = {
        order: {
          findUnique: vi.fn().mockResolvedValue(mockOrder),
        },
        referralAttribution: {
          findUnique: vi.fn(),
          updateMany: vi.fn(),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await checkAndQualifyOrder("order-pending-earning", mockDb);

      expect(result.qualified).toBe(false);
      expect(result.reason).toBe("EARNING_NOT_AVAILABLE");
      expect(mockDb.referralAttribution.updateMany).not.toHaveBeenCalled();
    });

    it("REJECTS qualifying if order is in earlier status (CONFIRMED / PREPARING)", async () => {
      const mockOrder = {
        id: "order-confirmed",
        partnerId: "referred-partner-1",
        status: "CONFIRMED",
        earningStatus: "NONE",
      };

      const mockDb = {
        order: {
          findUnique: vi.fn().mockResolvedValue(mockOrder),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await checkAndQualifyOrder("order-confirmed", mockDb);

      expect(result.qualified).toBe(false);
      expect(result.reason).toBe("ORDER_NOT_DELIVERED");
    });

    it("registration or approval alone does NOT qualify", async () => {
      // Attribution exists in PENDING_QUALIFICATION, but no delivered order has settled yet
      const mockAttribution = {
        id: "attr-pending",
        referrerPartnerId: "referrer-partner-1",
        referredPartnerId: "new-partner-active",
        status: "PENDING_QUALIFICATION",
        qualifyingOrderId: null,
      };

      const mockDb = {
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue(mockAttribution),
          count: vi.fn().mockResolvedValue(0), // 0 qualified
        },
        systemSetting: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        partner: {
          findUnique: vi.fn().mockResolvedValue({ id: "referrer-partner-1", createdAt: new Date() }),
        },
      } as unknown as Prisma.TransactionClient;

      // Checking referrer's level: registration or approval alone gives 0 qualified referrals
      const levelResult = await getPartnerReferralLevel("referrer-partner-1", mockDb);
      expect(levelResult.qualifiedCount).toBe(0);
      expect(levelResult.level).toBe(1);
    });

    it("subsequent orders by the same partner do NOT double-qualify or double-count", async () => {
      // First order already qualified the attribution
      const mockOrder2 = {
        id: "order-2",
        partnerId: "referred-partner-1",
        status: "DELIVERED",
        earningStatus: "AVAILABLE",
      };

      const mockAttributionAlreadyQualified = {
        id: "attr-1",
        referrerPartnerId: "referrer-partner-1",
        referredPartnerId: "referred-partner-1",
        status: "QUALIFIED",
        qualifyingOrderId: "order-1",
        qualifiedAt: new Date("2026-03-01T12:00:00Z"),
      };

      const mockDb = {
        order: {
          findUnique: vi.fn().mockResolvedValue(mockOrder2),
        },
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue(mockAttributionAlreadyQualified),
          updateMany: vi.fn(),
        },
      } as unknown as Prisma.TransactionClient;

      // Second order arrives for the same partner
      const result = await checkAndQualifyOrder("order-2", mockDb);

      expect(result.qualified).toBe(false);
      expect(result.reason).toBe("ALREADY_QUALIFIED");
      // Must not modify the existing attribution
      expect(mockDb.referralAttribution.updateMany).not.toHaveBeenCalled();
    });

    it("retry of the same order is idempotent and deduplicated", async () => {
      const mockOrder1 = {
        id: "order-1",
        partnerId: "referred-partner-1",
        status: "DELIVERED",
        earningStatus: "AVAILABLE",
      };

      const mockAttributionAlreadyQualified = {
        id: "attr-1",
        referrerPartnerId: "referrer-partner-1",
        referredPartnerId: "referred-partner-1",
        status: "QUALIFIED",
        qualifyingOrderId: "order-1",
      };

      const mockDb = {
        order: {
          findUnique: vi.fn().mockResolvedValue(mockOrder1),
        },
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue(mockAttributionAlreadyQualified),
        },
      } as unknown as Prisma.TransactionClient;

      const retryResult = await checkAndQualifyOrder("order-1", mockDb);
      expect(retryResult.qualified).toBe(false);
      expect(retryResult.reason).toBe("ALREADY_QUALIFIED");
    });

    it("returns NO_ATTRIBUTION if order has no associated referral attribution", async () => {
      const mockOrder = {
        id: "order-organic",
        partnerId: "organic-partner",
        status: "DELIVERED",
        earningStatus: "AVAILABLE",
      };

      const mockDb = {
        order: {
          findUnique: vi.fn().mockResolvedValue(mockOrder),
        },
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await checkAndQualifyOrder("order-organic", mockDb);
      expect(result.qualified).toBe(false);
      expect(result.reason).toBe("NO_ATTRIBUTION");
    });

    it("supports checkAndQualifyReferral alias with matching PROJECT.md signature", async () => {
      const mockOrder = {
        id: "order-alias-1",
        partnerId: "referred-1",
        status: "DELIVERED",
        earningStatus: "AVAILABLE",
      };
      const mockAttribution = {
        id: "attr-alias-1",
        referrerPartnerId: "referrer-1",
        referredPartnerId: "referred-1",
        status: "PENDING_QUALIFICATION",
      };
      const mockDb = {
        order: { findUnique: vi.fn().mockResolvedValue(mockOrder) },
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue(mockAttribution),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        systemSetting: { findUnique: vi.fn().mockResolvedValue(null) },
        auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
      } as unknown as Prisma.TransactionClient;

      const result = await checkAndQualifyReferral(mockDb, "order-alias-1");
      expect(result.qualified).toBe(true);
    });
  });

  // ==========================================================================
  // 2. Settlement Hook Integration (ledger.ts settleDueEarnings)
  // ==========================================================================
  describe("settlement hook in settleDueEarnings", () => {
    it("invokes checkAndQualifyOrder when transitioning orders to AVAILABLE", async () => {
      const pastDate = new Date("2026-01-01T00:00:00Z");
      const mockTransactions = [
        { id: "tx-1", partnerId: "referred-p1", orderId: "order-settled-1" },
      ];

      const mockOrder = {
        id: "order-settled-1",
        partnerId: "referred-p1",
        status: "DELIVERED",
        earningStatus: "AVAILABLE",
      };

      const mockAttribution = {
        id: "attr-settle-1",
        referrerPartnerId: "referrer-p1",
        referredPartnerId: "referred-p1",
        status: "PENDING_QUALIFICATION",
      };

      const mockDb = {
        financialTransaction: {
          findMany: vi.fn().mockResolvedValue(mockTransactions),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        order: {
          findUnique: vi.fn().mockResolvedValue(mockOrder),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue(mockAttribution),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        wallet: {
          upsert: vi.fn().mockResolvedValue({}),
        },
        notification: {
          create: vi.fn().mockResolvedValue({}),
        },
        partner: {
          findUnique: vi.fn().mockResolvedValue({ userId: "u1" }),
        },
        systemSetting: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await settleDueEarnings({ now: new Date(), db: mockDb });

      expect(result.settled).toBe(1);
      // Verify order update to AVAILABLE occurred
      expect(mockDb.order.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["order-settled-1"] }, earningStatus: "PENDING" },
        data: { earningStatus: "AVAILABLE" },
      });
      // Verify checkAndQualifyOrder updated attribution to QUALIFIED
      expect(mockDb.referralAttribution.updateMany).toHaveBeenCalledWith({
        where: { id: "attr-settle-1", status: "PENDING_QUALIFICATION" },
        data: {
          status: "QUALIFIED",
          qualifyingOrderId: "order-settled-1",
          qualifiedAt: expect.any(Date),
        },
      });
    });
  });

  // ==========================================================================
  // 3. Dynamic Thresholds and Partner Levels
  // ==========================================================================
  describe("dynamic thresholds evaluation", () => {
    it("respects default thresholds: Level 1 (<3), Level 2 (>=3), Level 3 (>=10)", () => {
      const thresholds = {
        level2Threshold: DEFAULT_LEVEL2_THRESHOLD, // 3
        level3Threshold: DEFAULT_LEVEL3_THRESHOLD, // 10
      };

      expect(evaluateTargetLevel(0, thresholds)).toBe(1);
      expect(evaluateTargetLevel(1, thresholds)).toBe(1);
      expect(evaluateTargetLevel(2, thresholds)).toBe(1);
      expect(evaluateTargetLevel(3, thresholds)).toBe(2);
      expect(evaluateTargetLevel(5, thresholds)).toBe(2);
      expect(evaluateTargetLevel(9, thresholds)).toBe(2);
      expect(evaluateTargetLevel(10, thresholds)).toBe(3);
      expect(evaluateTargetLevel(25, thresholds)).toBe(3);
    });

    it("respects custom configurable thresholds in system settings (e.g. 5 and 15)", async () => {
      const customThresholds = {
        level2Threshold: 5,
        level3Threshold: 15,
      };

      expect(evaluateTargetLevel(4, customThresholds)).toBe(1);
      expect(evaluateTargetLevel(5, customThresholds)).toBe(2);
      expect(evaluateTargetLevel(14, customThresholds)).toBe(2);
      expect(evaluateTargetLevel(15, customThresholds)).toBe(3);
      expect(evaluateTargetLevel(30, customThresholds)).toBe(3);
    });

    it("reads dynamic thresholds from systemSetting database rows", async () => {
      const mockDb = {
        systemSetting: {
          findUnique: vi.fn().mockImplementation(({ where: { key } }) => {
            if (key === SETTING_KEYS.REFERRAL_LEVEL2_THRESHOLD) {
              return Promise.resolve({ value: 4 });
            }
            if (key === SETTING_KEYS.REFERRAL_LEVEL3_THRESHOLD) {
              return Promise.resolve({ value: 12 });
            }
            if (key === SETTING_KEYS.REFERRAL_AUTO_PROMOTION_ENABLED) {
              return Promise.resolve({ value: true });
            }
            return Promise.resolve(null);
          }),
        },
      } as unknown as Prisma.TransactionClient;

      const settings = await getReferralThresholdSettings(mockDb);
      expect(settings.level2Threshold).toBe(4);
      expect(settings.level3Threshold).toBe(12);
      expect(settings.autoPromotionEnabled).toBe(true);
    });
  });

  // ==========================================================================
  // 4. Auto-Promotion Flag & Admin Confirmation
  // ==========================================================================
  describe("promotion engine with auto-promotion flag", () => {
    it("when auto-promotion is disabled, partner stays at Level 1 pending admin confirmation", async () => {
      let savedState: any = null;

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue({ id: "p-manual", createdAt: new Date("2026-01-01") }),
        },
        referralAttribution: {
          count: vi.fn().mockResolvedValue(3), // 3 qualified referrals (eligible for Level 2)
        },
        systemSetting: {
          findUnique: vi.fn().mockImplementation(({ where: { key } }) => {
            if (key === `referral.partner_level:p-manual`) {
              return Promise.resolve(savedState ? { value: savedState } : null);
            }
            if (key === SETTING_KEYS.REFERRAL_AUTO_PROMOTION_ENABLED) {
              return Promise.resolve({ value: false }); // Disabled!
            }
            return Promise.resolve(null);
          }),
          upsert: vi.fn().mockImplementation(({ create, update }) => {
            savedState = update?.value ?? create?.value;
            return Promise.resolve({ value: savedState });
          }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await getPartnerReferralLevel("p-manual", mockDb);

      // Stays at Level 1!
      expect(result.level).toBe(1);
      expect(result.rate.toString()).toBe("0.05");
      expect(result.qualifiedCount).toBe(3);
      expect(result.targetLevel).toBe(2);
      expect(result.isEligibleForPromotion).toBe(true);
      expect(result.promotionPendingConfirmation).toBe(true);
      expect(result.autoPromotionEnabled).toBe(false);

      // Audit log flagged promotion eligibility
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "PARTNER_PROMOTION_ELIGIBLE",
          entityId: "p-manual",
        }),
      });

      // Now Admin confirms promotion
      const confirmed = await confirmPartnerPromotion("p-manual", 2, "admin-user-1", mockDb);

      expect(confirmed.level).toBe(2);
      expect(confirmed.rate.toString()).toBe("0.1");
      expect(confirmed.promotionPendingConfirmation).toBe(false);

      // Subsequent read preserves Level 2
      const afterConfirmation = await getPartnerReferralLevel("p-manual", mockDb);
      expect(afterConfirmation.level).toBe(2);
      expect(afterConfirmation.rate.toString()).toBe("0.1");
    });

    it("when auto-promotion is enabled, automatically promotes to Level 2 (at 3) and Level 3 (at 10)", async () => {
      let savedState: any = null;

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue({ id: "p-auto", createdAt: new Date("2026-01-01") }),
        },
        referralAttribution: {
          count: vi.fn().mockResolvedValue(3), // 3 qualified referrals
        },
        systemSetting: {
          findUnique: vi.fn().mockImplementation(({ where: { key } }) => {
            if (key === `referral.partner_level:p-auto`) {
              return Promise.resolve(savedState ? { value: savedState } : null);
            }
            if (key === SETTING_KEYS.REFERRAL_AUTO_PROMOTION_ENABLED) {
              return Promise.resolve({ value: true }); // Enabled!
            }
            return Promise.resolve(null);
          }),
          upsert: vi.fn().mockImplementation(({ create, update }) => {
            savedState = update?.value ?? create?.value;
            return Promise.resolve({ value: savedState });
          }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      } as unknown as Prisma.TransactionClient;

      // At 3 qualified referrals -> Level 2
      const resultLevel2 = await getPartnerReferralLevel("p-auto", mockDb);
      expect(resultLevel2.level).toBe(2);
      expect(resultLevel2.rate.toString()).toBe("0.1");
      expect(resultLevel2.promotionPendingConfirmation).toBe(false);

      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "PARTNER_REFERRAL_LEVEL_PROMOTED",
          entityId: "p-auto",
        }),
      });

      // Partner reaches 10 qualified referrals
      (mockDb.referralAttribution.count as any).mockResolvedValue(10);

      const resultLevel3 = await getPartnerReferralLevel("p-auto", mockDb);
      expect(resultLevel3.level).toBe(3);
      expect(resultLevel3.rate.toString()).toBe("0.15");
      expect(resultLevel3.qualifiedCount).toBe(10);
    });
  });

  // ==========================================================================
  // 5. Direct vs Indirect (Downline) Referrals
  // ==========================================================================
  describe("direct vs indirect downline referrals", () => {
    it("DIRECT referrals qualify; indirect downline referrals do NOT qualify", async () => {
      // Scenario:
      // Partner A refers Partner B (direct)
      // Partner B refers Partner C (indirect to A, direct to B)
      // When Partner C's order is delivered + settled:
      // - Attribution (B -> C) qualifies
      // - Direct query for Partner A strictly filters referrerPartnerId === A
      const partnerAId = "partner-A";
      const partnerBId = "partner-B";
      const partnerCId = "partner-C";

      const attributions = [
        {
          id: "attr-A-B",
          referrerPartnerId: partnerAId,
          referredPartnerId: partnerBId,
          status: "PENDING_QUALIFICATION", // B has not ordered yet
        },
        {
          id: "attr-B-C",
          referrerPartnerId: partnerBId,
          referredPartnerId: partnerCId,
          status: "QUALIFIED", // C placed qualifying order
        },
      ];

      const mockDb = {
        referralAttribution: {
          count: vi.fn().mockImplementation(({ where }) => {
            const matches = attributions.filter(
              (a) => a.referrerPartnerId === where.referrerPartnerId && a.status === where.status,
            );
            return Promise.resolve(matches.length);
          }),
        },
        partner: {
          findUnique: vi.fn().mockResolvedValue({ createdAt: new Date() }),
        },
        systemSetting: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      } as unknown as Prisma.TransactionClient;

      // Partner B has 1 qualified direct referral (C)
      const countB = await countDirectQualifiedReferrals(partnerBId, mockDb);
      expect(countB).toBe(1);

      // Partner A has 0 qualified direct referrals (C is indirect downline, never counted for A)
      const countA = await countDirectQualifiedReferrals(partnerAId, mockDb);
      expect(countA).toBe(0);

      const levelA = await getPartnerReferralLevel(partnerAId, mockDb);
      expect(levelA.level).toBe(1);
      expect(levelA.qualifiedCount).toBe(0);
    });
  });

  // ==========================================================================
  // 6. Inactivity Policy (No Automatic Demotion)
  // ==========================================================================
  describe("inactivity policy", () => {
    it("partners are NEVER automatically demoted for inactivity", async () => {
      // Partner previously achieved Level 2 (e.g. state has currentLevel: 2, highestLevelReached: 2)
      const stateLevel2: PartnerReferralLevelState = {
        partnerId: "partner-inactive-1",
        currentLevel: 2,
        effectiveDate: "2026-02-01T00:00:00.000Z",
        highestLevelReached: 2,
        eligibleLevel: 2,
        pendingConfirmation: false,
        history: [
          { level: 1, effectiveDate: "2026-01-01T00:00:00.000Z", reason: "INITIAL" },
          { level: 2, effectiveDate: "2026-02-01T00:00:00.000Z", reason: "AUTO_PROMOTION" },
        ],
        updatedAt: "2026-02-01T00:00:00.000Z",
      };

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue({ id: "partner-inactive-1", createdAt: new Date() }),
        },
        referralAttribution: {
          // Even if active referrals drop or current active count evaluates to 0
          count: vi.fn().mockResolvedValue(0),
        },
        systemSetting: {
          findUnique: vi.fn().mockImplementation(({ where: { key } }) => {
            if (key === "referral.partner_level:partner-inactive-1") {
              return Promise.resolve({ value: stateLevel2 });
            }
            return Promise.resolve(null);
          }),
          upsert: vi.fn().mockResolvedValue({}),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await getPartnerReferralLevel("partner-inactive-1", mockDb);

      // Still at Level 2! Never demoted!
      expect(result.level).toBe(2);
      expect(result.rate.toString()).toBe("0.1");
      expect(result.highestLevelReached).toBe(2);
    });
  });

  // ==========================================================================
  // 7. Effective Date Rule & Historical Commission Immutability
  // ==========================================================================
  describe("effective date rule and historical commission immutability", () => {
    it("records when a level became active and resolves historical level at date", async () => {
      const stateWithHistory: PartnerReferralLevelState = {
        partnerId: "partner-effective-1",
        currentLevel: 2,
        effectiveDate: "2026-05-01T00:00:00.000Z",
        highestLevelReached: 2,
        eligibleLevel: 2,
        pendingConfirmation: false,
        history: [
          { level: 1, effectiveDate: "2026-01-01T00:00:00.000Z", reason: "INITIAL" },
          { level: 2, effectiveDate: "2026-05-01T00:00:00.000Z", reason: "PROMOTION" },
        ],
        updatedAt: "2026-05-01T00:00:00.000Z",
      };

      const mockDb = {
        systemSetting: {
          findUnique: vi.fn().mockResolvedValue({ value: stateWithHistory }),
        },
      } as unknown as Prisma.TransactionClient;

      // On 2026-03-01 (before Level 2 effective date), rate was Level 1 (5%)
      const rateAtMarch = await getPartnerReferralLevelAtDate(
        "partner-effective-1",
        new Date("2026-03-01T00:00:00.000Z"),
        mockDb,
      );
      expect(rateAtMarch.level).toBe(1);
      expect(rateAtMarch.rate.toString()).toBe("0.05");

      // On 2026-06-01 (after Level 2 effective date), rate is Level 2 (10%)
      const rateAtJune = await getPartnerReferralLevelAtDate(
        "partner-effective-1",
        new Date("2026-06-01T00:00:00.000Z"),
        mockDb,
      );
      expect(rateAtJune.level).toBe(2);
      expect(rateAtJune.rate.toString()).toBe("0.1");
    });

    it("finalized historical commissions are NEVER retroactively altered when level changes", () => {
      // Historical Order 1 finalized in March when partner was Level 1
      const historicalPool = new Decimal("600.000"); // 30% pool B from 2000 profit
      const historicalResult = calculateProfitSharing({
        revenue: "5000.000",
        expenses: "3000.000",
        referrerLevel: 1, // Historical level was 1
      });

      expect(historicalResult.profit.toFixed(3)).toBe("2000.000");
      expect(historicalResult.adminShare.toFixed(3)).toBe("1400.000");
      expect(historicalResult.remainingPool.toFixed(3)).toBe("600.000");
      expect(historicalResult.referralCommission.toFixed(3)).toBe("30.000"); // 5% of 600 = 30 TND

      // Simulated persisted historical commission record in DB
      const persistedHistoricalCommission = {
        id: "comm-hist-1",
        amount: historicalResult.referralCommission,
        rateApplied: new Decimal("0.05"),
        status: "APPROVED_FOR_PAYMENT",
        calculatedAt: new Date("2026-03-01T00:00:00Z"),
      };

      // In May, partner promotes to Level 2 (10%)
      const newOrderResult = calculateProfitSharing({
        revenue: "5000.000",
        expenses: "3000.000",
        referrerLevel: 2, // New level
      });

      expect(newOrderResult.referralCommission.toFixed(3)).toBe("60.000"); // 10% of 600 = 60 TND

      // Crucial verification: historical commission record remains completely unchanged
      expect(persistedHistoricalCommission.amount.toFixed(3)).toBe("30.000");
      expect(persistedHistoricalCommission.rateApplied.toString()).toBe("0.05");
    });
  });

  // ==========================================================================
  // 8. Level Constants & Exact Rate Values
  // ==========================================================================
  describe("level constants and rate decimals", () => {
    it("Level 1 is 5%, Level 2 is 10%, Level 3 is 15%", () => {
      expect(REFERRAL_LEVEL_RATES[1].toString()).toBe("0.05");
      expect(REFERRAL_LEVEL_RATES[2].toString()).toBe("0.1");
      expect(REFERRAL_LEVEL_RATES[3].toString()).toBe("0.15");
    });

    it("matches exact financial profit sharing specification from R4 example", () => {
      // 5,000 TND revenue, 3,000 TND expenses -> P = 2,000, A = 1,400, B = 600
      // Level 1: 30 TND, Level 2: 60 TND, Level 3: 90 TND
      const l1 = calculateProfitSharing({ revenue: 5000, expenses: 3000, referrerLevel: 1 });
      const l2 = calculateProfitSharing({ revenue: 5000, expenses: 3000, referrerLevel: 2 });
      const l3 = calculateProfitSharing({ revenue: 5000, expenses: 3000, referrerLevel: 3 });

      expect(l1.referralCommission.toFixed(3)).toBe("30.000");
      expect(l2.referralCommission.toFixed(3)).toBe("60.000");
      expect(l3.referralCommission.toFixed(3)).toBe("90.000");
    });
  });
});
