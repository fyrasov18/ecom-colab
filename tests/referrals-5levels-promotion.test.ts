import { describe, it, expect, vi } from "vitest";
import Decimal from "decimal.js";
import {
  evaluateTargetLevel,
  getReferralLevelRate,
  getPartnerReferralLevel,
  rejectPartnerPromotion,
  reEvaluatePartnerPromotion,
  REFERRAL_LEVEL_RATES,
  DEFAULT_LEVEL2_THRESHOLD,
  DEFAULT_LEVEL3_THRESHOLD,
  DEFAULT_LEVEL4_THRESHOLD,
  DEFAULT_LEVEL5_THRESHOLD,
  type PartnerReferralLevelState,
} from "@/modules/referrals/levels";
import type { Prisma } from "@prisma/client";

describe("5-Tier Referral Progression & Rate Specification", () => {
  it("defines the exact official 5 rates (3%, 7%, 15%, 20%, 30%)", () => {
    expect(REFERRAL_LEVEL_RATES[1].toString()).toBe("0.03");
    expect(REFERRAL_LEVEL_RATES[2].toString()).toBe("0.07");
    expect(REFERRAL_LEVEL_RATES[3].toString()).toBe("0.15");
    expect(REFERRAL_LEVEL_RATES[4].toString()).toBe("0.2");
    expect(REFERRAL_LEVEL_RATES[5].toString()).toBe("0.3");
  });

  it("defines the exact official thresholds (0, 10, 100, 300, 900)", () => {
    expect(DEFAULT_LEVEL2_THRESHOLD).toBe(10);
    expect(DEFAULT_LEVEL3_THRESHOLD).toBe(100);
    expect(DEFAULT_LEVEL4_THRESHOLD).toBe(300);
    expect(DEFAULT_LEVEL5_THRESHOLD).toBe(900);
  });

  it("evaluates target levels correctly across all boundaries", () => {
    const thresholds = {
      level2Threshold: 10,
      level3Threshold: 100,
      level4Threshold: 300,
      level5Threshold: 900,
    };

    // Level 1: 0..9
    expect(evaluateTargetLevel(0, thresholds)).toBe(1);
    expect(evaluateTargetLevel(9, thresholds)).toBe(1);

    // Level 2: 10..99
    expect(evaluateTargetLevel(10, thresholds)).toBe(2);
    expect(evaluateTargetLevel(99, thresholds)).toBe(2);

    // Level 3: 100..299
    expect(evaluateTargetLevel(100, thresholds)).toBe(3);
    expect(evaluateTargetLevel(299, thresholds)).toBe(3);

    // Level 4: 300..899
    expect(evaluateTargetLevel(300, thresholds)).toBe(4);
    expect(evaluateTargetLevel(899, thresholds)).toBe(4);

    // Level 5: 900+
    expect(evaluateTargetLevel(900, thresholds)).toBe(5);
    expect(evaluateTargetLevel(1500, thresholds)).toBe(5);
  });

  it("returns correct rates via getReferralLevelRate for 1..5", () => {
    expect(getReferralLevelRate(1).toNumber()).toBe(0.03);
    expect(getReferralLevelRate(2).toNumber()).toBe(0.07);
    expect(getReferralLevelRate(3).toNumber()).toBe(0.15);
    expect(getReferralLevelRate(4).toNumber()).toBe(0.20);
    expect(getReferralLevelRate(5).toNumber()).toBe(0.30);
  });

  it("rejects invalid levels outside 1..5", () => {
    // @ts-expect-error invalid level test
    expect(() => getReferralLevelRate(0)).toThrow(/invalide/i);
    // @ts-expect-error invalid level test
    expect(() => getReferralLevelRate(6)).toThrow(/invalide/i);
  });

  describe("Admin Promotion Rejection & Lifecycle", () => {
    it("strictly requires a non-empty reason when rejecting a promotion", async () => {
      const mockDb = {
        systemSetting: {
          findUnique: vi.fn().mockResolvedValue({
            value: {
              partnerId: "partner-1",
              currentLevel: 1,
              eligibleLevel: 2,
              pendingConfirmation: true,
              history: [],
            },
          }),
        },
      } as unknown as Prisma.TransactionClient;

      await expect(rejectPartnerPromotion("partner-1", "admin-1", "", mockDb)).rejects.toThrow(
        /motif du refus est obligatoire/i
      );
      await expect(rejectPartnerPromotion("partner-1", "admin-1", "   ", mockDb)).rejects.toThrow(
        /motif du refus est obligatoire/i
      );
    });

    it("records rejection in history and audit log, keeps current level, and prevents queue looping", async () => {
      let state: PartnerReferralLevelState = {
        partnerId: "partner-rej-1",
        currentLevel: 1,
        effectiveDate: "2026-01-01T00:00:00.000Z",
        highestLevelReached: 1,
        eligibleLevel: 2,
        pendingConfirmation: true,
        history: [{ level: 1, effectiveDate: "2026-01-01T00:00:00.000Z", reason: "INITIAL" }],
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const auditEntries: any[] = [];
      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue({ id: "partner-rej-1", createdAt: new Date("2026-01-01") }),
        },
        referralAttribution: {
          count: vi.fn().mockResolvedValue(10), // Partner has 10 qualified referrals
        },
        systemSetting: {
          findUnique: vi.fn().mockImplementation(({ where: { key } }) => {
            if (key === "referral.partner_level:partner-rej-1") return Promise.resolve({ value: state });
            return Promise.resolve(null);
          }),
          upsert: vi.fn().mockImplementation(({ create, update }) => {
            state = update?.value ?? create?.value;
            return Promise.resolve({ value: state });
          }),
        },
        auditLog: {
          create: vi.fn().mockImplementation(({ data }) => {
            auditEntries.push(data);
            return Promise.resolve({});
          }),
        },
      } as unknown as Prisma.TransactionClient;

      // Admin rejects promotion
      const rejectResult = await rejectPartnerPromotion(
        "partner-rej-1",
        "admin-user-99",
        "Commandes en cours d'audit de conformité",
        mockDb
      );

      // Partner stays at Level 1
      expect(rejectResult.level).toBe(1);
      expect(rejectResult.promotionPendingConfirmation).toBe(false);
      expect(rejectResult.isEligibleForPromotion).toBe(false);

      // Audit log recorded with mandatory reason and actor
      expect(auditEntries.some(e => e.action === "PARTNER_REFERRAL_PROMOTION_REJECTED" && e.actorId === "admin-user-99")).toBe(true);

      // Subsequent read does NOT re-add candidate to the queue at the same 10 qualified referrals
      const reCheck = await getPartnerReferralLevel("partner-rej-1", mockDb);
      expect(reCheck.level).toBe(1);
      expect(reCheck.promotionPendingConfirmation).toBe(false);

      // If partner qualifies MORE referrals (e.g. 15), eligibility re-opens!
      (mockDb.referralAttribution.count as any).mockResolvedValue(15);
      const withMoreReferrals = await getPartnerReferralLevel("partner-rej-1", mockDb);
      expect(withMoreReferrals.promotionPendingConfirmation).toBe(true);
      expect(withMoreReferrals.targetLevel).toBe(2);

      // Or if admin triggers explicit re-evaluation
      state.lastRejectedQualifiedCount = 15;
      state.pendingConfirmation = false;
      const reEvaluated = await reEvaluatePartnerPromotion("partner-rej-1", "admin-user-99", mockDb);
      expect(reEvaluated.promotionPendingConfirmation).toBe(true);
    });
  });
});
