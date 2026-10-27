import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  calculateProfitSharing,
  calculateReferralCommission,
  allocateCommissionsFromPool,
  getReferralCommissionRate,
} from "@/modules/finance/referral-math";

const toMoney = (val: Decimal) => val.toFixed(3);

describe("Challenger 1: Financial Invariants and Empirical Stress Testing", () => {
  describe("Invariant 1: Conservation of Profit (A + B = P) for all positive values of P", () => {
    it("satisfies A + B = P for minimum positive profit (1 millime = 0.001 TND)", () => {
      const res = calculateProfitSharing({ revenue: "0.001", expenses: "0.000", referrerLevel: 1 });
      expect(toMoney(res.profit)).toBe("0.001");
      expect(toMoney(res.adminShare)).toBe("0.001");
      expect(toMoney(res.remainingPool)).toBe("0.000");
      expect(res.adminShare.plus(res.remainingPool).toString()).toBe(res.profit.toString());
      expect(toMoney(res.referralCommission)).toBe("0.000");
      expect(toMoney(res.balanceAfterCommission)).toBe("0.000");
    });

    it("satisfies A + B = P for 2 millimes (0.002 TND)", () => {
      const res = calculateProfitSharing({ revenue: "0.002", expenses: "0.000", referrerLevel: 1 });
      expect(toMoney(res.profit)).toBe("0.002");
      expect(toMoney(res.adminShare)).toBe("0.001");
      expect(toMoney(res.remainingPool)).toBe("0.001");
      expect(res.adminShare.plus(res.remainingPool).toString()).toBe(res.profit.toString());
      expect(res.referralCommission.plus(res.balanceAfterCommission).toString()).toBe(
        res.remainingPool.toString(),
      );
    });

    it("satisfies A + B = P for odd fractions where 70% and 30% round in opposing directions", () => {
      // P = 0.005 DT. 70% of 0.005 = 0.0035 -> 0.004 DT.
      // 30% of 0.005 = 0.0015 -> 0.002 DT if calculated separately (sum would be 0.006 != 0.005).
      // But B = P - A = 0.005 - 0.004 = 0.001 DT.
      const res = calculateProfitSharing({ revenue: "0.005", expenses: "0.000", referrerLevel: 3 });
      expect(toMoney(res.profit)).toBe("0.005");
      expect(toMoney(res.adminShare)).toBe("0.004");
      expect(toMoney(res.remainingPool)).toBe("0.001");
      expect(res.adminShare.plus(res.remainingPool).toString()).toBe("0.005");
    });

    it("satisfies A + B = P across a wide sweep of fractional millime values", () => {
      const values = [
        "0.003", "0.007", "0.011", "0.015", "0.033", "0.099",
        "1.111", "7.777", "13.333", "99.999", "123.456", "333.333",
        "777.777", "999.999", "1000.001", "5432.109"
      ];

      for (const val of values) {
        for (const level of [1, 2, 3] as const) {
          const res = calculateProfitSharing({ revenue: val, expenses: "0.000", referrerLevel: level });
          expect(res.adminShare.plus(res.remainingPool).toString()).toBe(res.profit.toString());
          expect(res.referralCommission.plus(res.balanceAfterCommission).toString()).toBe(
            res.remainingPool.toString(),
          );
          expect(
            res.adminShare.plus(res.referralCommission).plus(res.balanceAfterCommission).toString(),
          ).toBe(res.profit.toString());
        }
      }
    });

    it("satisfies A + B = P for extreme large volume (10,000,000 TND)", () => {
      const res = calculateProfitSharing({
        revenue: "15000000.000",
        expenses: "5000000.000",
        referrerLevel: 3,
      });
      expect(toMoney(res.profit)).toBe("10000000.000");
      expect(toMoney(res.adminShare)).toBe("7000000.000");
      expect(toMoney(res.remainingPool)).toBe("3000000.000");
      expect(toMoney(res.referralCommission)).toBe("450000.000");
      expect(toMoney(res.balanceAfterCommission)).toBe("2550000.000");
      expect(res.adminShare.plus(res.remainingPool).toString()).toBe("10000000");
    });
  });

  describe("Invariant 2: Referral Commission C <= Remaining Pool B", () => {
    it("guarantees C <= B across all levels and arbitrary positive pools", () => {
      const testProfits = ["0.001", "0.002", "0.005", "0.010", "1.000", "50.000", "5000.000", "10000000.000"];

      for (const profitStr of testProfits) {
        for (const level of [1, 2, 3] as const) {
          const res = calculateProfitSharing({ revenue: profitStr, expenses: "0.000", referrerLevel: level });
          expect(res.referralCommission.lessThanOrEqualTo(res.remainingPool)).toBe(true);
        }
      }
    });

    it("caps commission at remaining pool B even if a custom rate > 100% is passed", () => {
      const res = calculateProfitSharing({
        revenue: "1000.000",
        expenses: "0.000",
        commissionRate: "1.50", // 150% rate
      });
      // P = 1000, A = 700, B = 300
      expect(toMoney(res.remainingPool)).toBe("300.000");
      expect(toMoney(res.referralCommission)).toBe("300.000");
      expect(toMoney(res.balanceAfterCommission)).toBe("0.000");
      expect(res.referralCommission.lessThanOrEqualTo(res.remainingPool)).toBe(true);
    });

    it("calculateReferralCommission directly respects pool cap", () => {
      expect(toMoney(calculateReferralCommission(600, 3))).toBe("90.000");
      expect(calculateReferralCommission(600, 3).lessThanOrEqualTo(new Decimal(600))).toBe(true);
      expect(toMoney(calculateReferralCommission(0.001, 3))).toBe("0.000");
    });
  });

  describe("Invariant 3: Zero/Negative Profit Safety (P <= 0 => A=0, B=0, C=0)", () => {
    it("zero profit (P = 0) produces zero admin share, zero pool, and zero commission", () => {
      const res = calculateProfitSharing({ revenue: "500.000", expenses: "500.000", referrerLevel: 3 });
      expect(toMoney(res.profit)).toBe("0.000");
      expect(toMoney(res.adminShare)).toBe("0.000");
      expect(toMoney(res.remainingPool)).toBe("0.000");
      expect(toMoney(res.referralCommission)).toBe("0.000");
      expect(toMoney(res.balanceAfterCommission)).toBe("0.000");
      expect(res.isProfitable).toBe(false);
    });

    it("negative profit (P = -1 millime) produces zero positive shares", () => {
      const res = calculateProfitSharing({ revenue: "100.000", expenses: "100.001", referrerLevel: 2 });
      expect(toMoney(res.profit)).toBe("-0.001");
      expect(toMoney(res.adminShare)).toBe("0.000");
      expect(toMoney(res.remainingPool)).toBe("0.000");
      expect(toMoney(res.referralCommission)).toBe("0.000");
      expect(toMoney(res.balanceAfterCommission)).toBe("0.000");
      expect(res.isProfitable).toBe(false);
    });

    it("massive negative profit (-1,000,000 TND) produces zero positive shares", () => {
      const res = calculateProfitSharing({ revenue: "0.000", expenses: "1000000.000", referrerLevel: 1 });
      expect(toMoney(res.profit)).toBe("-1000000.000");
      expect(toMoney(res.adminShare)).toBe("0.000");
      expect(toMoney(res.remainingPool)).toBe("0.000");
      expect(toMoney(res.referralCommission)).toBe("0.000");
      expect(toMoney(res.balanceAfterCommission)).toBe("0.000");
      expect(res.isProfitable).toBe(false);
    });
  });

  describe("Invariant 4: Exact Numeric Specification (R=5000, E=3000 -> P=2000, A=1400, B=600)", () => {
    it("computes exact specification figures for Level 1, 2, and 3", () => {
      const p1 = calculateProfitSharing({ revenue: 5000, expenses: 3000, referrerLevel: 1 });
      expect(toMoney(p1.profit)).toBe("2000.000");
      expect(toMoney(p1.adminShare)).toBe("1400.000");
      expect(toMoney(p1.remainingPool)).toBe("600.000");
      expect(toMoney(p1.referralCommission)).toBe("30.000");
      expect(toMoney(p1.balanceAfterCommission)).toBe("570.000");

      const p2 = calculateProfitSharing({ revenue: 5000, expenses: 3000, referrerLevel: 2 });
      expect(toMoney(p2.profit)).toBe("2000.000");
      expect(toMoney(p2.adminShare)).toBe("1400.000");
      expect(toMoney(p2.remainingPool)).toBe("600.000");
      expect(toMoney(p2.referralCommission)).toBe("60.000");
      expect(toMoney(p2.balanceAfterCommission)).toBe("540.000");

      const p3 = calculateProfitSharing({ revenue: 5000, expenses: 3000, referrerLevel: 3 });
      expect(toMoney(p3.profit)).toBe("2000.000");
      expect(toMoney(p3.adminShare)).toBe("1400.000");
      expect(toMoney(p3.remainingPool)).toBe("600.000");
      expect(toMoney(p3.referralCommission)).toBe("90.000");
      expect(toMoney(p3.balanceAfterCommission)).toBe("510.000");
    });
  });

  describe("Multi-Commission Pool Cap Allocations", () => {
    it("enforces sum(allocated) <= pool under PRO_RATA policy with fractional repeating decimals", () => {
      const pool = 10;
      const requests = [
        { id: "r1", requestedAmount: 5 },
        { id: "r2", requestedAmount: 5 },
        { id: "r3", requestedAmount: 5 },
      ];
      const res = allocateCommissionsFromPool(pool, requests, "PRO_RATA");
      expect(res.isExceeded).toBe(true);
      expect(res.totalAllocated.lessThanOrEqualTo(new Decimal(10))).toBe(true);
      const sum = res.allocations.reduce((acc, a) => acc.plus(a.allocatedAmount), new Decimal(0));
      expect(sum.lessThanOrEqualTo(new Decimal(10))).toBe(true);
      expect(toMoney(res.totalAllocated)).toBe("9.999");
      expect(toMoney(res.remainingPool)).toBe("0.001");
    });

    it("enforces sum(allocated) <= pool under FIFO policy", () => {
      const pool = 100;
      const requests = [
        { id: "r1", requestedAmount: 70 },
        { id: "r2", requestedAmount: 50 },
      ];
      const res = allocateCommissionsFromPool(pool, requests, "FIFO");
      expect(res.isExceeded).toBe(true);
      expect(toMoney(res.allocations[0]!.allocatedAmount)).toBe("70.000");
      expect(res.allocations[0]!.isCapped).toBe(false);
      expect(toMoney(res.allocations[1]!.allocatedAmount)).toBe("30.000");
      expect(res.allocations[1]!.isCapped).toBe(true);
      expect(toMoney(res.totalAllocated)).toBe("100.000");
      expect(toMoney(res.remainingPool)).toBe("0.000");
    });

    it("handles zero pool safely with all allocations capped at zero", () => {
      const res = allocateCommissionsFromPool(0, [
        { id: "r1", requestedAmount: 100 },
        { id: "r2", level: 1 },
      ]);
      expect(res.isExceeded).toBe(true);
      expect(toMoney(res.totalAllocated)).toBe("0.000");
      expect(toMoney(res.remainingPool)).toBe("0.000");
      expect(res.allocations.every((a) => a.allocatedAmount.isZero())).toBe(true);
    });
  });
});
