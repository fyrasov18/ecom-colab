import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { d, roundMoney } from "@/lib/money";
import {
  allocateMultiCommissionsOracle,
  evaluatePartnerLevelOracle,
  runProfitSharing,
  transitionCommissionOracle,
  validateReferralIntakeOracle,
  type CommissionStatus,
  type PartnerRecord,
  type SystemReferralSettings,
} from "./suite-harness.test";

describe("Tier 2: Boundary & Corner Cases", () => {
  // ==========================================================================
  // FINANCIAL & NUMERICAL BOUNDARIES
  // ==========================================================================
  describe("Financial and Numerical Boundaries", () => {
    it("T2.B1: Zero revenue and zero expenses produce zero profit, admin share, pool, and commission", async () => {
      const res = await runProfitSharing({ revenue: "0.000", expenses: "0.000", referrerLevel: 1 });
      expect(res.profit.toFixed(3)).toBe("0.000");
      expect(res.adminShare.toFixed(3)).toBe("0.000");
      expect(res.remainingPool.toFixed(3)).toBe("0.000");
      expect(res.referralCommission.toFixed(3)).toBe("0.000");
      expect(res.balanceAfterCommission.toFixed(3)).toBe("0.000");
    });

    it("T2.B2: Exact break-even profit (R == E) produces zero commission and zero admin share", async () => {
      const res = await runProfitSharing({ revenue: "1234.567", expenses: "1234.567", referrerLevel: 3 });
      expect(res.profit.toFixed(3)).toBe("0.000");
      expect(res.adminShare.toFixed(3)).toBe("0.000");
      expect(res.remainingPool.toFixed(3)).toBe("0.000");
      expect(res.referralCommission.toFixed(3)).toBe("0.000");
    });

    it("T2.B3: Negative profit with high expenses generates negative profit, zero admin share, and zero commission", async () => {
      const res = await runProfitSharing({ revenue: "50.000", expenses: "1000.000", referrerLevel: 2 });
      expect(res.profit.toFixed(3)).toBe("-950.000");
      expect(res.adminShare.toFixed(3)).toBe("0.000");
      expect(res.remainingPool.toFixed(3)).toBe("0.000");
      expect(res.referralCommission.toFixed(3)).toBe("0.000");
    });

    it("T2.B4: Single millime profit boundary (R = 0.001, E = 0.000)", async () => {
      const res = await runProfitSharing({ revenue: "0.001", expenses: "0.000", referrerLevel: 1 });
      expect(res.profit.toFixed(3)).toBe("0.001");
      // 70% of 0.001 = 0.0007 -> rounds to 0.001
      expect(res.adminShare.toFixed(3)).toBe("0.001");
      // 30% of 0.001 = 0.0003 -> rounds to 0.000
      expect(res.remainingPool.toFixed(3)).toBe("0.000");
      // Commission on 0.000 pool is 0.000
      expect(res.referralCommission.toFixed(3)).toBe("0.000");
    });

    it("T2.B5: Half-way millime rounding bounds (ROUND_HALF_UP)", async () => {
      // 10.005 TND with 70% admin share: 10.005 * 0.7 = 7.0035 -> rounds UP to 7.004
      const p = new Decimal("10.005");
      const admin = roundMoney(p.times("0.70"));
      expect(admin.toFixed(3)).toBe("7.004");

      // 10.005 * 0.3 = 3.0015 -> rounds UP to 3.002
      const pool = roundMoney(p.times("0.30"));
      expect(pool.toFixed(3)).toBe("3.002");
    });

    it("T2.B6: High-volume large scale revenue maintains exact 3-decimal precision without float overflow", async () => {
      const res = await runProfitSharing({
        revenue: "10000000.000",
        expenses: "3500000.000",
        referrerLevel: 3,
      });
      expect(res.profit.toFixed(3)).toBe("6500000.000");
      expect(res.adminShare.toFixed(3)).toBe("4550000.000");
      expect(res.remainingPool.toFixed(3)).toBe("1950000.000");
      // Level 3 rate 15% on 1,950,000 = 292,500.000
      expect(res.referralCommission.toFixed(3)).toBe("292500.000");
      expect(res.balanceAfterCommission.toFixed(3)).toBe("1657500.000");
      // Exact sum invariance: admin + comm + balance == profit
      expect(
        res.adminShare.plus(res.referralCommission).plus(res.balanceAfterCommission).toFixed(3)
      ).toBe(res.profit.toFixed(3));
    });

    it("T2.B7: Maximum pool cap protection when multiple claims exceed remaining pool B", () => {
      // Small pool: R = 100, E = 0 => P = 100 => B = 30.000
      // 3 partners at Level 3 claiming 15% each (3 * 4.5 = 13.5) vs extreme claim
      const allocation = allocateMultiCommissionsOracle({
        revenue: 100,
        expenses: 0,
        commissions: [
          { referrerId: "p1", level: 3 }, // 4.5
          { referrerId: "p2", level: 3 }, // 4.5
          { referrerId: "p3", level: 3 }, // 4.5
        ],
      });
      expect(allocation.remainingPool.toFixed(3)).toBe("30.000");
      expect(allocation.totalCommissionPaid.toFixed(3)).toBe("13.500");
      expect(allocation.balanceAfterCommissions.toFixed(3)).toBe("16.500");
      // Never overdrafts: balance >= 0
      expect(allocation.balanceAfterCommissions.gte(0)).toBe(true);
    });
  });

  // ==========================================================================
  // REFERRAL COUNT & PROMOTION THRESHOLD BOUNDARIES (0, 2, 3, 9, 10, 100+)
  // ==========================================================================
  describe("Referral Count and Promotion Threshold Boundaries", () => {
    it("T2.B8: Count = 0 (exact bottom boundary): Level 1, 5% rate", () => {
      const state = evaluatePartnerLevelOracle(0);
      expect(state.level).toBe(1);
      expect(state.rate.toFixed(2)).toBe("0.05");
      expect(state.nextThreshold).toBe(3);
    });

    it("T2.B9: Count = 2 (off-by-one below Level 2 threshold of 3): strictly Level 1, 5% rate", () => {
      const state = evaluatePartnerLevelOracle(2);
      expect(state.level).toBe(1);
      expect(state.rate.toFixed(2)).toBe("0.05");
      expect(state.nextThreshold).toBe(3);
    });

    it("T2.B10: Count = 3 (exact Level 2 threshold boundary): promotes to Level 2, 10% rate", () => {
      const state = evaluatePartnerLevelOracle(3);
      expect(state.level).toBe(2);
      expect(state.rate.toFixed(2)).toBe("0.10");
      expect(state.nextThreshold).toBe(10);
    });

    it("T2.B11: Count = 9 (off-by-one below Level 3 threshold of 10): strictly Level 2, 10% rate", () => {
      const state = evaluatePartnerLevelOracle(9);
      expect(state.level).toBe(2);
      expect(state.rate.toFixed(2)).toBe("0.10");
      expect(state.nextThreshold).toBe(10);
    });

    it("T2.B12: Count = 10 (exact Level 3 threshold boundary): promotes to Level 3, 15% rate", () => {
      const state = evaluatePartnerLevelOracle(10);
      expect(state.level).toBe(3);
      expect(state.rate.toFixed(2)).toBe("0.15");
      expect(state.nextThreshold).toBeNull();
    });

    it("T2.B13: Count = 100+ (far above Level 3 threshold): capped at Level 3, 15% rate", () => {
      const state = evaluatePartnerLevelOracle(150);
      expect(state.level).toBe(3);
      expect(state.rate.toFixed(2)).toBe("0.15");
      expect(state.nextThreshold).toBeNull();
    });
  });

  // ==========================================================================
  // INPUT SANITIZATION, STRING & ENCODING BOUNDARIES
  // ==========================================================================
  describe("Input Sanitization and String Boundaries", () => {
    function sanitizeReferralCode(code: string): { valid: boolean; normalized?: string; error?: string } {
      if (!code || code.trim() === "") {
        return { valid: false, error: "Referral code cannot be empty." };
      }
      const trimmed = code.trim();
      if (trimmed.length < 3 || trimmed.length > 50) {
        return { valid: false, error: "Referral code length must be between 3 and 50 characters." };
      }
      // Only alphanumeric, hyphens, and underscores permitted
      if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        return { valid: false, error: "Referral code contains invalid characters." };
      }
      return { valid: true, normalized: trimmed.toUpperCase() };
    }

    it("T2.B14: Empty string and whitespace-only referral code rejected", () => {
      expect(sanitizeReferralCode("").valid).toBe(false);
      expect(sanitizeReferralCode("   ").valid).toBe(false);
    });

    it("T2.B15: Overly long referral code (>50 chars) rejected", () => {
      const longCode = "A".repeat(51);
      const res = sanitizeReferralCode(longCode);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/between 3 and 50/i);
    });

    it("T2.B16: Special characters, SQL injection tokens, and Unicode symbols safely rejected", () => {
      expect(sanitizeReferralCode("REF'; DROP TABLE Partners;--").valid).toBe(false);
      expect(sanitizeReferralCode("<script>alert(1)</script>").valid).toBe(false);
      expect(sanitizeReferralCode("REF-🔥-2026").valid).toBe(false);
    });

    it("T2.B17: Case-insensitive referral code matching and normalization", () => {
      const resLower = sanitizeReferralCode("ref-karim-001");
      expect(resLower.valid).toBe(true);
      expect(resLower.normalized).toBe("REF-KARIM-001");

      const resUpper = sanitizeReferralCode("REF-KARIM-001");
      expect(resUpper.valid).toBe(true);
      expect(resUpper.normalized).toBe("REF-KARIM-001");
    });

    it("T2.B18: International and local phone formatting variations normalize to 8-digit match", () => {
      const baseReferrer: PartnerRecord = {
        id: "p-ref-norm",
        userId: "u-ref-norm",
        displayName: "Hedi",
        code: "P008",
        status: "ACTIVE",
        email: "hedi@example.com",
        phone: "+216 98 765 432", // phone formatted with country code and spaces
        level: 1,
        qualifiedReferralsCount: 0,
      };

      // Candidate provides local 8-digit phone without country code
      const candidateLocal = { email: "cand@example.com", phone: "98765432" };
      const intakeLocal = validateReferralIntakeOracle({
        referrer: baseReferrer,
        candidate: candidateLocal,
        existingAttributions: [],
      });
      expect(intakeLocal.valid).toBe(false);
      expect(intakeLocal.error).toMatch(/matching phone/i);

      // Candidate provides 00216 prefix
      const candidateIntl = { email: "cand@example.com", phone: "0021698765432" };
      const intakeIntl = validateReferralIntakeOracle({
        referrer: baseReferrer,
        candidate: candidateIntl,
        existingAttributions: [],
      });
      expect(intakeIntl.valid).toBe(false);
      expect(intakeIntl.error).toMatch(/matching phone/i);
    });
  });

  // ==========================================================================
  // LIFECYCLE & STATE MACHINE BOUNDARIES
  // ==========================================================================
  describe("Lifecycle and State Machine Boundaries", () => {
    it("T2.B19: Payment recording with whitespace-only reference is rejected", () => {
      const res = transitionCommissionOracle("APPROVED_FOR_PAYMENT", "PAID", {
        actorId: "admin",
        reference: "   ",
      });
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/reference is mandatory/i);
    });

    it("T2.B20: Double approval attempt on already approved commission is rejected", () => {
      const res = transitionCommissionOracle("APPROVED_FOR_PAYMENT", "APPROVED_FOR_PAYMENT", {
        actorId: "admin",
      });
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/Invalid commission transition/i);
    });

    it("T2.B21: Double payment attempt on already PAID commission is rejected", () => {
      const res = transitionCommissionOracle("PAID", "PAID", {
        actorId: "admin",
        reference: "REF-2",
      });
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/Invalid commission transition/i);
    });

    it("T2.B22: Reversal attempt on an already REVERSED commission is rejected", () => {
      const res = transitionCommissionOracle("REVERSED", "REVERSED", {
        actorId: "admin",
        reason: "Duplicate reversal",
      });
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/Invalid commission transition/i);
    });

    it("T2.B23: Rapid burst requests within rate limit window are throttled safely", () => {
      class RateLimiter {
        private requests: number[] = [];
        constructor(private limit: number, private windowMs: number) {}
        allow(): boolean {
          const now = Date.now();
          this.requests = this.requests.filter((t) => now - t < this.windowMs);
          if (this.requests.length >= this.limit) return false;
          this.requests.push(now);
          return true;
        }
      }

      const limiter = new RateLimiter(5, 1000); // 5 requests per second
      const results: boolean[] = [];
      for (let i = 0; i < 7; i++) {
        results.push(limiter.allow());
      }
      // First 5 allowed, remaining 2 rejected
      expect(results.filter((r) => r === true)).toHaveLength(5);
      expect(results.filter((r) => r === false)).toHaveLength(2);
    });
  });
});
