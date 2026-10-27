import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { d, roundMoney } from "@/lib/money";
import {
  allocateMultiCommissionsOracle,
  evaluatePartnerLevelOracle,
  runProfitSharing,
  transitionCommissionOracle,
  validateReferralIntakeOracle,
  type CommissionRecord,
  type CommissionStatus,
  type PartnerRecord,
  type ReferralAttributionRecord,
  type ReferrerLevel,
} from "./suite-harness.test";

describe("Tier 4: Real-World Application Scenarios", () => {
  // ==========================================================================
  // SCENARIO 1: CANONICAL END-TO-END REFERRAL & COMMISSION LIFECYCLE
  // ==========================================================================
  it("T4.S1: Canonical full lifecycle from referral registration to payment recording", async () => {
    // 1. Approved Partner A (Alice) exists
    const alice: PartnerRecord = {
      id: "partner-alice",
      userId: "user-alice",
      displayName: "Alice",
      code: "P-ALICE",
      status: "ACTIVE",
      email: "alice@example.com",
      phone: "21698111222",
      level: 1,
      qualifiedReferralsCount: 0,
    };

    // 2. Partner B (Bob) registers using Alice's code
    const bobIntake = validateReferralIntakeOracle({
      referrer: alice,
      candidate: { id: "partner-bob", email: "bob@example.com", phone: "21698333444" },
      existingAttributions: [],
    });
    expect(bobIntake.valid).toBe(true);

    const attribution: ReferralAttributionRecord = {
      id: "attr-alice-bob",
      referrerPartnerId: alice.id,
      referredPartnerId: "partner-bob",
      status: "ACTIVE",
      createdAt: new Date(),
    };

    // 3. Bob is initially PENDING, Admin reviews and approves Bob
    const bob: PartnerRecord = {
      id: "partner-bob",
      userId: "user-bob",
      displayName: "Bob",
      code: "P-BOB",
      status: "PENDING",
      email: "bob@example.com",
      phone: "21698333444",
      level: 1,
      qualifiedReferralsCount: 0,
    };
    bob.status = "ACTIVE"; // Admin approves Bob

    // 4. Bob places an order for 5,000 TND with 3,000 TND expenses
    const order = {
      id: "ord-bob-100",
      partnerId: bob.id,
      revenue: new Decimal("5000.000"),
      expenses: new Decimal("3000.000"),
      status: "CONFIRMED",
      earningStatus: "NONE",
    };

    // 5. Order moves through pipeline to DELIVERED
    order.status = "DELIVERED";
    order.earningStatus = "PENDING"; // In 48h settlement holding window

    // 6. 48h settlement window elapses -> COD collected -> AVAILABLE
    order.earningStatus = "AVAILABLE";

    // 7. Referral qualification engine qualifies Alice and computes commission
    const finance = await runProfitSharing({
      revenue: order.revenue,
      expenses: order.expenses,
      referrerLevel: alice.level,
    });
    expect(finance.profit.toFixed(3)).toBe("2000.000");
    expect(finance.adminShare.toFixed(3)).toBe("1400.000");
    expect(finance.remainingPool.toFixed(3)).toBe("600.000");
    expect(finance.referralCommission.toFixed(3)).toBe("30.000");

    // 8. Commission record created in PENDING_VERIFICATION
    const commission: CommissionRecord = {
      id: "comm-ord-bob-100",
      attributionId: attribution.id,
      orderId: order.id,
      amount: finance.referralCommission,
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
    expect(commission.status).toBe("PENDING_VERIFICATION");

    // 9. System verification moves commission to ELIGIBLE
    const verifyTransition = transitionCommissionOracle(commission.status, "ELIGIBLE", {
      actorId: "verifier",
    });
    expect(verifyTransition.ok).toBe(true);
    commission.status = "ELIGIBLE";

    // 10. Admin reviews approval queue and approves commission
    const approveTransition = transitionCommissionOracle(commission.status, "APPROVED_FOR_PAYMENT", {
      actorId: "admin-finance",
    });
    expect(approveTransition.ok).toBe(true);
    commission.status = "APPROVED_FOR_PAYMENT";

    // 11. Payment recorded with bank transfer reference
    const payTransition = transitionCommissionOracle(commission.status, "PAID", {
      actorId: "admin-finance",
      reference: "WIRE-TND-987654",
    });
    expect(payTransition.ok).toBe(true);
    commission.status = "PAID";
    expect(commission.status).toBe("PAID");
  });

  // ==========================================================================
  // SCENARIO 2: MULTI-PARTNER REFERRAL CAMPAIGN & CAREER PROMOTION JOURNEY
  // ==========================================================================
  it("T4.S2: Partner career progression from Level 1 to Level 2 to Level 3 with monotonic rate upgrades", async () => {
    const partner: PartnerRecord = {
      id: "partner-influencer",
      userId: "user-influencer",
      displayName: "Influencer Pro",
      code: "P-INF",
      status: "ACTIVE",
      email: "influencer@example.com",
      phone: "21698777888",
      level: 1,
      qualifiedReferralsCount: 0,
    };

    // Progression stage 1: 0 to 2 referrals (remains Level 1, 5%)
    expect(evaluatePartnerLevelOracle(0).level).toBe(1);
    expect(evaluatePartnerLevelOracle(2).level).toBe(1);

    // Progression stage 2: 3 referrals (promoted to Level 2, 10%)
    partner.qualifiedReferralsCount = 3;
    const l2State = evaluatePartnerLevelOracle(partner.qualifiedReferralsCount);
    expect(l2State.level).toBe(2);
    expect(l2State.rate.toFixed(2)).toBe("0.10");
    partner.level = l2State.level;

    // Progression stage 3: 4 to 9 referrals (remains Level 2, 10%)
    expect(evaluatePartnerLevelOracle(9).level).toBe(2);

    // Progression stage 4: 10 referrals (promoted to Level 3, 15%)
    partner.qualifiedReferralsCount = 10;
    const l3State = evaluatePartnerLevelOracle(partner.qualifiedReferralsCount);
    expect(l3State.level).toBe(3);
    expect(l3State.rate.toFixed(2)).toBe("0.15");
    partner.level = l3State.level;

    // Subsequent order under Level 3 (revenue 2000, expenses 1000 => profit 1000, pool 300)
    const financeL3 = await runProfitSharing({
      revenue: 2000,
      expenses: 1000,
      referrerLevel: partner.level,
    });
    expect(financeL3.remainingPool.toFixed(3)).toBe("300.000");
    expect(financeL3.commissionRate.toFixed(2)).toBe("0.15");
    expect(financeL3.referralCommission.toFixed(3)).toBe("45.000"); // 15% of 300
    expect(financeL3.balanceAfterCommission.toFixed(3)).toBe("255.000");
  });

  // ==========================================================================
  // SCENARIO 3: ORDER RETURN DISPUTE & COMMISSION REVERSAL FLOW
  // ==========================================================================
  it("T4.S3: Order return post-settlement triggers commission reversal with full audit trail", async () => {
    // Delivered order generated commission
    const commission: CommissionRecord = {
      id: "comm-dispute-1",
      attributionId: "attr-dispute",
      orderId: "ord-disputed",
      amount: new Decimal("50.000"),
      status: "APPROVED_FOR_PAYMENT",
      history: [
        { from: null, to: "PENDING_VERIFICATION", actorId: "system", timestamp: new Date() },
        { from: "PENDING_VERIFICATION", to: "ELIGIBLE", actorId: "system", timestamp: new Date() },
        { from: "ELIGIBLE", to: "APPROVED_FOR_PAYMENT", actorId: "admin", timestamp: new Date() },
      ],
    };

    // Return filed by customer due to defect
    const reversal = transitionCommissionOracle(commission.status, "REVERSED", {
      actorId: "admin-disputes",
      reason: "Customer parcel returned defective post-settlement window",
    });
    expect(reversal.ok).toBe(true);

    commission.status = "REVERSED";
    commission.history.push({
      from: "APPROVED_FOR_PAYMENT",
      to: "REVERSED",
      actorId: "admin-disputes",
      timestamp: new Date(),
      reason: "Customer parcel returned defective post-settlement window",
    });

    // Verification: Commission is reversed and cannot transition to PAID
    expect(commission.status).toBe("REVERSED");
    const payAfterReversal = transitionCommissionOracle(commission.status, "PAID", {
      actorId: "admin-finance",
      reference: "WIRE-REF",
    });
    expect(payAfterReversal.ok).toBe(false);
  });

  // ==========================================================================
  // SCENARIO 4: ANTI-FRAUD DEFENSE MATRIX & CYCLE EVASION DETECTION
  // ==========================================================================
  it("T4.S4: Comprehensive anti-fraud defense blocks self-referral, circular collusion, and unapproved actors", () => {
    const victimPartner: PartnerRecord = {
      id: "p-victim",
      userId: "u-victim",
      displayName: "Victim",
      code: "P-VIC",
      status: "ACTIVE",
      email: "victim@example.com",
      phone: "21698111000",
      level: 1,
      qualifiedReferralsCount: 0,
    };

    // Attack 1: Self-referral evasion via phone number format masking
    const attack1 = validateReferralIntakeOracle({
      referrer: victimPartner,
      candidate: { id: "p-attack1", email: "other@example.com", phone: "+216 98 111 000" },
      existingAttributions: [],
    });
    expect(attack1.valid).toBe(false);
    expect(attack1.error).toMatch(/matching phone/i);

    // Attack 2: Circular collusion ring (A -> B -> C -> A)
    const existingRing: ReferralAttributionRecord[] = [
      { id: "a1", referrerPartnerId: "p-a", referredPartnerId: "p-b", status: "ACTIVE", createdAt: new Date() },
      { id: "a2", referrerPartnerId: "p-b", referredPartnerId: "p-c", status: "ACTIVE", createdAt: new Date() },
    ];
    // Candidate C attempts to refer Partner A
    const attack2 = validateReferralIntakeOracle({
      referrer: { ...victimPartner, id: "p-c" },
      candidate: { id: "p-a", email: "a@example.com", phone: "21622000111" },
      existingAttributions: existingRing,
    });
    expect(attack2.valid).toBe(false);
    expect(attack2.error).toMatch(/cycle detected/i);

    // Attack 3: Suspended partner attempts to share referral code
    const suspendedPartner: PartnerRecord = { ...victimPartner, status: "SUSPENDED" };
    const attack3 = validateReferralIntakeOracle({
      referrer: suspendedPartner,
      candidate: { email: "cand@example.com", phone: "21622333444" },
      existingAttributions: [],
    });
    expect(attack3.valid).toBe(false);
    expect(attack3.error).toMatch(/Only approved active partners/i);
  });

  // ==========================================================================
  // SCENARIO 5: CONSOLIDATED SETTLEMENT WITH SHARED EXPENSES & POOL CAP INVARIANCE
  // ==========================================================================
  it("T4.S5: Multi-order batch settlement with shared expenses and pool cap invariance", async () => {
    // 5 settled orders in accounting period: total revenue 8,000 TND
    const batchRevenue = new Decimal("8000.000");
    // Shared marketing, packaging, and warehouse expenses: 3,000 TND
    const batchExpenses = new Decimal("3000.000");

    // Profit P = 5,000. Admin Share A = 3,500 (70%). Pool B = 1,500 (30%).
    const allocation = allocateMultiCommissionsOracle({
      revenue: batchRevenue,
      expenses: batchExpenses,
      commissions: [
        { referrerId: "partner-l2", level: 2 }, // 10% of 1500 = 150
        { referrerId: "partner-l1", level: 1 }, // 5% of 1500 = 75
      ],
    });

    expect(allocation.profit.toFixed(3)).toBe("5000.000");
    expect(allocation.adminShare.toFixed(3)).toBe("3500.000");
    expect(allocation.remainingPool.toFixed(3)).toBe("1500.000");
    expect(allocation.totalCommissionPaid.toFixed(3)).toBe("225.000"); // 150 + 75
    expect(allocation.balanceAfterCommissions.toFixed(3)).toBe("1275.000"); // 1500 - 225

    // Exact Invariance: Admin Share + Commissions Paid + Remaining Balance == Total Profit
    const totalAccounted = allocation.adminShare
      .plus(allocation.totalCommissionPaid)
      .plus(allocation.balanceAfterCommissions);
    expect(totalAccounted.toFixed(3)).toBe(allocation.profit.toFixed(3));
  });
});
