import Decimal from "decimal.js";
import { d, roundMoney } from "@/lib/money";

/**
 * Pure referral money math engine.
 * Currency: Tunisian Dinar (TND / DT), exactly 3 decimal places (millimes).
 * All calculations use Decimal.js with ROUND_HALF_UP — floating-point arithmetic is forbidden.
 *
 * Requirements:
 * - P = R - E (Profit after approved business expenses)
 * - When P > 0:
 *     Admin share A = 70% × P
 *     Remaining pool B = 30% × P (or P - A, ensuring A + B = P)
 *     Referral commission C = B × r, where r is referrer's level rate:
 *       Level 1 = 5% (0.05)
 *       Level 2 = 10% (0.10)
 *       Level 3 = 15% (0.15)
 *     Balance after commission = B - C
 * - When P <= 0:
 *     A = 0, B = 0, C = 0, balanceAfterCommission = 0
 * - Multi-commission pool allocation cap:
 *     The sum of commissions drawing from Pool B cannot exceed Pool B.
 */

export type ReferralLevel = 1 | 2 | 3;

/** Share rates as exact decimals */
export const ADMIN_PROFIT_SHARE_RATE = new Decimal("0.70"); // 70%
export const REMAINING_POOL_RATE = new Decimal("0.30"); // 30%

/** Commission rates per referral tier (percentage of Pool B) */
export const REFERRAL_RATES: Record<ReferralLevel, Decimal> = {
  1: new Decimal("0.05"), // 5%
  2: new Decimal("0.10"), // 10%
  3: new Decimal("0.15"), // 15%
};

/** Get the commission rate Decimal for a given partner level */
export function getReferralCommissionRate(level: ReferralLevel): Decimal {
  const rate = REFERRAL_RATES[level];
  if (!rate) {
    throw new Error(`Invalid referral level: ${level}. Must be 1, 2, or 3.`);
  }
  return rate;
}

export interface ProfitSharingInput {
  /** Actual collected/settled revenue R */
  revenue: Decimal | number | string;
  /** Approved attributable business expenses E */
  expenses: Decimal | number | string;
  /** Direct referrer tier level (1, 2, or 3) */
  referrerLevel?: ReferralLevel;
  /** Custom commission rate override if applicable */
  commissionRate?: Decimal | number | string;
}

export interface ProfitSharingResult {
  /** R: Settled revenue */
  revenue: Decimal;
  /** E: Deducted business expenses */
  expenses: Decimal;
  /** P: Profit before distribution (R - E) */
  profit: Decimal;
  /** A: Admin profit share (70% of P when P > 0, else 0) */
  adminShare: Decimal;
  /** B: Net remaining pool for referral commissions (30% of P when P > 0, else 0) */
  remainingPool: Decimal;
  /** r: Commission rate applied (e.g. 0.05, 0.10, 0.15) */
  commissionRate: Decimal;
  /** C: Referral commission (B × r when P > 0, else 0) */
  referralCommission: Decimal;
  /** Balance remaining in Pool B after deducting commission (B - C) */
  balanceAfterCommission: Decimal;
  /** True when P > 0 */
  isProfitable: boolean;
  /** Explicit currency */
  currency: string;
}

/**
 * Calculates profit distribution and referral commission according to Requirement R4.
 *
 * Example:
 *   R = 5,000 TND, E = 3,000 TND
 *   -> P = 2,000 TND
 *   -> A = 1,400 TND (70%)
 *   -> B = 600 TND (30%)
 *   -> Level 1 (5%): C = 30 TND, Balance = 570 TND
 *   -> Level 2 (10%): C = 60 TND, Balance = 540 TND
 *   -> Level 3 (15%): C = 90 TND, Balance = 510 TND
 *
 * When P <= 0:
 *   -> A = 0, B = 0, C = 0, Balance = 0
 */
export function calculateProfitSharing(input: ProfitSharingInput): ProfitSharingResult {
  const currency = "TND";
  const revenue = roundMoney(d(input.revenue));
  const expenses = roundMoney(d(input.expenses));

  // P = R - E
  const profit = roundMoney(revenue.minus(expenses));

  // Determine rate
  let commissionRate: Decimal;
  if (input.referrerLevel !== undefined) {
    commissionRate = getReferralCommissionRate(input.referrerLevel);
  } else if (input.commissionRate !== undefined) {
    commissionRate = d(input.commissionRate);
  } else {
    commissionRate = d(0);
  }

  // If P <= 0: generate no positive commission and no positive admin profit share
  if (profit.lessThanOrEqualTo(0)) {
    return {
      revenue,
      expenses,
      profit,
      adminShare: d(0),
      remainingPool: d(0),
      commissionRate,
      referralCommission: d(0),
      balanceAfterCommission: d(0),
      isProfitable: false,
      currency,
    };
  }

  // When P > 0:
  // Admin share A = 70% * P
  const adminShare = roundMoney(profit.times(ADMIN_PROFIT_SHARE_RATE));

  // Remaining pool B = P - A = 30% * P (preserves exact conservation: A + B = P)
  const remainingPool = roundMoney(profit.minus(adminShare));

  // Referral commission C = B * r (cannot exceed remainingPool)
  let referralCommission = roundMoney(remainingPool.times(commissionRate));
  if (referralCommission.greaterThan(remainingPool)) {
    referralCommission = remainingPool;
  }

  // Balance in pool after commission: B - C
  const balanceAfterCommission = roundMoney(remainingPool.minus(referralCommission));

  return {
    revenue,
    expenses,
    profit,
    adminShare,
    remainingPool,
    commissionRate,
    referralCommission,
    balanceAfterCommission,
    isProfitable: true,
    currency,
  };
}

/**
 * Calculates direct commission for a given pool amount and referral level.
 * When pool <= 0, returns 0.
 */
export function calculateReferralCommission(
  pool: Decimal | number | string,
  level: ReferralLevel,
): Decimal {
  const poolAmount = roundMoney(d(pool));
  if (poolAmount.lessThanOrEqualTo(0)) {
    return d(0);
  }
  const rate = getReferralCommissionRate(level);
  const commission = roundMoney(poolAmount.times(rate));
  return Decimal.min(commission, poolAmount);
}

export type AllocationPolicy = "PRO_RATA" | "FIFO";

export interface CommissionAllocationRequest {
  /** Identifier for attribution or partner */
  id: string;
  partnerId?: string;
  /** Partner level to derive rate from */
  level?: ReferralLevel;
  /** Explicit rate override */
  rate?: Decimal | number | string;
  /** Explicit requested amount if already calculated */
  requestedAmount?: Decimal | number | string;
}

export interface AllocatedCommission {
  id: string;
  partnerId?: string;
  level?: ReferralLevel;
  rate: Decimal;
  requestedAmount: Decimal;
  allocatedAmount: Decimal;
  isCapped: boolean;
}

export interface PoolAllocationResult {
  totalPool: Decimal;
  totalRequested: Decimal;
  totalAllocated: Decimal;
  remainingPool: Decimal;
  isExceeded: boolean;
  allocations: AllocatedCommission[];
}

/**
 * Enforces multi-commission pool allocation cap.
 * If multiple eligible commissions draw from the same pool B,
 * this function guarantees that sum(allocated commissions) <= pool B.
 *
 * Supported policies:
 * - "PRO_RATA" (default): Scales down all requested commissions proportionally.
 * - "FIFO": Satisfies requests in arrival order until the pool is exhausted.
 */
export function allocateCommissionsFromPool(
  pool: Decimal | number | string,
  requests: CommissionAllocationRequest[],
  policy: AllocationPolicy = "PRO_RATA",
): PoolAllocationResult {
  const totalPool = roundMoney(d(pool));

  // If pool <= 0, no commissions can be allocated
  if (totalPool.lessThanOrEqualTo(0)) {
    const zeroAllocations: AllocatedCommission[] = requests.map((req) => {
      const rate = req.level
        ? getReferralCommissionRate(req.level)
        : req.rate !== undefined
          ? d(req.rate)
          : d(0);
      const requestedAmount =
        req.requestedAmount !== undefined
          ? roundMoney(d(req.requestedAmount))
          : d(0);
      return {
        id: req.id,
        partnerId: req.partnerId,
        level: req.level,
        rate,
        requestedAmount,
        allocatedAmount: d(0),
        isCapped: requestedAmount.greaterThan(0),
      };
    });

    return {
      totalPool: d(0),
      totalRequested: zeroAllocations.reduce((acc, a) => acc.plus(a.requestedAmount), d(0)),
      totalAllocated: d(0),
      remainingPool: d(0),
      isExceeded: true,
      allocations: zeroAllocations,
    };
  }

  // Pre-calculate requested amounts for each candidate
  let totalRequested = d(0);
  const prepared = requests.map((req) => {
    let rate = d(0);
    if (req.level !== undefined) {
      rate = getReferralCommissionRate(req.level);
    } else if (req.rate !== undefined) {
      rate = d(req.rate);
    }

    let requestedAmount: Decimal;
    if (req.requestedAmount !== undefined) {
      requestedAmount = roundMoney(d(req.requestedAmount));
    } else {
      requestedAmount = roundMoney(totalPool.times(rate));
    }

    totalRequested = totalRequested.plus(requestedAmount);
    return {
      id: req.id,
      partnerId: req.partnerId,
      level: req.level,
      rate,
      requestedAmount,
    };
  });

  totalRequested = roundMoney(totalRequested);

  // If total requested fits inside the pool, allocate fully
  if (totalRequested.lessThanOrEqualTo(totalPool)) {
    const allocations: AllocatedCommission[] = prepared.map((p) => ({
      ...p,
      allocatedAmount: p.requestedAmount,
      isCapped: false,
    }));
    return {
      totalPool,
      totalRequested,
      totalAllocated: totalRequested,
      remainingPool: roundMoney(totalPool.minus(totalRequested)),
      isExceeded: false,
      allocations,
    };
  }

  // Total requested exceeds pool -> apply allocation policy
  const isExceeded = true;
  const allocations: AllocatedCommission[] = [];

  if (policy === "FIFO") {
    let available = totalPool;
    for (const item of prepared) {
      const grant = Decimal.min(available, item.requestedAmount);
      const allocatedAmount = roundMoney(grant);
      available = roundMoney(available.minus(allocatedAmount));
      allocations.push({
        ...item,
        allocatedAmount,
        isCapped: allocatedAmount.lessThan(item.requestedAmount),
      });
    }
  } else {
    // PRO_RATA: scale proportionally to totalPool / totalRequested
    let sumAllocated = d(0);

    for (const item of prepared) {
      if (totalRequested.isZero()) {
        allocations.push({
          ...item,
          allocatedAmount: d(0),
          isCapped: false,
        });
        continue;
      }
      // alloc = (requestedAmount / totalRequested) * totalPool
      const share = item.requestedAmount.times(totalPool).dividedBy(totalRequested);
      const allocatedAmount = roundMoney(share);
      sumAllocated = sumAllocated.plus(allocatedAmount);
      allocations.push({
        ...item,
        allocatedAmount,
        isCapped: allocatedAmount.lessThan(item.requestedAmount),
      });
    }

    // Safety adjustment: if sumAllocated > totalPool due to round-up, deduct millimes from largest share
    while (sumAllocated.greaterThan(totalPool)) {
      const diff = sumAllocated.minus(totalPool);
      // Find allocation with largest amount
      let maxIdx = 0;
      let maxAmt = allocations[0]?.allocatedAmount ?? d(0);
      for (let i = 1; i < allocations.length; i++) {
        if (allocations[i]!.allocatedAmount.greaterThan(maxAmt)) {
          maxAmt = allocations[i]!.allocatedAmount;
          maxIdx = i;
        }
      }
      const decrement = Decimal.min(diff, new Decimal("0.001"));
      allocations[maxIdx]!.allocatedAmount = roundMoney(
        allocations[maxIdx]!.allocatedAmount.minus(decrement),
      );
      allocations[maxIdx]!.isCapped = true;
      sumAllocated = sumAllocated.minus(decrement);
    }
  }

  const finalTotalAllocated = allocations.reduce((acc, a) => acc.plus(a.allocatedAmount), d(0));
  const remainingPool = roundMoney(Decimal.max(0, totalPool.minus(finalTotalAllocated)));

  return {
    totalPool,
    totalRequested,
    totalAllocated: roundMoney(finalTotalAllocated),
    remainingPool,
    isExceeded,
    allocations,
  };
}
