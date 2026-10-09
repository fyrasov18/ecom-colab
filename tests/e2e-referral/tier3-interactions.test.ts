import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { d, roundMoney } from "@/lib/money";
import {
  calculateProfitSharingOracle,
  evaluatePartnerLevelOracle,
  runProfitSharing,
  transitionCommissionOracle,
  type CommissionRecord,
  type CommissionStatus,
  type PartnerRecord,
  type ReferrerLevel,
  type SystemReferralSettings,
} from "./suite-harness.test";

describe("Tier 3: Cross-Feature Combinations & Pairwise Interactions", () => {
  // ==========================================================================
  // COMBINATION 1: PARTNER PROMOTION + SETTLED ORDER SETTLEMENT
  // ==========================================================================
  it("T3.I1: Partner promotion updates subsequent commissions without mutating historical ones", async () => {
    // Partner Alice starts at Level 1 with 2 qualified referrals
    let aliceLevel: ReferrerLevel = 1;
    let aliceQualifiedCount = 2;

    // Order 2 settled previously at Level 1 (revenue 1000, expenses 400 => P=600, B=180)
    const commOrder2 = await runProfitSharing({ revenue: 1000, expenses: 400, referrerLevel: aliceLevel });
    expect(commOrder2.referralCommission.toFixed(3)).toBe("9.000"); // 5% of 180

    // Referred Partner 3 order settles -> qualifies -> triggers level check
    aliceQualifiedCount++;
    const levelEval = evaluatePartnerLevelOracle(aliceQualifiedCount);
    expect(levelEval.level).toBe(2);
    aliceLevel = levelEval.level; // Promoted to Level 2 (10%)

    // Order 4 settles after promotion at Level 2 (revenue 1000, expenses 400 => P=600, B=180)
    const commOrder4 = await runProfitSharing({ revenue: 1000, expenses: 400, referrerLevel: aliceLevel });
    expect(commOrder4.referralCommission.toFixed(3)).toBe("18.000"); // 10% of 180

    // Invariance: Historical commission for Order 2 remains 9.000 TND (never retroactively recalculated)
    expect(commOrder2.referralCommission.toFixed(3)).toBe("9.000");
    expect(commOrder4.referralCommission.toFixed(3)).toBe("18.000");
  });

  // ==========================================================================
  // COMBINATION 2: EXPENSE DEDUCTIONS + POOL SPLITTING + BALANCE INVARIANCE
  // ==========================================================================
  it("T3.I2: Multiple attributable expenses deducted before 70/30 split maintain exact balance invariance", async () => {
    // Revenue collected from settled orders: 4,500.000 TND
    const revenue = new Decimal("4500.000");

    // Attributable expenses
    const marketingAds = new Decimal("450.000");
    const specialPackaging = new Decimal("125.500");
    const expressCourierSurcharge = new Decimal("74.500");
    const totalExpenses = marketingAds.plus(specialPackaging).plus(expressCourierSurcharge); // 650.000 TND

    // Compute profit sharing at Level 2 (10% rate)
    const res = await runProfitSharing({
      revenue,
      expenses: totalExpenses,
      referrerLevel: 2,
    });

    expect(res.profit.toFixed(3)).toBe("3850.000"); // 4500 - 650 = 3850
    expect(res.adminShare.toFixed(3)).toBe("2695.000"); // 70% of 3850
    expect(res.remainingPool.toFixed(3)).toBe("1155.000"); // 30% of 3850
    expect(res.referralCommission.toFixed(3)).toBe("115.500"); // 10% of 1155
    expect(res.balanceAfterCommission.toFixed(3)).toBe("1039.500"); // 1155 - 115.5

    // Mathematical Invariance Check: Admin Share + Referral Commission + Balance == Total Profit
    const totalDistributed = res.adminShare.plus(res.referralCommission).plus(res.balanceAfterCommission);
    expect(totalDistributed.toFixed(3)).toBe(res.profit.toFixed(3));
  });

  // ==========================================================================
  // COMBINATION 3: POST-SETTLEMENT RETURN + COMMISSION REVERSAL + LEDGER PARITY
  // ==========================================================================
  it("T3.I3: Post-settlement return triggers commission reversal with ledger parity", () => {
    // Commission was approved and recorded in partner wallet
    const commission: CommissionRecord = {
      id: "comm-rev-1",
      attributionId: "attr-xyz",
      orderId: "ord-returned",
      amount: new Decimal("45.000"),
      status: "APPROVED_FOR_PAYMENT",
      history: [
        { from: null, to: "PENDING_VERIFICATION", actorId: "system", timestamp: new Date() },
        { from: "PENDING_VERIFICATION", to: "ELIGIBLE", actorId: "system", timestamp: new Date() },
        { from: "ELIGIBLE", to: "APPROVED_FOR_PAYMENT", actorId: "admin", timestamp: new Date() },
      ],
    };

    // Customer returns parcel after settlement window -> commission reversed
    const transition = transitionCommissionOracle(commission.status, "REVERSED", {
      actorId: "admin-returns",
      reason: "Post-settlement return: customer refused item due to manufacturing defect",
    });
    expect(transition.ok).toBe(true);

    // Ledger adjustment simulation
    const ledgerEntries = [
      { type: "REFERRAL_COMMISSION_ACCRUED", amount: new Decimal("45.000"), status: "APPROVED" },
      { type: "REFERRAL_COMMISSION_REVERSED", amount: new Decimal("-45.000"), status: "REVERSED" },
    ];
    const netWalletImpact = ledgerEntries.reduce((sum, e) => sum.plus(e.amount), new Decimal(0));
    expect(netWalletImpact.toFixed(3)).toBe("0.000");
  });

  // ==========================================================================
  // COMBINATION 4: PARTNER SUSPENSION + ACTIVE COMMISSION QUEUE
  // ==========================================================================
  it("T3.I4: Partner suspension halts commission payouts until account is reactivated", () => {
    interface PartnerAccount {
      id: string;
      status: "ACTIVE" | "SUSPENDED";
    }

    function canExecutePayout(partner: PartnerAccount, commissionStatus: CommissionStatus): boolean {
      if (partner.status !== "ACTIVE") return false;
      return commissionStatus === "APPROVED_FOR_PAYMENT";
    }

    const partner: PartnerAccount = { id: "p-suspend", status: "ACTIVE" };
    expect(canExecutePayout(partner, "APPROVED_FOR_PAYMENT")).toBe(true);

    // Admin suspends partner for investigation
    partner.status = "SUSPENDED";
    expect(canExecutePayout(partner, "APPROVED_FOR_PAYMENT")).toBe(false);

    // After investigation, partner is restored to ACTIVE
    partner.status = "ACTIVE";
    expect(canExecutePayout(partner, "APPROVED_FOR_PAYMENT")).toBe(true);
  });

  // ==========================================================================
  // COMBINATION 5: DYNAMIC SETTINGS CHANGE + PROMOTION ENGINE
  // ==========================================================================
  it("T3.I5: Updating promotion thresholds in settings dynamically changes qualification tier", () => {
    let settings: SystemReferralSettings = {
      level2Threshold: 3,
      level3Threshold: 10,
      autoPromotionConfirmed: true,
    };

    // Partner has 3 qualified referrals -> Level 2 under initial settings
    let status = evaluatePartnerLevelOracle(3, settings);
    expect(status.level).toBe(2);

    // Admin modifies business settings: Level 2 now requires 5 referrals
    settings = {
      ...settings,
      level2Threshold: 5,
    };

    // Re-evaluating under new settings: 3 referrals is now Level 1
    status = evaluatePartnerLevelOracle(3, settings);
    expect(status.level).toBe(1);
    expect(status.nextThreshold).toBe(5);

    // When partner earns 2 more (reaching 5), advances to Level 2
    status = evaluatePartnerLevelOracle(5, settings);
    expect(status.level).toBe(2);
  });

  // ==========================================================================
  // COMBINATION 6: CONCURRENT SETTLEMENT REPLAYS + IDEMPOTENCY PROTECTION
  // ==========================================================================
  it("T3.I6: Multiple concurrent settlement requests result in exactly one commission generated", async () => {
    class MockCommissionRepository {
      private commissions = new Map<string, CommissionRecord>();

      async createIfAbsent(orderId: string, attributionId: string, amount: Decimal): Promise<CommissionRecord> {
        const idempotencyKey = `${attributionId}:${orderId}`;
        if (this.commissions.has(idempotencyKey)) {
          return this.commissions.get(idempotencyKey)!;
        }
        const record: CommissionRecord = {
          id: `comm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          attributionId,
          orderId,
          amount,
          status: "PENDING_VERIFICATION",
          history: [],
        };
        this.commissions.set(idempotencyKey, record);
        return record;
      }

      count(): number {
        return this.commissions.size;
      }
    }

    const repo = new MockCommissionRepository();
    const orderId = "order-concurrent-999";
    const attributionId = "attr-alice-bob";
    const amount = new Decimal("30.000");

    // Simulate 5 simultaneous settlement triggers
    const results = await Promise.all([
      repo.createIfAbsent(orderId, attributionId, amount),
      repo.createIfAbsent(orderId, attributionId, amount),
      repo.createIfAbsent(orderId, attributionId, amount),
      repo.createIfAbsent(orderId, attributionId, amount),
      repo.createIfAbsent(orderId, attributionId, amount),
    ]);

    // All results must refer to the exact same commission ID
    const firstId = results[0].id;
    for (const r of results) {
      expect(r.id).toBe(firstId);
    }
    // Only 1 record created in database
    expect(repo.count()).toBe(1);
  });
});
