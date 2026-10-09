import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  allocateCommissionsFromPool,
  CommissionAllocationRequest,
} from "@/modules/finance/referral-math";

const toMoneyStr = (val: Decimal) => val.toFixed(3);

describe("referral-pool-cap: adversarial empirical verification", () => {
  describe("1. Multi-commission oversubscription cap (Sum <= Pool B invariant)", () => {
    it("strictly bounds sum of allocations when 2 requests exceed Pool B", () => {
      // Pool B = 100.000 TND. Requests = 70.000, 80.000 (Sum requested = 150.000 TND > 100.000)
      const res = allocateCommissionsFromPool(100, [
        { id: "req-1", requestedAmount: 70 },
        { id: "req-2", requestedAmount: 80 },
      ]);

      expect(res.isExceeded).toBe(true);
      expect(res.totalAllocated.lessThanOrEqualTo(new Decimal("100.000"))).toBe(true);
      expect(res.remainingPool.greaterThanOrEqualTo(new Decimal("0.000"))).toBe(true);

      const sum = res.allocations.reduce((acc, a) => acc.plus(a.allocatedAmount), new Decimal(0));
      expect(sum.toString()).toBe(res.totalAllocated.toString());
      expect(sum.lessThanOrEqualTo(new Decimal("100.000"))).toBe(true);
      expect(res.totalAllocated.plus(res.remainingPool).toString()).toBe("100");
    });

    it("strictly bounds sum of allocations with 10 concurrent requests exceeding Pool B", () => {
      // Pool B = 250.000 TND. 10 requests of 50.000 TND each (Total requested = 500.000 TND)
      const requests: CommissionAllocationRequest[] = Array.from({ length: 10 }, (_, i) => ({
        id: `partner-${i + 1}`,
        requestedAmount: 50,
      }));

      const res = allocateCommissionsFromPool(250, requests, "PRO_RATA");

      expect(res.isExceeded).toBe(true);
      expect(toMoneyStr(res.totalPool)).toBe("250.000");
      expect(toMoneyStr(res.totalRequested)).toBe("500.000");
      expect(toMoneyStr(res.totalAllocated)).toBe("250.000");
      expect(toMoneyStr(res.remainingPool)).toBe("0.000");

      const sum = res.allocations.reduce((acc, a) => acc.plus(a.allocatedAmount), new Decimal(0));
      expect(sum.lessThanOrEqualTo(new Decimal("250.000"))).toBe(true);
      expect(toMoneyStr(sum)).toBe("250.000");

      for (const alloc of res.allocations) {
        expect(alloc.isCapped).toBe(true);
        expect(toMoneyStr(alloc.allocatedAmount)).toBe("25.000");
      }
    });

    it("preserves invariant under severe oversubscription (100 requests on 10 TND pool)", () => {
      const requests: CommissionAllocationRequest[] = Array.from({ length: 100 }, (_, i) => ({
        id: `p-${i}`,
        requestedAmount: 10,
      }));

      const res = allocateCommissionsFromPool(10, requests, "PRO_RATA");

      expect(res.isExceeded).toBe(true);
      expect(res.totalAllocated.lessThanOrEqualTo(new Decimal("10.000"))).toBe(true);
      const sum = res.allocations.reduce((acc, a) => acc.plus(a.allocatedAmount), new Decimal(0));
      expect(sum.lessThanOrEqualTo(new Decimal("10.000"))).toBe(true);
      expect(toMoneyStr(sum)).toBe("10.000");

      for (const alloc of res.allocations) {
        expect(alloc.isCapped).toBe(true);
        expect(toMoneyStr(alloc.allocatedAmount)).toBe("0.100");
      }
    });
  });

  describe("2. Rounding distribution & adversarial round-up prevention", () => {
    it("handles adversarial round-up trap where naive rounding exceeds pool (0.5005 DT case)", () => {
      // Pool = 1.001 TND. Two requests of 1.001 TND.
      // Total requested = 2.002 TND.
      // Naive pro-rata share = 1.001 * 1.001 / 2.002 = 0.5005 DT.
      // ROUND_HALF_UP rounds 0.5005 to 0.501 DT.
      // Sum without adjustment = 0.501 + 0.501 = 1.002 DT > 1.001 DT!
      const res = allocateCommissionsFromPool(
        "1.001",
        [
          { id: "c1", requestedAmount: "1.001" },
          { id: "c2", requestedAmount: "1.001" },
        ],
        "PRO_RATA",
      );

      expect(res.isExceeded).toBe(true);
      expect(res.totalAllocated.lessThanOrEqualTo(new Decimal("1.001"))).toBe(true);
      const sum = res.allocations.reduce((acc, a) => acc.plus(a.allocatedAmount), new Decimal(0));
      expect(sum.lessThanOrEqualTo(new Decimal("1.001"))).toBe(true);
      expect(toMoneyStr(sum)).toBe("1.001");
      expect(toMoneyStr(res.remainingPool)).toBe("0.000");

      // One allocation gets 0.501, the other gets 0.500 (adjusted millime)
      const amounts = res.allocations.map((a) => toMoneyStr(a.allocatedAmount)).sort();
      expect(amounts).toEqual(["0.500", "0.501"]);
    });

    it("handles multi-item round-up trap (6 requests with 0.5005 share)", () => {
      // Pool = 3.003 TND. Six requests of 1.001 TND each (Total = 6.006 TND).
      // Each naive share = 1.001 * 3.003 / 6.006 = 0.5005 DT -> 0.501 DT.
      // Naive sum = 6 * 0.501 = 3.006 DT (exceeds pool by 0.003 DT).
      const requests = Array.from({ length: 6 }, (_, i) => ({
        id: `c-${i}`,
        requestedAmount: "1.001",
      }));

      const res = allocateCommissionsFromPool("3.003", requests, "PRO_RATA");

      expect(res.isExceeded).toBe(true);
      const sum = res.allocations.reduce((acc, a) => acc.plus(a.allocatedAmount), new Decimal(0));
      expect(sum.lessThanOrEqualTo(new Decimal("3.003"))).toBe(true);
      expect(toMoneyStr(sum)).toBe("3.003");
      expect(toMoneyStr(res.remainingPool)).toBe("0.000");

      // Exactly 3 items get 0.500 and 3 items get 0.501
      const count500 = res.allocations.filter((a) => toMoneyStr(a.allocatedAmount) === "0.500").length;
      const count501 = res.allocations.filter((a) => toMoneyStr(a.allocatedAmount) === "0.501").length;
      expect(count500).toBe(3);
      expect(count501).toBe(3);
    });

    it("handles 3-way repeating decimals division (1/3 split)", () => {
      // Pool = 100.000 TND. 3 requests of 50.000 TND each (Total requested = 150.000 TND).
      // Pro-rata: 50 * 100 / 150 = 33.333333... -> 33.333 DT each.
      // Sum = 3 * 33.333 = 99.999 DT <= 100.000 TND. Remaining pool = 0.001 DT.
      const res = allocateCommissionsFromPool(
        100,
        [
          { id: "c1", requestedAmount: 50 },
          { id: "c2", requestedAmount: 50 },
          { id: "c3", requestedAmount: 50 },
        ],
        "PRO_RATA",
      );

      expect(res.isExceeded).toBe(true);
      expect(toMoneyStr(res.allocations[0]!.allocatedAmount)).toBe("33.333");
      expect(toMoneyStr(res.allocations[1]!.allocatedAmount)).toBe("33.333");
      expect(toMoneyStr(res.allocations[2]!.allocatedAmount)).toBe("33.333");
      expect(toMoneyStr(res.totalAllocated)).toBe("99.999");
      expect(toMoneyStr(res.remainingPool)).toBe("0.001");
      expect(res.totalAllocated.plus(res.remainingPool).toString()).toBe("100");
    });

    it("handles minimal pool unit (1 millime = 0.001 DT) oversubscribed", () => {
      // Pool = 0.001 TND. Two requests of 0.001 TND.
      const res = allocateCommissionsFromPool(
        "0.001",
        [
          { id: "c1", requestedAmount: "0.001" },
          { id: "c2", requestedAmount: "0.001" },
        ],
        "PRO_RATA",
      );

      expect(res.isExceeded).toBe(true);
      const sum = res.allocations.reduce((acc, a) => acc.plus(a.allocatedAmount), new Decimal(0));
      expect(sum.lessThanOrEqualTo(new Decimal("0.001"))).toBe(true);
      expect(toMoneyStr(sum)).toBe("0.001");
      const amounts = res.allocations.map((a) => toMoneyStr(a.allocatedAmount)).sort();
      expect(amounts).toEqual(["0.000", "0.001"]);
    });
  });

  describe("3. Zero and empty pool edge cases", () => {
    it("handles zero pool (0 DT) with non-empty requests", () => {
      const res = allocateCommissionsFromPool(0, [
        { id: "c1", requestedAmount: 100 },
        { id: "c2", level: 1 },
      ]);

      expect(res.isExceeded).toBe(true);
      expect(toMoneyStr(res.totalPool)).toBe("0.000");
      expect(toMoneyStr(res.totalRequested)).toBe("100.000");
      expect(toMoneyStr(res.totalAllocated)).toBe("0.000");
      expect(toMoneyStr(res.remainingPool)).toBe("0.000");
      expect(toMoneyStr(res.allocations[0]!.allocatedAmount)).toBe("0.000");
      expect(res.allocations[0]!.isCapped).toBe(true);
      expect(toMoneyStr(res.allocations[1]!.allocatedAmount)).toBe("0.000");
    });

    it("handles negative pool (-50 DT) cleanly as zero pool", () => {
      const res = allocateCommissionsFromPool(-50, [
        { id: "c1", requestedAmount: 20 },
      ]);

      expect(res.isExceeded).toBe(true);
      expect(toMoneyStr(res.totalPool)).toBe("0.000");
      expect(toMoneyStr(res.totalAllocated)).toBe("0.000");
      expect(toMoneyStr(res.remainingPool)).toBe("0.000");
      expect(toMoneyStr(res.allocations[0]!.allocatedAmount)).toBe("0.000");
      expect(res.allocations[0]!.isCapped).toBe(true);
    });

    it("handles positive pool with empty requests array", () => {
      const res = allocateCommissionsFromPool(600, []);

      expect(res.isExceeded).toBe(false);
      expect(toMoneyStr(res.totalPool)).toBe("600.000");
      expect(toMoneyStr(res.totalRequested)).toBe("0.000");
      expect(toMoneyStr(res.totalAllocated)).toBe("0.000");
      expect(toMoneyStr(res.remainingPool)).toBe("600.000");
      expect(res.allocations).toHaveLength(0);
    });

    it("handles zero pool with empty requests array", () => {
      const res = allocateCommissionsFromPool(0, []);

      expect(toMoneyStr(res.totalPool)).toBe("0.000");
      expect(toMoneyStr(res.totalRequested)).toBe("0.000");
      expect(toMoneyStr(res.totalAllocated)).toBe("0.000");
      expect(toMoneyStr(res.remainingPool)).toBe("0.000");
      expect(res.allocations).toHaveLength(0);
    });
  });

  describe("4. FIFO vs PRO_RATA policy comparison", () => {
    it("demonstrates FIFO priority exhaustion vs PRO_RATA proportional scaling", () => {
      const requests = [
        { id: "first-come", requestedAmount: 70 },
        { id: "second-come", requestedAmount: 70 },
      ];

      // FIFO
      const fifoRes = allocateCommissionsFromPool(100, requests, "FIFO");
      expect(fifoRes.isExceeded).toBe(true);
      expect(toMoneyStr(fifoRes.allocations[0]!.allocatedAmount)).toBe("70.000");
      expect(fifoRes.allocations[0]!.isCapped).toBe(false);
      expect(toMoneyStr(fifoRes.allocations[1]!.allocatedAmount)).toBe("30.000");
      expect(fifoRes.allocations[1]!.isCapped).toBe(true);
      expect(toMoneyStr(fifoRes.totalAllocated)).toBe("100.000");

      // PRO_RATA
      const proRataRes = allocateCommissionsFromPool(100, requests, "PRO_RATA");
      expect(proRataRes.isExceeded).toBe(true);
      expect(toMoneyStr(proRataRes.allocations[0]!.allocatedAmount)).toBe("50.000");
      expect(proRataRes.allocations[0]!.isCapped).toBe(true);
      expect(toMoneyStr(proRataRes.allocations[1]!.allocatedAmount)).toBe("50.000");
      expect(proRataRes.allocations[1]!.isCapped).toBe(true);
      expect(toMoneyStr(proRataRes.totalAllocated)).toBe("100.000");
    });
  });

  describe("5. Partner level rate derivation without explicit amount", () => {
    it("derives requestedAmount from partner level rate against Pool B", () => {
      // Pool B = 600 TND.
      // Level 1: 5% of 600 = 30 TND
      // Level 2: 10% of 600 = 60 TND
      // Level 3: 15% of 600 = 90 TND
      // Total = 180 TND <= 600 TND -> Fully allocated
      const res = allocateCommissionsFromPool(600, [
        { id: "p1", level: 1 },
        { id: "p2", level: 2 },
        { id: "p3", level: 3 },
      ]);

      expect(res.isExceeded).toBe(false);
      expect(toMoneyStr(res.totalRequested)).toBe("180.000");
      expect(toMoneyStr(res.totalAllocated)).toBe("180.000");
      expect(toMoneyStr(res.remainingPool)).toBe("420.000");
      expect(toMoneyStr(res.allocations[0]!.allocatedAmount)).toBe("30.000");
      expect(toMoneyStr(res.allocations[1]!.allocatedAmount)).toBe("60.000");
      expect(toMoneyStr(res.allocations[2]!.allocatedAmount)).toBe("90.000");
    });
  });
});
