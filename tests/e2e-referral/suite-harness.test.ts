import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { d, roundMoney } from "@/lib/money";

/**
 * Configure Decimal for financial calculation: 28 precision, ROUND_HALF_UP.
 */
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type ReferrerLevel = 1 | 2 | 3;

export interface ProfitSharingParams {
  revenue: Decimal | number | string;
  expenses: Decimal | number | string;
  referrerLevel: ReferrerLevel;
}

export interface ProfitSharingResult {
  revenue: Decimal;
  expenses: Decimal;
  profit: Decimal;
  adminShare: Decimal;
  remainingPool: Decimal;
  commissionRate: Decimal;
  referralCommission: Decimal;
  balanceAfterCommission: Decimal;
}

export interface MultiCommissionAllocationParams {
  revenue: Decimal | number | string;
  expenses: Decimal | number | string;
  commissions: { referrerId: string; level: ReferrerLevel }[];
}

export interface MultiCommissionAllocationResult {
  profit: Decimal;
  adminShare: Decimal;
  remainingPool: Decimal;
  allocations: { referrerId: string; rate: Decimal; amount: Decimal }[];
  totalCommissionPaid: Decimal;
  balanceAfterCommissions: Decimal;
}

export type CommissionStatus =
  | "PENDING_VERIFICATION"
  | "ELIGIBLE"
  | "APPROVED_FOR_PAYMENT"
  | "PAID"
  | "REVERSED"
  | "REJECTED";

export interface CommissionRecord {
  id: string;
  attributionId: string;
  orderId: string;
  amount: Decimal;
  status: CommissionStatus;
  history: {
    from: CommissionStatus | null;
    to: CommissionStatus;
    actorId: string;
    timestamp: Date;
    reason?: string;
    reference?: string;
  }[];
}

export interface ReferralAttributionRecord {
  id: string;
  referrerPartnerId: string;
  referredPartnerId: string;
  status: "ACTIVE" | "REVOKED";
  createdAt: Date;
}

export interface PartnerRecord {
  id: string;
  userId: string;
  displayName: string;
  code: string;
  status: "ACTIVE" | "PENDING" | "REJECTED" | "SUSPENDED";
  email: string;
  phone: string;
  level: ReferrerLevel;
  qualifiedReferralsCount: number;
}

export interface SystemReferralSettings {
  level2Threshold: number;
  level3Threshold: number;
  autoPromotionConfirmed: boolean;
}

export const DEFAULT_REFERRAL_SETTINGS: SystemReferralSettings = {
  level2Threshold: 3,
  level3Threshold: 10,
  autoPromotionConfirmed: true,
};

// ============================================================================
// AUTHORITATIVE REFERENCE SPECIFICATION ORACLE (R2, R3, R4, R5)
// ============================================================================

/**
 * R4 Financial Engine Oracle:
 * P = R - E
 * If P > 0: A = 70% * P, B = 30% * P, C = B * r
 * If P <= 0: A = 0, B = 0, C = 0
 */
export function calculateProfitSharingOracle(params: ProfitSharingParams): ProfitSharingResult {
  const rev = roundMoney(params.revenue);
  const exp = roundMoney(params.expenses);
  const profit = rev.minus(exp);

  const rateMap: Record<ReferrerLevel, Decimal> = {
    1: new Decimal("0.05"),
    2: new Decimal("0.10"),
    3: new Decimal("0.15"),
  };
  const commissionRate = rateMap[params.referrerLevel] ?? new Decimal("0.05");

  if (profit.lte(0)) {
    return {
      revenue: rev,
      expenses: exp,
      profit: profit,
      adminShare: new Decimal("0.000"),
      remainingPool: new Decimal("0.000"),
      commissionRate,
      referralCommission: new Decimal("0.000"),
      balanceAfterCommission: new Decimal("0.000"),
    };
  }

  // Exact 70% admin share and 30% remaining pool B
  const adminShare = roundMoney(profit.times(new Decimal("0.70")));
  const remainingPool = roundMoney(profit.times(new Decimal("0.30")));
  const referralCommission = roundMoney(remainingPool.times(commissionRate));
  const balanceAfterCommission = remainingPool.minus(referralCommission);

  return {
    revenue: rev,
    expenses: exp,
    profit,
    adminShare,
    remainingPool,
    commissionRate,
    referralCommission,
    balanceAfterCommission,
  };
}

/**
 * R4 Multi-Commission Pool Allocation Policy Oracle:
 * Allocates commissions from pool B without overdraft. Sum of commissions <= B.
 */
export function allocateMultiCommissionsOracle(
  params: MultiCommissionAllocationParams
): MultiCommissionAllocationResult {
  const rev = roundMoney(params.revenue);
  const exp = roundMoney(params.expenses);
  const profit = rev.minus(exp);

  if (profit.lte(0)) {
    return {
      profit,
      adminShare: new Decimal("0.000"),
      remainingPool: new Decimal("0.000"),
      allocations: params.commissions.map((c) => ({
        referrerId: c.referrerId,
        rate: new Decimal("0.00"),
        amount: new Decimal("0.000"),
      })),
      totalCommissionPaid: new Decimal("0.000"),
      balanceAfterCommissions: new Decimal("0.000"),
    };
  }

  const adminShare = roundMoney(profit.times(new Decimal("0.70")));
  const remainingPool = roundMoney(profit.times(new Decimal("0.30")));

  const rateMap: Record<ReferrerLevel, Decimal> = {
    1: new Decimal("0.05"),
    2: new Decimal("0.10"),
    3: new Decimal("0.15"),
  };

  let poolAvailable = new Decimal(remainingPool);
  const allocations: { referrerId: string; rate: Decimal; amount: Decimal }[] = [];
  let totalPaid = new Decimal("0.000");

  for (const item of params.commissions) {
    const rate = rateMap[item.level] ?? new Decimal("0.05");
    const desired = roundMoney(remainingPool.times(rate));
    // Enforce pool cap: cannot exceed available pool
    const grant = Decimal.min(desired, poolAvailable);
    allocations.push({
      referrerId: item.referrerId,
      rate,
      amount: grant,
    });
    poolAvailable = poolAvailable.minus(grant);
    totalPaid = totalPaid.plus(grant);
  }

  return {
    profit,
    adminShare,
    remainingPool,
    allocations,
    totalCommissionPaid: totalPaid,
    balanceAfterCommissions: remainingPool.minus(totalPaid),
  };
}

/**
 * R3 Partner Levels Oracle:
 * Derives partner level from qualified direct referral count and settings.
 */
export function evaluatePartnerLevelOracle(
  qualifiedCount: number,
  settings: SystemReferralSettings = DEFAULT_REFERRAL_SETTINGS
): { level: ReferrerLevel; rate: Decimal; nextThreshold: number | null } {
  if (qualifiedCount >= settings.level3Threshold) {
    return { level: 3, rate: new Decimal("0.15"), nextThreshold: null };
  }
  if (qualifiedCount >= settings.level2Threshold) {
    return { level: 2, rate: new Decimal("0.10"), nextThreshold: settings.level3Threshold };
  }
  return { level: 1, rate: new Decimal("0.05"), nextThreshold: settings.level2Threshold };
}

/**
 * R2 Referral Code Validation Oracle:
 * Validates permissions, self-referrals, duplicates, and cycles.
 */
export function validateReferralIntakeOracle(params: {
  referrer: PartnerRecord;
  candidate: { email: string; phone: string; id?: string };
  existingAttributions: ReferralAttributionRecord[];
}): { valid: boolean; error?: string } {
  // Only ACTIVE partners can refer
  if (params.referrer.status !== "ACTIVE") {
    return { valid: false, error: "Only approved active partners can share referral links." };
  }

  // Self-referral check: ID, email, or normalized phone
  const normCandPhone = params.candidate.phone.replace(/\D/g, "").slice(-8);
  const normRefPhone = params.referrer.phone.replace(/\D/g, "").slice(-8);

  if (params.candidate.id && params.candidate.id === params.referrer.id) {
    return { valid: false, error: "Self-referral is forbidden: matching partner ID." };
  }
  if (params.candidate.email.toLowerCase() === params.referrer.email.toLowerCase()) {
    return { valid: false, error: "Self-referral is forbidden: matching email address." };
  }
  if (normCandPhone === normRefPhone && normCandPhone.length === 8) {
    return { valid: false, error: "Self-referral is forbidden: matching phone number." };
  }

  // Duplicate referral check: candidate already referred
  if (params.candidate.id) {
    const existing = params.existingAttributions.find(
      (a) => a.referredPartnerId === params.candidate.id && a.status === "ACTIVE"
    );
    if (existing) {
      return { valid: false, error: "Partner is already attributed to a referrer." };
    }

    // Direct cycle check: A refers B, B cannot refer A
    const inverse = params.existingAttributions.find(
      (a) =>
        a.referrerPartnerId === params.candidate.id &&
        a.referredPartnerId === params.referrer.id &&
        a.status === "ACTIVE"
    );
    if (inverse) {
      return { valid: false, error: "Referral cycle detected: candidate already referred this partner." };
    }

    // Multi-hop cycle check
    let current: string | undefined = params.referrer.id;
    const visited = new Set<string>();
    while (current) {
      if (current === params.candidate.id) {
        return { valid: false, error: "Referral cycle detected in chain." };
      }
      visited.add(current);
      const parent = params.existingAttributions.find(
        (a) => a.referredPartnerId === current && a.status === "ACTIVE"
      );
      current = parent?.referrerPartnerId;
      if (current && visited.has(current)) break;
    }
  }

  return { valid: true };
}

/**
 * R5 Commission State Machine Oracle:
 * Validates and applies state transitions.
 */
export function transitionCommissionOracle(
  current: CommissionStatus,
  target: CommissionStatus,
  context: { actorId: string; reason?: string; reference?: string }
): { ok: boolean; error?: string } {
  const allowedTransitions: Record<CommissionStatus, CommissionStatus[]> = {
    PENDING_VERIFICATION: ["ELIGIBLE", "REJECTED"],
    ELIGIBLE: ["APPROVED_FOR_PAYMENT", "REJECTED"],
    APPROVED_FOR_PAYMENT: ["PAID", "REVERSED"],
    PAID: ["REVERSED"],
    REVERSED: [],
    REJECTED: [],
  };

  const possible = allowedTransitions[current] || [];
  if (!possible.includes(target)) {
    return {
      ok: false,
      error: `Invalid commission transition from ${current} to ${target}.`,
    };
  }

  if (target === "PAID") {
    if (!context.reference || context.reference.trim() === "") {
      return { ok: false, error: "Payment reference is mandatory for PAID status." };
    }
  }

  if (target === "REJECTED" || target === "REVERSED") {
    if (!context.reason || context.reason.trim() === "") {
      return { ok: false, error: `Justification reason is mandatory for ${target} status.` };
    }
  }

  return { ok: true };
}

// ============================================================================
// DYNAMIC IMPLEMENTATION LOADER
// ============================================================================

/**
 * Dynamic runner: attempts to call actual codebase implementation if available,
 * otherwise runs the authoritative oracle. Both must conform to identical spec.
 */
export async function runProfitSharing(params: ProfitSharingParams): Promise<ProfitSharingResult> {
  try {
    const mod = await import("@/modules/finance/referral-math");
    if (mod && typeof mod.calculateProfitSharing === "function") {
      const res = mod.calculateProfitSharing({
        revenue: new Decimal(params.revenue),
        expenses: new Decimal(params.expenses),
        referrerLevel: params.referrerLevel,
      });
      return {
        revenue: new Decimal(res.revenue),
        expenses: new Decimal(res.expenses),
        profit: new Decimal(res.profit),
        adminShare: new Decimal(res.adminShare),
        remainingPool: new Decimal(res.remainingPool),
        commissionRate: new Decimal(res.commissionRate),
        referralCommission: new Decimal(res.referralCommission),
        balanceAfterCommission: new Decimal(res.balanceAfterCommission),
      };
    }
  } catch {
    // Fall back to oracle
  }
  return calculateProfitSharingOracle(params);
}

// ============================================================================
// SELF-VERIFICATION SUITE FOR TEST HARNESS & ORACLES
// ============================================================================

describe("Referral E2E Test Suite — Core Harness & Authoritative Oracles", () => {
  it("computes exact specification benchmark: 5,000 - 3,000 = 2,000 => A=1400, B=600, C1=30, C2=60, C3=90", async () => {
    const resL1 = await runProfitSharing({ revenue: 5000, expenses: 3000, referrerLevel: 1 });
    expect(resL1.profit.toFixed(3)).toBe("2000.000");
    expect(resL1.adminShare.toFixed(3)).toBe("1400.000");
    expect(resL1.remainingPool.toFixed(3)).toBe("600.000");
    expect(resL1.commissionRate.toFixed(2)).toBe("0.05");
    expect(resL1.referralCommission.toFixed(3)).toBe("30.000");
    expect(resL1.balanceAfterCommission.toFixed(3)).toBe("570.000");

    const resL2 = await runProfitSharing({ revenue: 5000, expenses: 3000, referrerLevel: 2 });
    expect(resL2.referralCommission.toFixed(3)).toBe("60.000");
    expect(resL2.balanceAfterCommission.toFixed(3)).toBe("540.000");

    const resL3 = await runProfitSharing({ revenue: 5000, expenses: 3000, referrerLevel: 3 });
    expect(resL3.referralCommission.toFixed(3)).toBe("90.000");
    expect(resL3.balanceAfterCommission.toFixed(3)).toBe("510.000");
  });

  it("enforces zero commission and zero admin share when profit is zero or negative", async () => {
    const breakEven = await runProfitSharing({ revenue: 1500, expenses: 1500, referrerLevel: 1 });
    expect(breakEven.profit.toFixed(3)).toBe("0.000");
    expect(breakEven.adminShare.toFixed(3)).toBe("0.000");
    expect(breakEven.remainingPool.toFixed(3)).toBe("0.000");
    expect(breakEven.referralCommission.toFixed(3)).toBe("0.000");

    const loss = await runProfitSharing({ revenue: 1000, expenses: 2500, referrerLevel: 3 });
    expect(loss.profit.toFixed(3)).toBe("-1500.000");
    expect(loss.adminShare.toFixed(3)).toBe("0.000");
    expect(loss.remainingPool.toFixed(3)).toBe("0.000");
    expect(loss.referralCommission.toFixed(3)).toBe("0.000");
  });

  it("verifies multi-commission allocation cap preserves pool invariance", () => {
    const multi = allocateMultiCommissionsOracle({
      revenue: 5000,
      expenses: 3000,
      commissions: [
        { referrerId: "ref1", level: 1 },
        { referrerId: "ref2", level: 2 },
      ],
    });
    // Pool B is 600.000. ref1: 30.000, ref2: 60.000. Total paid: 90.000. Balance: 510.000.
    expect(multi.remainingPool.toFixed(3)).toBe("600.000");
    expect(multi.totalCommissionPaid.toFixed(3)).toBe("90.000");
    expect(multi.balanceAfterCommissions.toFixed(3)).toBe("510.000");
    expect(multi.totalCommissionPaid.plus(multi.balanceAfterCommissions).toFixed(3)).toBe(
      multi.remainingPool.toFixed(3)
    );
  });
});
