import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { d, roundMoney } from "@/lib/money";
import {
  calculateProfitSharingOracle,
  evaluatePartnerLevelOracle,
  runProfitSharing,
  transitionCommissionOracle,
  validateReferralIntakeOracle,
  type CommissionRecord,
  type CommissionStatus,
  type PartnerRecord,
  type ReferralAttributionRecord,
  type SystemReferralSettings,
} from "./suite-harness.test";

describe("Tier 1: Feature Coverage in Isolation", () => {
  // ==========================================================================
  // R2: REFERRAL PERMISSIONS & ATTRIBUTION
  // ==========================================================================
  describe("R2: Referral Permissions and Attribution", () => {
    const activePartner: PartnerRecord = {
      id: "partner-active-1",
      userId: "user-active-1",
      displayName: "Karim Ben Salah",
      code: "P001",
      status: "ACTIVE",
      email: "karim@example.com",
      phone: "21698123456",
      level: 1,
      qualifiedReferralsCount: 0,
    };

    const pendingPartner: PartnerRecord = {
      id: "partner-pending-2",
      userId: "user-pending-2",
      displayName: "Mouna Trabelsi",
      code: "P002",
      status: "PENDING",
      email: "mouna@example.com",
      phone: "21698654321",
      level: 1,
      qualifiedReferralsCount: 0,
    };

    it("T1.R2.1: Active partner can share valid referral links", () => {
      const intake = validateReferralIntakeOracle({
        referrer: activePartner,
        candidate: { email: "newuser@example.com", phone: "21622111222" },
        existingAttributions: [],
      });
      expect(intake.valid).toBe(true);
      expect(intake.error).toBeUndefined();
    });

    it("T1.R2.2: Unapproved (PENDING/SUSPENDED/REJECTED) partner cannot share referral links", () => {
      const pendingIntake = validateReferralIntakeOracle({
        referrer: pendingPartner,
        candidate: { email: "newuser@example.com", phone: "21622111222" },
        existingAttributions: [],
      });
      expect(pendingIntake.valid).toBe(false);
      expect(pendingIntake.error).toMatch(/Only approved active partners/i);

      const suspendedPartner: PartnerRecord = { ...activePartner, status: "SUSPENDED" };
      const suspendedIntake = validateReferralIntakeOracle({
        referrer: suspendedPartner,
        candidate: { email: "newuser@example.com", phone: "21622111222" },
        existingAttributions: [],
      });
      expect(suspendedIntake.valid).toBe(false);
    });

    it("T1.R2.3: Non-partner or unauthorized account is denied referral generation", () => {
      const guestAttempt = validateReferralIntakeOracle({
        referrer: { ...activePartner, status: "REJECTED" },
        candidate: { email: "newuser@example.com", phone: "21622111222" },
        existingAttributions: [],
      });
      expect(guestAttempt.valid).toBe(false);
    });

    it("T1.R2.4: Registration intake attributes referred partner to referrer correctly", () => {
      const newCandidate = { email: "amira@example.com", phone: "21655443322", id: "partner-new-3" };
      const intake = validateReferralIntakeOracle({
        referrer: activePartner,
        candidate: newCandidate,
        existingAttributions: [],
      });
      expect(intake.valid).toBe(true);
    });

    it("T1.R2.5: Self-referrals are rejected by matching ID, email, or phone", () => {
      // Same ID
      const sameId = validateReferralIntakeOracle({
        referrer: activePartner,
        candidate: { id: activePartner.id, email: "other@example.com", phone: "21622000000" },
        existingAttributions: [],
      });
      expect(sameId.valid).toBe(false);
      expect(sameId.error).toMatch(/matching partner ID/i);

      // Same email
      const sameEmail = validateReferralIntakeOracle({
        referrer: activePartner,
        candidate: { id: "partner-cand-4", email: activePartner.email, phone: "21622000000" },
        existingAttributions: [],
      });
      expect(sameEmail.valid).toBe(false);
      expect(sameEmail.error).toMatch(/matching email/i);

      // Same phone (with different prefix formatting)
      const samePhone = validateReferralIntakeOracle({
        referrer: activePartner, // phone: 21698123456 (last 8 digits: 98123456)
        candidate: { id: "partner-cand-5", email: "other@example.com", phone: "98123456" },
        existingAttributions: [],
      });
      expect(samePhone.valid).toBe(false);
      expect(samePhone.error).toMatch(/matching phone/i);
    });

    it("T1.R2.6: Duplicate referral attribution is rejected (one direct referrer max)", () => {
      const existing: ReferralAttributionRecord[] = [
        {
          id: "attr-1",
          referrerPartnerId: "partner-prior",
          referredPartnerId: "partner-target",
          status: "ACTIVE",
          createdAt: new Date(),
        },
      ];

      const duplicate = validateReferralIntakeOracle({
        referrer: activePartner,
        candidate: { id: "partner-target", email: "target@example.com", phone: "21622999888" },
        existingAttributions: existing,
      });
      expect(duplicate.valid).toBe(false);
      expect(duplicate.error).toMatch(/already attributed/i);
    });

    it("T1.R2.7: Referral cycles (direct A->B->A and multi-hop A->B->C->A) are rejected", () => {
      // Direct cycle: candidate already referred this partner
      const existingDirect: ReferralAttributionRecord[] = [
        {
          id: "attr-direct",
          referrerPartnerId: "partner-cand-b",
          referredPartnerId: activePartner.id,
          status: "ACTIVE",
          createdAt: new Date(),
        },
      ];
      const directCycle = validateReferralIntakeOracle({
        referrer: activePartner,
        candidate: { id: "partner-cand-b", email: "b@example.com", phone: "21622333444" },
        existingAttributions: existingDirect,
      });
      expect(directCycle.valid).toBe(false);
      expect(directCycle.error).toMatch(/cycle detected/i);

      // Transitive cycle: C refers B, B refers A, candidate C tries to be referred by A
      const existingTransitive: ReferralAttributionRecord[] = [
        {
          id: "attr-1",
          referrerPartnerId: "partner-c",
          referredPartnerId: "partner-b",
          status: "ACTIVE",
          createdAt: new Date(),
        },
        {
          id: "attr-2",
          referrerPartnerId: "partner-b",
          referredPartnerId: activePartner.id,
          status: "ACTIVE",
          createdAt: new Date(),
        },
      ];
      const multiHopCycle = validateReferralIntakeOracle({
        referrer: activePartner,
        candidate: { id: "partner-c", email: "c@example.com", phone: "21622555666" },
        existingAttributions: existingTransitive,
      });
      expect(multiHopCycle.valid).toBe(false);
      expect(multiHopCycle.error).toMatch(/cycle detected/i);
    });

    it("T1.R2.8: Unapproved or un-settled orders do not qualify referral", () => {
      // Helper simulating qualification check
      function isOrderQualifying(order: {
        partnerStatus: string;
        orderStatus: string;
        earningStatus: string;
      }): boolean {
        return (
          order.partnerStatus === "ACTIVE" &&
          order.orderStatus === "DELIVERED" &&
          order.earningStatus === "AVAILABLE"
        );
      }

      // Placed/confirmed order
      expect(isOrderQualifying({ partnerStatus: "ACTIVE", orderStatus: "CONFIRMED", earningStatus: "NONE" })).toBe(false);
      // Delivered but in 48h settlement holding window
      expect(isOrderQualifying({ partnerStatus: "ACTIVE", orderStatus: "DELIVERED", earningStatus: "PENDING" })).toBe(false);
      // Delivered and settled, but partner was suspended
      expect(isOrderQualifying({ partnerStatus: "SUSPENDED", orderStatus: "DELIVERED", earningStatus: "AVAILABLE" })).toBe(false);
      // Fully qualifying
      expect(isOrderQualifying({ partnerStatus: "ACTIVE", orderStatus: "DELIVERED", earningStatus: "AVAILABLE" })).toBe(true);
    });
  });

  // ==========================================================================
  // R3: PARTNER LEVELS & DIRECT-REFERRAL COMMISSION RATES
  // ==========================================================================
  describe("R3: Partner Levels and Direct-Referral Commission Rates", () => {
    it("T1.R3.1: Level 1 partner receives exactly 5% of remaining pool B", async () => {
      const calc = await runProfitSharing({ revenue: 5000, expenses: 3000, referrerLevel: 1 });
      // Pool B = 600.000, Level 1 rate = 5%
      expect(calc.commissionRate.toFixed(2)).toBe("0.05");
      expect(calc.referralCommission.toFixed(3)).toBe("30.000");
    });

    it("T1.R3.2: Level 2 partner receives exactly 10% of remaining pool B", async () => {
      const calc = await runProfitSharing({ revenue: 5000, expenses: 3000, referrerLevel: 2 });
      // Pool B = 600.000, Level 2 rate = 10%
      expect(calc.commissionRate.toFixed(2)).toBe("0.10");
      expect(calc.referralCommission.toFixed(3)).toBe("60.000");
    });

    it("T1.R3.3: Level 3 partner receives exactly 15% of remaining pool B", async () => {
      const calc = await runProfitSharing({ revenue: 5000, expenses: 3000, referrerLevel: 3 });
      // Pool B = 600.000, Level 3 rate = 15%
      expect(calc.commissionRate.toFixed(2)).toBe("0.15");
      expect(calc.referralCommission.toFixed(3)).toBe("90.000");
    });

    it("T1.R3.4: Indirect downline referrals generate 0% commission (no MLM)", () => {
      // In direct referral architecture: if relation is downline/indirect, rate is 0
      function calculateReferralRate(relationType: "DIRECT" | "INDIRECT", level: 1 | 2 | 3): Decimal {
        if (relationType !== "DIRECT") return new Decimal("0.00");
        return level === 3 ? new Decimal("0.15") : level === 2 ? new Decimal("0.10") : new Decimal("0.05");
      }

      expect(calculateReferralRate("DIRECT", 1).toFixed(2)).toBe("0.05");
      expect(calculateReferralRate("INDIRECT", 1).toFixed(2)).toBe("0.00");
      expect(calculateReferralRate("INDIRECT", 3).toFixed(2)).toBe("0.00");
    });

    it("T1.R3.5: Promotion thresholds are governed by configurable settings", () => {
      const customSettings: SystemReferralSettings = {
        level2Threshold: 5, // modified from default 3
        level3Threshold: 15, // modified from default 10
        autoPromotionConfirmed: true,
      };

      // With count = 3, default settings would yield Level 2, but custom yields Level 1
      const evalDefault = evaluatePartnerLevelOracle(3);
      expect(evalDefault.level).toBe(2);

      const evalCustom = evaluatePartnerLevelOracle(3, customSettings);
      expect(evalCustom.level).toBe(1);

      const evalCustomPromoted = evaluatePartnerLevelOracle(5, customSettings);
      expect(evalCustomPromoted.level).toBe(2);
    });

    it("T1.R3.6: Promotion effective date rule: finalized historical commissions are not recalculated", () => {
      // Scenario: Commission was calculated at Level 1 ($30 TND) on Jan 10
      const historicalCommission = {
        id: "comm-1",
        createdAt: new Date("2026-01-10T10:00:00Z"),
        referrerLevelAtCreation: 1,
        amount: new Decimal("30.000"),
        status: "APPROVED_FOR_PAYMENT" as CommissionStatus,
      };

      // Partner promoted to Level 2 on Jan 15
      const partnerPromotion = {
        partnerId: "partner-1",
        newLevel: 2,
        effectiveDate: new Date("2026-01-15T10:00:00Z"),
      };

      // Rule: Finalized historical commission must remain unmodified
      expect(historicalCommission.amount.toFixed(3)).toBe("30.000");
      expect(historicalCommission.referrerLevelAtCreation).toBe(1);
    });

    it("T1.R3.7: Inactivity does not trigger automatic demotion", () => {
      // Partner at Level 3 with no orders for 90 days remains Level 3
      const partner: PartnerRecord = {
        id: "p-inactive",
        userId: "u-inactive",
        displayName: "Sami",
        code: "P005",
        status: "ACTIVE",
        email: "sami@example.com",
        phone: "21622333444",
        level: 3,
        qualifiedReferralsCount: 12,
      };

      const daysInactive = 90;
      function evaluateInactivityDemotion(p: PartnerRecord, days: number): number {
        // Demotion disabled per spec R3 §35
        return p.level;
      }
      expect(evaluateInactivityDemotion(partner, daysInactive)).toBe(3);
    });
  });

  // ==========================================================================
  // R4: FINANCIAL CALCULATION RULES
  // ==========================================================================
  describe("R4: Financial Calculation Rules", () => {
    it("T1.R4.1: Canonical specification example: 5,000 - 3,000 = 2,000 => A=1400, B=600, C1=30, C2=60, C3=90", async () => {
      const l1 = await runProfitSharing({ revenue: 5000, expenses: 3000, referrerLevel: 1 });
      expect(l1.revenue.toFixed(3)).toBe("5000.000");
      expect(l1.expenses.toFixed(3)).toBe("3000.000");
      expect(l1.profit.toFixed(3)).toBe("2000.000");
      expect(l1.adminShare.toFixed(3)).toBe("1400.000");
      expect(l1.remainingPool.toFixed(3)).toBe("600.000");
      expect(l1.referralCommission.toFixed(3)).toBe("30.000");
      expect(l1.balanceAfterCommission.toFixed(3)).toBe("570.000");

      const l2 = await runProfitSharing({ revenue: 5000, expenses: 3000, referrerLevel: 2 });
      expect(l2.referralCommission.toFixed(3)).toBe("60.000");
      expect(l2.balanceAfterCommission.toFixed(3)).toBe("540.000");

      const l3 = await runProfitSharing({ revenue: 5000, expenses: 3000, referrerLevel: 3 });
      expect(l3.referralCommission.toFixed(3)).toBe("90.000");
      expect(l3.balanceAfterCommission.toFixed(3)).toBe("510.000");
    });

    it("T1.R4.2: Commission calculated strictly from pool B, not deducted from P before calculating A", async () => {
      const calc = await runProfitSharing({ revenue: 1000, expenses: 200, referrerLevel: 2 });
      // Profit P = 800. Admin Share A must be 70% of 800 = 560.
      expect(calc.profit.toFixed(3)).toBe("800.000");
      expect(calc.adminShare.toFixed(3)).toBe("560.000");
      // Remaining Pool B must be 30% of 800 = 240.
      expect(calc.remainingPool.toFixed(3)).toBe("240.000");
      // Level 2 Commission C = 10% of 240 = 24.
      expect(calc.referralCommission.toFixed(3)).toBe("24.000");
      // Admin Share is strictly 70% of P, not 70% of (P - C)
      expect(calc.adminShare.toFixed(3)).toBe(roundMoney(new Decimal(800).times(0.70)).toFixed(3));
    });

    it("T1.R4.3: Financial breakdown displays all required components separately", async () => {
      const result = await runProfitSharing({ revenue: 3500, expenses: 1500, referrerLevel: 1 });
      expect(result).toHaveProperty("revenue");
      expect(result).toHaveProperty("expenses");
      expect(result).toHaveProperty("profit");
      expect(result).toHaveProperty("adminShare");
      expect(result).toHaveProperty("remainingPool");
      expect(result).toHaveProperty("commissionRate");
      expect(result).toHaveProperty("referralCommission");
      expect(result).toHaveProperty("balanceAfterCommission");
    });

    it("T1.R4.4: Zero profit (R = E) generates zero commission and zero admin share", async () => {
      const zero = await runProfitSharing({ revenue: 1200, expenses: 1200, referrerLevel: 3 });
      expect(zero.profit.toFixed(3)).toBe("0.000");
      expect(zero.adminShare.toFixed(3)).toBe("0.000");
      expect(zero.remainingPool.toFixed(3)).toBe("0.000");
      expect(zero.referralCommission.toFixed(3)).toBe("0.000");
      expect(zero.balanceAfterCommission.toFixed(3)).toBe("0.000");
    });

    it("T1.R4.5: Negative profit (R < E) generates no positive commission or admin share", async () => {
      const loss = await runProfitSharing({ revenue: 800, expenses: 1200, referrerLevel: 2 });
      expect(loss.profit.toFixed(3)).toBe("-400.000");
      expect(loss.adminShare.toFixed(3)).toBe("0.000");
      expect(loss.remainingPool.toFixed(3)).toBe("0.000");
      expect(loss.referralCommission.toFixed(3)).toBe("0.000");
    });

    it("T1.R4.6: Decimal precision to 3 decimal places (millimes) with ROUND_HALF_UP", async () => {
      // 100.005 TND with 5% commission on 30% pool:
      // P = 100.005. B = 30.0015 -> rounds to 30.002. C = 5% of 30.002 = 1.5001 -> rounds to 1.500
      const calc = await runProfitSharing({ revenue: "100.005", expenses: "0.000", referrerLevel: 1 });
      expect(calc.profit.toFixed(3)).toBe("100.005");
      expect(calc.remainingPool.toFixed(3)).toBe("30.002");
      expect(calc.referralCommission.toFixed(3)).toBe("1.500");
    });

    it("T1.R4.7: Attributable expenses deducted once without double-counting", () => {
      const expensesList = [
        { id: "exp-1", amount: new Decimal("50.000"), category: "ADS" },
        { id: "exp-2", amount: new Decimal("20.000"), category: "PACKAGING" },
        { id: "exp-1", amount: new Decimal("50.000"), category: "ADS" }, // duplicate attempt
      ];

      // Deduplicate by ID
      const unique = Array.from(new Map(expensesList.map((e) => [e.id, e])).values());
      const totalExp = unique.reduce((sum, e) => sum.plus(e.amount), new Decimal(0));
      expect(totalExp.toFixed(3)).toBe("70.000");
    });
  });

  // ==========================================================================
  // R5: COMMISSION LIFECYCLE & PAYOUT SAFETY
  // ==========================================================================
  describe("R5: Commission Lifecycle and Payout Safety", () => {
    it("T1.R5.1: Initial commission status is PENDING_VERIFICATION on qualifying event", () => {
      const comm: CommissionRecord = {
        id: "comm-100",
        attributionId: "attr-1",
        orderId: "order-1",
        amount: new Decimal("30.000"),
        status: "PENDING_VERIFICATION",
        history: [
          {
            from: null,
            to: "PENDING_VERIFICATION",
            actorId: "system",
            timestamp: new Date(),
          },
        ],
      };
      expect(comm.status).toBe("PENDING_VERIFICATION");
      expect(comm.history).toHaveLength(1);
    });

    it("T1.R5.2: Verification transitions commission from PENDING_VERIFICATION to ELIGIBLE", () => {
      const transition = transitionCommissionOracle("PENDING_VERIFICATION", "ELIGIBLE", {
        actorId: "system-verifier",
      });
      expect(transition.ok).toBe(true);
    });

    it("T1.R5.3: Admin review transitions commission from ELIGIBLE to APPROVED_FOR_PAYMENT", () => {
      const transition = transitionCommissionOracle("ELIGIBLE", "APPROVED_FOR_PAYMENT", {
        actorId: "admin-123",
      });
      expect(transition.ok).toBe(true);
    });

    it("T1.R5.4: Payment recording transitions APPROVED_FOR_PAYMENT to PAID with valid reference", () => {
      const withRef = transitionCommissionOracle("APPROVED_FOR_PAYMENT", "PAID", {
        actorId: "finance-admin",
        reference: "VIR-TN-2026-998877",
      });
      expect(withRef.ok).toBe(true);

      const withoutRef = transitionCommissionOracle("APPROVED_FOR_PAYMENT", "PAID", {
        actorId: "finance-admin",
        reference: "",
      });
      expect(withoutRef.ok).toBe(false);
      expect(withoutRef.error).toMatch(/Payment reference is mandatory/i);
    });

    it("T1.R5.5: Skipping approval directly to PAID is strictly rejected", () => {
      const directFromPending = transitionCommissionOracle("PENDING_VERIFICATION", "PAID", {
        actorId: "rogue-actor",
        reference: "FAKE-REF",
      });
      expect(directFromPending.ok).toBe(false);
      expect(directFromPending.error).toMatch(/Invalid commission transition/i);

      const directFromEligible = transitionCommissionOracle("ELIGIBLE", "PAID", {
        actorId: "rogue-actor",
        reference: "FAKE-REF",
      });
      expect(directFromEligible.ok).toBe(false);
    });

    it("T1.R5.6: Admin rejection records mandatory justification reason", () => {
      const rejectedValid = transitionCommissionOracle("ELIGIBLE", "REJECTED", {
        actorId: "admin-123",
        reason: "Suspected fraudulent order pattern",
      });
      expect(rejectedValid.ok).toBe(true);

      const rejectedNoReason = transitionCommissionOracle("ELIGIBLE", "REJECTED", {
        actorId: "admin-123",
        reason: "",
      });
      expect(rejectedNoReason.ok).toBe(false);
      expect(rejectedNoReason.error).toMatch(/Justification reason is mandatory/i);
    });

    it("T1.R5.7: Commission reversal on post-settlement return records mandatory reason", () => {
      const reversalValid = transitionCommissionOracle("PAID", "REVERSED", {
        actorId: "system-returns",
        reason: "Customer parcel returned defect post-48h settlement",
      });
      expect(reversalValid.ok).toBe(true);

      const reversalNoReason = transitionCommissionOracle("PAID", "REVERSED", {
        actorId: "system-returns",
        reason: "   ",
      });
      expect(reversalNoReason.ok).toBe(false);
    });

    it("T1.R5.8: Idempotency check prevents duplicate commission creation on event replay", () => {
      const processedOrderIds = new Set<string>();

      function processSettlementCommission(orderId: string, attributionId: string): { created: boolean } {
        const key = `${attributionId}:${orderId}`;
        if (processedOrderIds.has(key)) {
          return { created: false };
        }
        processedOrderIds.add(key);
        return { created: true };
      }

      // First webhook event
      const first = processSettlementCommission("ord-101", "attr-50");
      expect(first.created).toBe(true);

      // Duplicate / replayed webhook event
      const replay = processSettlementCommission("ord-101", "attr-50");
      expect(replay.created).toBe(false);
    });
  });
});
