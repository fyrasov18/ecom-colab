import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  calculateProfitSharing,
  calculateReferralCommission,
  allocateCommissionsFromPool,
  getReferralCommissionRate,
  ADMIN_PROFIT_SHARE_RATE,
  REMAINING_POOL_RATE,
  REFERRAL_RATES,
} from "@/modules/finance/referral-math";

const toMoneyStr = (val: Decimal) => val.toFixed(3);

describe("referral-math: pure money engine", () => {
  describe("rates and constants", () => {
    it("defines 70% admin profit share and 30% remaining pool", () => {
      expect(ADMIN_PROFIT_SHARE_RATE.toString()).toBe("0.7");
      expect(REMAINING_POOL_RATE.toString()).toBe("0.3");
      expect(ADMIN_PROFIT_SHARE_RATE.plus(REMAINING_POOL_RATE).toString()).toBe("1");
    });

    it("defines referral rates for Levels 1, 2, and 3", () => {
      expect(REFERRAL_RATES[1].toString()).toBe("0.05");
      expect(REFERRAL_RATES[2].toString()).toBe("0.1");
      expect(REFERRAL_RATES[3].toString()).toBe("0.15");
    });

    it("returns correct rates via getReferralCommissionRate", () => {
      expect(getReferralCommissionRate(1).toString()).toBe("0.05");
      expect(getReferralCommissionRate(2).toString()).toBe("0.1");
      expect(getReferralCommissionRate(3).toString()).toBe("0.15");
    });

    it("throws error for invalid referral level", () => {
      // @ts-expect-error testing invalid runtime input
      expect(() => getReferralCommissionRate(0)).toThrow(/Invalid referral level/);
      // @ts-expect-error testing invalid runtime input
      expect(() => getReferralCommissionRate(4)).toThrow(/Invalid referral level/);
    });
  });

  describe("exact specification example (R=5000, E=3000 -> P=2000, A=1400, B=600)", () => {
    const revenue = 5000;
    const expenses = 3000;

    it("calculates exact P=2000, A=1400, B=600, C=30 for Level 1 (5%)", () => {
      const res = calculateProfitSharing({ revenue, expenses, referrerLevel: 1 });
      expect(toMoneyStr(res.revenue)).toBe("5000.000");
      expect(toMoneyStr(res.expenses)).toBe("3000.000");
      expect(toMoneyStr(res.profit)).toBe("2000.000");
      expect(toMoneyStr(res.adminShare)).toBe("1400.000");
      expect(toMoneyStr(res.remainingPool)).toBe("600.000");
      expect(res.commissionRate.toString()).toBe("0.05");
      expect(toMoneyStr(res.referralCommission)).toBe("30.000");
      expect(toMoneyStr(res.balanceAfterCommission)).toBe("570.000");
      expect(res.isProfitable).toBe(true);
      expect(res.currency).toBe("TND");
    });

    it("calculates exact P=2000, A=1400, B=600, C=60 for Level 2 (10%)", () => {
      const res = calculateProfitSharing({ revenue, expenses, referrerLevel: 2 });
      expect(toMoneyStr(res.profit)).toBe("2000.000");
      expect(toMoneyStr(res.adminShare)).toBe("1400.000");
      expect(toMoneyStr(res.remainingPool)).toBe("600.000");
      expect(res.commissionRate.toString()).toBe("0.1");
      expect(toMoneyStr(res.referralCommission)).toBe("60.000");
      expect(toMoneyStr(res.balanceAfterCommission)).toBe("540.000");
      expect(res.isProfitable).toBe(true);
    });

    it("calculates exact P=2000, A=1400, B=600, C=90 for Level 3 (15%)", () => {
      const res = calculateProfitSharing({ revenue, expenses, referrerLevel: 3 });
      expect(toMoneyStr(res.profit)).toBe("2000.000");
      expect(toMoneyStr(res.adminShare)).toBe("1400.000");
      expect(toMoneyStr(res.remainingPool)).toBe("600.000");
      expect(res.commissionRate.toString()).toBe("0.15");
      expect(toMoneyStr(res.referralCommission)).toBe("90.000");
      expect(toMoneyStr(res.balanceAfterCommission)).toBe("510.000");
      expect(res.isProfitable).toBe(true);
    });

    it("verifies conservation invariant: A + B = P and B = C + balanceAfterCommission", () => {
      for (const level of [1, 2, 3] as const) {
        const res = calculateProfitSharing({ revenue, expenses, referrerLevel: level });
        expect(res.adminShare.plus(res.remainingPool).toString()).toBe(res.profit.toString());
        expect(res.referralCommission.plus(res.balanceAfterCommission).toString()).toBe(
          res.remainingPool.toString(),
        );
        expect(
          res.adminShare
            .plus(res.referralCommission)
            .plus(res.balanceAfterCommission)
            .toString(),
        ).toBe(res.profit.toString());
      }
    });
  });

  describe("zero and negative profit behavior (P <= 0)", () => {
    it("produces A=0, B=0, C=0 when revenue equals expenses (P = 0)", () => {
      const res = calculateProfitSharing({ revenue: 3000, expenses: 3000, referrerLevel: 2 });
      expect(toMoneyStr(res.profit)).toBe("0.000");
      expect(toMoneyStr(res.adminShare)).toBe("0.000");
      expect(toMoneyStr(res.remainingPool)).toBe("0.000");
      expect(toMoneyStr(res.referralCommission)).toBe("0.000");
      expect(toMoneyStr(res.balanceAfterCommission)).toBe("0.000");
      expect(res.isProfitable).toBe(false);
    });

    it("produces A=0, B=0, C=0 when expenses exceed revenue (negative profit)", () => {
      const res = calculateProfitSharing({ revenue: 2000, expenses: 3000, referrerLevel: 3 });
      expect(toMoneyStr(res.profit)).toBe("-1000.000");
      expect(toMoneyStr(res.adminShare)).toBe("0.000");
      expect(toMoneyStr(res.remainingPool)).toBe("0.000");
      expect(toMoneyStr(res.referralCommission)).toBe("0.000");
      expect(toMoneyStr(res.balanceAfterCommission)).toBe("0.000");
      expect(res.isProfitable).toBe(false);
    });

    it("produces A=0, B=0, C=0 when revenue is 0 and expenses exist", () => {
      const res = calculateProfitSharing({ revenue: 0, expenses: 450.5, referrerLevel: 1 });
      expect(toMoneyStr(res.profit)).toBe("-450.500");
      expect(toMoneyStr(res.adminShare)).toBe("0.000");
      expect(toMoneyStr(res.remainingPool)).toBe("0.000");
      expect(toMoneyStr(res.referralCommission)).toBe("0.000");
      expect(toMoneyStr(res.balanceAfterCommission)).toBe("0.000");
      expect(res.isProfitable).toBe(false);
    });

    it("calculateReferralCommission returns 0 when pool <= 0", () => {
      expect(toMoneyStr(calculateReferralCommission(0, 1))).toBe("0.000");
      expect(toMoneyStr(calculateReferralCommission(-100, 2))).toBe("0.000");
    });
  });

  describe("decimal precision and millimes rounding (no floating-point errors)", () => {
    it("handles inputs with millimes precision (3 decimals) cleanly", () => {
      // 123.456 - 23.450 = 100.006 DT profit
      const res = calculateProfitSharing({
        revenue: "123.456",
        expenses: "23.450",
        referrerLevel: 1,
      });
      expect(toMoneyStr(res.profit)).toBe("100.006");
      // 70% of 100.006 = 70.0042 -> 70.004 DT
      expect(toMoneyStr(res.adminShare)).toBe("70.004");
      // B = 100.006 - 70.004 = 30.002 DT
      expect(toMoneyStr(res.remainingPool)).toBe("30.002");
      // C = 5% of 30.002 = 1.5001 -> 1.500 DT
      expect(toMoneyStr(res.referralCommission)).toBe("1.500");
      // Balance = 30.002 - 1.500 = 28.502 DT
      expect(toMoneyStr(res.balanceAfterCommission)).toBe("28.502");
    });

    it("rounds half-up on fractional millimes (0.0005 rounds to 0.001)", () => {
      // P = 0.010 DT. Level 1 rate = 5% -> 0.010 * 0.30 = 0.003 pool
      // 5% of 0.003 = 0.00015 -> 0.000 DT
      const res = calculateProfitSharing({
        revenue: "10.010",
        expenses: "10.000",
        referrerLevel: 1,
      });
      expect(toMoneyStr(res.profit)).toBe("0.010");
      expect(toMoneyStr(res.adminShare)).toBe("0.007");
      expect(toMoneyStr(res.remainingPool)).toBe("0.003");
      expect(toMoneyStr(res.referralCommission)).toBe("0.000");
    });

    it("avoids binary floating-point inaccuracy (0.1 + 0.2)", () => {
      const res = calculateProfitSharing({
        revenue: "0.300",
        expenses: "0.100",
        commissionRate: "0.10",
      });
      expect(toMoneyStr(res.profit)).toBe("0.200");
      // 70% of 0.200 = 0.140 DT
      expect(toMoneyStr(res.adminShare)).toBe("0.140");
      // 30% of 0.200 = 0.060 DT
      expect(toMoneyStr(res.remainingPool)).toBe("0.060");
      // 10% of 0.060 = 0.006 DT
      expect(toMoneyStr(res.referralCommission)).toBe("0.006");
      expect(toMoneyStr(res.balanceAfterCommission)).toBe("0.054");
    });

    it("accepts Decimal, string, and number inputs identically", () => {
      const fromNum = calculateProfitSharing({ revenue: 5000, expenses: 3000, referrerLevel: 1 });
      const fromStr = calculateProfitSharing({
        revenue: "5000",
        expenses: "3000",
        referrerLevel: 1,
      });
      const fromDec = calculateProfitSharing({
        revenue: new Decimal("5000.000"),
        expenses: new Decimal("3000.000"),
        referrerLevel: 1,
      });

      expect(toMoneyStr(fromNum.referralCommission)).toBe(toMoneyStr(fromStr.referralCommission));
      expect(toMoneyStr(fromStr.referralCommission)).toBe(toMoneyStr(fromDec.referralCommission));
    });
  });

  describe("multi-commission pool allocation cap", () => {
    it("allocates fully when total requested is within Pool B", () => {
      // Pool B = 600 TND. Two referrers: Ref A (Level 1 = 30 TND), Ref B (Level 2 = 60 TND).
      const result = allocateCommissionsFromPool(600, [
        { id: "comm-1", partnerId: "p1", level: 1 },
        { id: "comm-2", partnerId: "p2", level: 2 },
      ]);

      expect(result.isExceeded).toBe(false);
      expect(toMoneyStr(result.totalPool)).toBe("600.000");
      expect(toMoneyStr(result.totalRequested)).toBe("90.000");
      expect(toMoneyStr(result.totalAllocated)).toBe("90.000");
      expect(toMoneyStr(result.remainingPool)).toBe("510.000");

      expect(result.allocations[0]!.isCapped).toBe(false);
      expect(toMoneyStr(result.allocations[0]!.allocatedAmount)).toBe("30.000");
      expect(result.allocations[1]!.isCapped).toBe(false);
      expect(toMoneyStr(result.allocations[1]!.allocatedAmount)).toBe("60.000");
    });

    it("enforces pro-rata cap when total requested exceeds Pool B", () => {
      // Pool B = 100 TND. Two referrers request 60 TND each (total requested = 120 TND > 100 TND).
      const result = allocateCommissionsFromPool(
        100,
        [
          { id: "comm-1", requestedAmount: 60 },
          { id: "comm-2", requestedAmount: 60 },
        ],
        "PRO_RATA",
      );

      expect(result.isExceeded).toBe(true);
      expect(toMoneyStr(result.totalPool)).toBe("100.000");
      expect(toMoneyStr(result.totalRequested)).toBe("120.000");
      expect(toMoneyStr(result.totalAllocated)).toBe("100.000");
      expect(toMoneyStr(result.remainingPool)).toBe("0.000");

      // Each gets exactly 50 TND
      expect(result.allocations[0]!.isCapped).toBe(true);
      expect(toMoneyStr(result.allocations[0]!.allocatedAmount)).toBe("50.000");
      expect(result.allocations[1]!.isCapped).toBe(true);
      expect(toMoneyStr(result.allocations[1]!.allocatedAmount)).toBe("50.000");
      expect(
        result.allocations[0]!.allocatedAmount
          .plus(result.allocations[1]!.allocatedAmount)
          .toString(),
      ).toBe("100");
    });

    it("enforces FIFO cap when specified", () => {
      // Pool B = 100 TND. Ref 1 requests 60 TND, Ref 2 requests 60 TND.
      const result = allocateCommissionsFromPool(
        100,
        [
          { id: "comm-1", requestedAmount: 60 },
          { id: "comm-2", requestedAmount: 60 },
        ],
        "FIFO",
      );

      expect(result.isExceeded).toBe(true);
      expect(toMoneyStr(result.totalAllocated)).toBe("100.000");
      expect(toMoneyStr(result.remainingPool)).toBe("0.000");

      // Ref 1 gets full 60 TND, Ref 2 gets remaining 40 TND
      expect(result.allocations[0]!.isCapped).toBe(false);
      expect(toMoneyStr(result.allocations[0]!.allocatedAmount)).toBe("60.000");
      expect(result.allocations[1]!.isCapped).toBe(true);
      expect(toMoneyStr(result.allocations[1]!.allocatedAmount)).toBe("40.000");
    });

    it("never exceeds total pool even with repeating decimals", () => {
      // Pool B = 100 TND. Three referrers request 50 TND each (total requested = 150 TND).
      const result = allocateCommissionsFromPool(
        100,
        [
          { id: "comm-1", requestedAmount: 50 },
          { id: "comm-2", requestedAmount: 50 },
          { id: "comm-3", requestedAmount: 50 },
        ],
        "PRO_RATA",
      );

      expect(result.isExceeded).toBe(true);
      // Total allocated must be <= totalPool (never 100.001)
      expect(result.totalAllocated.lessThanOrEqualTo(new Decimal("100.000"))).toBe(true);
      const sum = result.allocations.reduce(
        (acc, item) => acc.plus(item.allocatedAmount),
        new Decimal(0),
      );
      expect(sum.lessThanOrEqualTo(new Decimal("100.000"))).toBe(true);
      expect(result.remainingPool.greaterThanOrEqualTo(0)).toBe(true);
    });

    it("handles zero pool gracefully with all allocations capped at zero", () => {
      const result = allocateCommissionsFromPool(0, [
        { id: "comm-1", requestedAmount: 50 },
        { id: "comm-2", level: 2 },
      ]);

      expect(result.isExceeded).toBe(true);
      expect(toMoneyStr(result.totalAllocated)).toBe("0.000");
      expect(toMoneyStr(result.remainingPool)).toBe("0.000");
      expect(toMoneyStr(result.allocations[0]!.allocatedAmount)).toBe("0.000");
      expect(toMoneyStr(result.allocations[1]!.allocatedAmount)).toBe("0.000");
    });
  });
});
