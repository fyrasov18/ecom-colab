import { describe, expect, it, vi, beforeEach } from "vitest";
import Decimal from "decimal.js";
import type { Prisma } from "@prisma/client";
import {
  getPartnerReferralLevel,
  confirmPartnerPromotion,
  getPartnerReferralLevelAtDate,
  evaluateTargetLevel,
  countDirectQualifiedReferrals,
  getReferralThresholdSettings,
  updateReferralSettings,
  REFERRAL_LEVEL_RATES,
  REFERRAL_LEVELS,
  DEFAULT_LEVEL2_THRESHOLD,
  DEFAULT_LEVEL3_THRESHOLD,
  DEFAULT_AUTO_PROMOTION_ENABLED,
  type PartnerReferralLevelState,
  type ReferralLevel,
} from "@/modules/referrals/levels";
import { calculateProfitSharing } from "@/modules/finance/referral-math";
import { SETTING_KEYS } from "@/modules/settings/defaults";

describe("Milestone 3 Challenger 2: Partner Level Boundaries & Immutability Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. THRESHOLD BOUNDARIES EMPIRICAL VERIFICATION (0, 1, 2, 3, 4, 9, 10, 11)
  // ==========================================================================
  describe("1. Threshold Boundaries (0, 1, 2, 3, 4, 9, 10, 11)", () => {
    const defaultThresholds = {
      level2Threshold: DEFAULT_LEVEL2_THRESHOLD, // 3
      level3Threshold: DEFAULT_LEVEL3_THRESHOLD, // 10
    };

    it("evaluates exact boundary points using evaluateTargetLevel", () => {
      // 0: exact bottom boundary -> Level 1
      expect(evaluateTargetLevel(0, defaultThresholds)).toBe(1);
      // 1: below L2 threshold -> Level 1
      expect(evaluateTargetLevel(1, defaultThresholds)).toBe(1);
      // 2: off-by-one below L2 threshold (3) -> Level 1
      expect(evaluateTargetLevel(2, defaultThresholds)).toBe(1);
      // 3: exact L2 threshold boundary -> Level 2
      expect(evaluateTargetLevel(3, defaultThresholds)).toBe(2);
      // 4: above L2 threshold -> Level 2
      expect(evaluateTargetLevel(4, defaultThresholds)).toBe(2);
      // 9: off-by-one below L3 threshold (10) -> Level 2
      expect(evaluateTargetLevel(9, defaultThresholds)).toBe(2);
      // 10: exact L3 threshold boundary -> Level 3
      expect(evaluateTargetLevel(10, defaultThresholds)).toBe(3);
      // 11: above L3 threshold -> Level 3
      expect(evaluateTargetLevel(11, defaultThresholds)).toBe(3);
    });

    it("empirically verifies getPartnerReferralLevel at every boundary point (0, 1, 2, 3, 4, 9, 10, 11) with auto-promotion enabled", async () => {
      const boundaryCases: { count: number; expectedLevel: ReferralLevel; expectedRate: string }[] = [
        { count: 0, expectedLevel: 1, expectedRate: "0.05" },
        { count: 1, expectedLevel: 1, expectedRate: "0.05" },
        { count: 2, expectedLevel: 1, expectedRate: "0.05" },
        { count: 3, expectedLevel: 2, expectedRate: "0.1" },
        { count: 4, expectedLevel: 2, expectedRate: "0.1" },
        { count: 9, expectedLevel: 2, expectedRate: "0.1" },
        { count: 10, expectedLevel: 3, expectedRate: "0.15" },
        { count: 11, expectedLevel: 3, expectedRate: "0.15" },
      ];

      for (const tc of boundaryCases) {
        let storedState: any = null;

        const mockDb = {
          partner: {
            findUnique: vi.fn().mockResolvedValue({ id: `partner-b-${tc.count}`, createdAt: new Date("2026-01-01") }),
          },
          referralAttribution: {
            count: vi.fn().mockResolvedValue(tc.count),
          },
          systemSetting: {
            findUnique: vi.fn().mockImplementation(({ where: { key } }) => {
              if (key === `referral.partner_level:partner-b-${tc.count}`) {
                return Promise.resolve(storedState ? { value: storedState } : null);
              }
              if (key === SETTING_KEYS.REFERRAL_AUTO_PROMOTION_ENABLED) {
                return Promise.resolve({ value: true }); // auto-promotion enabled for direct promotion test
              }
              return Promise.resolve(null);
            }),
            upsert: vi.fn().mockImplementation(({ create, update }) => {
              storedState = update?.value ?? create?.value;
              return Promise.resolve({ value: storedState });
            }),
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        } as unknown as Prisma.TransactionClient;

        const result = await getPartnerReferralLevel(`partner-b-${tc.count}`, mockDb);

        expect(result.qualifiedCount).toBe(tc.count);
        expect(result.level).toBe(tc.expectedLevel);
        expect(result.rate.toString()).toBe(tc.expectedRate);
        expect(result.targetLevel).toBe(tc.expectedLevel);
        expect(result.highestLevelReached).toBe(tc.expectedLevel);
        expect(result.isEligibleForPromotion).toBe(false); // already promoted
        expect(result.promotionPendingConfirmation).toBe(false);
      }
    });
  });

  // ==========================================================================
  // 2. DOWNLINE ISOLATION: 10 INDIRECT REFERRALS MUST NOT PROMOTE TO LEVEL 3
  // ==========================================================================
  describe("2. Downline Isolation Verification", () => {
    it("10 indirect downline referrals do NOT promote parent partner to Level 3", async () => {
      // Scenario:
      // Partner A (Root) refers Partner B (Direct to A).
      // Partner B refers 10 partners: C1, C2, C3, ..., C10 (Direct to B, indirect downline to A).
      // All C1..C10 place qualifying orders that deliver and settle.
      // Therefore, B -> C1..C10 are all QUALIFIED.
      // Partner A must strictly have qualifiedCount = 0 (or 1 if B also settled, but never 10 or 11).
      const partnerAId = "partner-A-root";
      const partnerBId = "partner-B-middle";

      const attributions: { id: string; referrerPartnerId: string; referredPartnerId: string; status: string }[] = [];

      // A -> B attribution
      attributions.push({
        id: "attr-A-B",
        referrerPartnerId: partnerAId,
        referredPartnerId: partnerBId,
        status: "PENDING_QUALIFICATION", // Partner B has not settled an order yet
      });

      // B -> C1..C10 attributions (10 qualified referrals under B)
      for (let i = 1; i <= 10; i++) {
        attributions.push({
          id: `attr-B-C${i}`,
          referrerPartnerId: partnerBId,
          referredPartnerId: `partner-C${i}`,
          status: "QUALIFIED",
        });
      }

      let storedStateA: any = null;
      let storedStateB: any = null;

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockImplementation(({ where: { id } }) => {
            return Promise.resolve({ id, createdAt: new Date("2026-01-01") });
          }),
        },
        referralAttribution: {
          count: vi.fn().mockImplementation(({ where }) => {
            const matches = attributions.filter(
              (a) => a.referrerPartnerId === where.referrerPartnerId && a.status === where.status,
            );
            return Promise.resolve(matches.length);
          }),
        },
        systemSetting: {
          findUnique: vi.fn().mockImplementation(({ where: { key } }) => {
            if (key === `referral.partner_level:${partnerAId}`) {
              return Promise.resolve(storedStateA ? { value: storedStateA } : null);
            }
            if (key === `referral.partner_level:${partnerBId}`) {
              return Promise.resolve(storedStateB ? { value: storedStateB } : null);
            }
            if (key === SETTING_KEYS.REFERRAL_AUTO_PROMOTION_ENABLED) {
              return Promise.resolve({ value: true }); // even with auto-promotion enabled!
            }
            return Promise.resolve(null);
          }),
          upsert: vi.fn().mockImplementation(({ create, update }) => {
            const state = update?.value ?? create?.value;
            if (state.partnerId === partnerAId) storedStateA = state;
            if (state.partnerId === partnerBId) storedStateB = state;
            return Promise.resolve({ value: state });
          }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      } as unknown as Prisma.TransactionClient;

      // 1. Verify Partner B gets 10 direct qualified referrals -> Promoted to Level 3
      const countB = await countDirectQualifiedReferrals(partnerBId, mockDb);
      expect(countB).toBe(10);
      const levelB = await getPartnerReferralLevel(partnerBId, mockDb);
      expect(levelB.level).toBe(3);
      expect(levelB.rate.toString()).toBe("0.15");

      // 2. Verify Partner A has 0 direct qualified referrals
      const countA = await countDirectQualifiedReferrals(partnerAId, mockDb);
      expect(countA).toBe(0);

      // 3. Crucial Isolation Verification: Partner A strictly remains Level 1 (5%)
      const levelA = await getPartnerReferralLevel(partnerAId, mockDb);
      expect(levelA.level).toBe(1);
      expect(levelA.rate.toString()).toBe("0.05");
      expect(levelA.qualifiedCount).toBe(0);
      expect(levelA.targetLevel).toBe(1);
      expect(levelA.highestLevelReached).toBe(1);
      expect(levelA.isEligibleForPromotion).toBe(false);
      expect(levelA.promotionPendingConfirmation).toBe(false);
    });
  });

  // ==========================================================================
  // 3. ADMIN CONFIRMATION TOGGLE: FALSE KEEPS L1, ADMIN CONFIRM PROMOTES TO L3
  // ==========================================================================
  describe("3. Admin Confirmation Toggle Verification", () => {
    it("when auto_promotion_enabled is FALSE, level remains Level 1 even with 10 referrals; admin confirmation promotes to Level 3", async () => {
      const partnerId = "partner-with-10-referrals";
      let storedState: any = null;

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue({ id: partnerId, createdAt: new Date("2026-01-01") }),
        },
        referralAttribution: {
          count: vi.fn().mockResolvedValue(10), // 10 direct qualified referrals!
        },
        systemSetting: {
          findUnique: vi.fn().mockImplementation(({ where: { key } }) => {
            if (key === `referral.partner_level:${partnerId}`) {
              return Promise.resolve(storedState ? { value: storedState } : null);
            }
            if (key === SETTING_KEYS.REFERRAL_AUTO_PROMOTION_ENABLED) {
              return Promise.resolve({ value: false }); // Strictly FALSE!
            }
            return Promise.resolve(null);
          }),
          upsert: vi.fn().mockImplementation(({ create, update }) => {
            storedState = update?.value ?? create?.value;
            return Promise.resolve({ value: storedState });
          }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      } as unknown as Prisma.TransactionClient;

      // Stage 1: Partner evaluates level with 10 referrals while auto-promotion is false
      const initialEval = await getPartnerReferralLevel(partnerId, mockDb);

      // Must remain at Level 1 with 5% rate!
      expect(initialEval.level).toBe(1);
      expect(initialEval.rate.toString()).toBe("0.05");
      expect(initialEval.qualifiedCount).toBe(10);
      expect(initialEval.targetLevel).toBe(3);
      expect(initialEval.eligibleLevel).toBe(3);
      expect(initialEval.isEligibleForPromotion).toBe(true);
      expect(initialEval.promotionPendingConfirmation).toBe(true);
      expect(initialEval.autoPromotionEnabled).toBe(false);

      // Verify audit log flagged promotion eligibility without promoting
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "PARTNER_PROMOTION_ELIGIBLE",
          entityId: partnerId,
          after: expect.objectContaining({
            eligibleLevel: 3,
            pendingConfirmation: true,
            qualifiedCount: 10,
          }),
        }),
      });

      // Stage 2: Admin reviews queue and confirms promotion to Level 3
      const confirmedResult = await confirmPartnerPromotion(partnerId, 3, "admin-supervisor-id", mockDb);

      expect(confirmedResult.level).toBe(3);
      expect(confirmedResult.rate.toString()).toBe("0.15");
      expect(confirmedResult.highestLevelReached).toBe(3);
      expect(confirmedResult.isEligibleForPromotion).toBe(false);
      expect(confirmedResult.promotionPendingConfirmation).toBe(false);

      // Verify audit log recorded admin confirmation
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: "admin-supervisor-id",
          action: "PARTNER_REFERRAL_LEVEL_CONFIRMED",
          entityId: partnerId,
          before: { level: 1 },
          after: expect.objectContaining({
            level: 3,
            confirmedBy: "admin-supervisor-id",
          }),
        }),
      });

      // Stage 3: Subsequent getPartnerReferralLevel preserves confirmed Level 3
      const subsequentEval = await getPartnerReferralLevel(partnerId, mockDb);
      expect(subsequentEval.level).toBe(3);
      expect(subsequentEval.rate.toString()).toBe("0.15");
      expect(subsequentEval.highestLevelReached).toBe(3);
      expect(subsequentEval.promotionPendingConfirmation).toBe(false);
    });
  });

  // ==========================================================================
  // 4. HISTORICAL IMMUTABILITY: COMMISSIONS BEFORE PROMOTION RETAIN HISTORICAL RATE
  // ==========================================================================
  describe("4. Historical Immutability Verification", () => {
    it("commission calculated before promotion date retains historical level rate", async () => {
      const partnerId = "partner-immutable-comm";

      // Promotion timeline:
      // - 2026-01-01: Partner created at Level 1 (5%)
      // - 2026-03-15: Order 1 settles -> profit sharing computed at Level 1
      // - 2026-04-01: Partner promoted to Level 2 (10%)
      // - 2026-05-15: Order 2 settles -> profit sharing computed at Level 2
      // - 2026-06-01: Partner promoted to Level 3 (15%)
      // - 2026-07-15: Order 3 settles -> profit sharing computed at Level 3
      const stateHistory: PartnerReferralLevelState = {
        partnerId,
        currentLevel: 3,
        effectiveDate: "2026-06-01T00:00:00.000Z",
        highestLevelReached: 3,
        eligibleLevel: 3,
        pendingConfirmation: false,
        history: [
          { level: 1, effectiveDate: "2026-01-01T00:00:00.000Z", reason: "INITIAL_LEVEL" },
          { level: 2, effectiveDate: "2026-04-01T00:00:00.000Z", reason: "ADMIN_CONFIRMATION" },
          { level: 3, effectiveDate: "2026-06-01T00:00:00.000Z", reason: "ADMIN_CONFIRMATION" },
        ],
        updatedAt: "2026-06-01T00:00:00.000Z",
      };

      const mockDb = {
        systemSetting: {
          findUnique: vi.fn().mockResolvedValue({ value: stateHistory }),
        },
      } as unknown as Prisma.TransactionClient;

      // 1. Resolve rate for Order 1 date (2026-03-15) -> strictly Level 1 (0.05)
      const historicalAtMarch = await getPartnerReferralLevelAtDate(
        partnerId,
        new Date("2026-03-15T12:00:00.000Z"),
        mockDb,
      );
      expect(historicalAtMarch.level).toBe(1);
      expect(historicalAtMarch.rate.toString()).toBe("0.05");

      // 2. Resolve rate for Order 2 date (2026-05-15) -> strictly Level 2 (0.10)
      const historicalAtMay = await getPartnerReferralLevelAtDate(
        partnerId,
        new Date("2026-05-15T12:00:00.000Z"),
        mockDb,
      );
      expect(historicalAtMay.level).toBe(2);
      expect(historicalAtMay.rate.toString()).toBe("0.1");

      // 3. Resolve rate for Order 3 date (2026-07-15) -> strictly Level 3 (0.15)
      const historicalAtJuly = await getPartnerReferralLevelAtDate(
        partnerId,
        new Date("2026-07-15T12:00:00.000Z"),
        mockDb,
      );
      expect(historicalAtJuly.level).toBe(3);
      expect(historicalAtJuly.rate.toString()).toBe("0.15");

      // 4. Financial profit sharing calculation invariance:
      // Pool B = 600 TND (from 5000 revenue - 3000 expenses => 2000 profit => 30% pool B = 600)
      const comm1 = calculateProfitSharing({ revenue: 5000, expenses: 3000, referrerLevel: historicalAtMarch.level });
      const comm2 = calculateProfitSharing({ revenue: 5000, expenses: 3000, referrerLevel: historicalAtMay.level });
      const comm3 = calculateProfitSharing({ revenue: 5000, expenses: 3000, referrerLevel: historicalAtJuly.level });

      expect(comm1.referralCommission.toFixed(3)).toBe("30.000"); // 5% of 600
      expect(comm2.referralCommission.toFixed(3)).toBe("60.000"); // 10% of 600
      expect(comm3.referralCommission.toFixed(3)).toBe("90.000"); // 15% of 600

      // Historical commission 1 remains 30.000 and is NEVER retroactively recalculated
      expect(comm1.referralCommission.toFixed(3)).toBe("30.000");
    });
  });

  // ==========================================================================
  // 5. INACTIVITY NON-DEMOTION: LEVEL DOES NOT DROP WHEN ACTIVITY HALTS
  // ==========================================================================
  describe("5. Inactivity Non-Demotion Verification", () => {
    it("level does not drop when referral activity completely halts", async () => {
      const partnerId = "partner-dormant";

      // Partner previously achieved Level 3
      const activeState: PartnerReferralLevelState = {
        partnerId,
        currentLevel: 3,
        effectiveDate: "2026-03-01T00:00:00.000Z",
        highestLevelReached: 3,
        eligibleLevel: 3,
        pendingConfirmation: false,
        history: [
          { level: 1, effectiveDate: "2026-01-01T00:00:00.000Z", reason: "INITIAL_LEVEL" },
          { level: 3, effectiveDate: "2026-03-01T00:00:00.000Z", reason: "ADMIN_CONFIRMATION" },
        ],
        updatedAt: "2026-03-01T00:00:00.000Z",
      };

      let persistedState = { ...activeState };

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue({ id: partnerId, createdAt: new Date("2026-01-01") }),
        },
        referralAttribution: {
          // Inactivity: Referral activity halts completely! Active count returns 0!
          count: vi.fn().mockResolvedValue(0),
        },
        systemSetting: {
          findUnique: vi.fn().mockImplementation(({ where: { key } }) => {
            if (key === `referral.partner_level:${partnerId}`) {
              return Promise.resolve({ value: persistedState });
            }
            if (key === SETTING_KEYS.REFERRAL_AUTO_PROMOTION_ENABLED) {
              return Promise.resolve({ value: true }); // even if auto-promotion is enabled
            }
            return Promise.resolve(null);
          }),
          upsert: vi.fn().mockImplementation(({ create, update }) => {
            persistedState = update?.value ?? create?.value;
            return Promise.resolve({ value: persistedState });
          }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      } as unknown as Prisma.TransactionClient;

      const dormantResult = await getPartnerReferralLevel(partnerId, mockDb);

      // Level must strictly remain at Level 3!
      expect(dormantResult.level).toBe(3);
      expect(dormantResult.rate.toString()).toBe("0.15");
      expect(dormantResult.highestLevelReached).toBe(3);
      expect(dormantResult.qualifiedCount).toBe(0); // count is 0, but level is protected
      expect(dormantResult.isEligibleForPromotion).toBe(false);

      // Ensure no demotion audit event was ever created
      expect(mockDb.auditLog.create).not.toHaveBeenCalled();
    });

    it("level does not drop from Level 2 when activity drops below Level 2 threshold", async () => {
      const partnerId = "partner-dormant-l2";

      const activeStateL2: PartnerReferralLevelState = {
        partnerId,
        currentLevel: 2,
        effectiveDate: "2026-02-15T00:00:00.000Z",
        highestLevelReached: 2,
        eligibleLevel: 2,
        pendingConfirmation: false,
        history: [
          { level: 1, effectiveDate: "2026-01-01T00:00:00.000Z", reason: "INITIAL_LEVEL" },
          { level: 2, effectiveDate: "2026-02-15T00:00:00.000Z", reason: "ADMIN_CONFIRMATION" },
        ],
        updatedAt: "2026-02-15T00:00:00.000Z",
      };

      let persistedState = { ...activeStateL2 };

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue({ id: partnerId, createdAt: new Date("2026-01-01") }),
        },
        referralAttribution: {
          // Count drops to 1 (below Level 2 threshold of 3)
          count: vi.fn().mockResolvedValue(1),
        },
        systemSetting: {
          findUnique: vi.fn().mockImplementation(({ where: { key } }) => {
            if (key === `referral.partner_level:${partnerId}`) {
              return Promise.resolve({ value: persistedState });
            }
            return Promise.resolve(null);
          }),
          upsert: vi.fn().mockImplementation(({ create, update }) => {
            persistedState = update?.value ?? create?.value;
            return Promise.resolve({ value: persistedState });
          }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await getPartnerReferralLevel(partnerId, mockDb);

      // Retains Level 2
      expect(result.level).toBe(2);
      expect(result.rate.toString()).toBe("0.1");
      expect(result.highestLevelReached).toBe(2);
    });
  });
});
