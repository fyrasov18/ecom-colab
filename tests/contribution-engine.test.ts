import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  calculateOrderContribution,
  resolveContributionRate,
  verifyConfirmationIntegrity,
  type FinancialSnapshot,
} from "@/modules/finance/contribution-engine";

describe("Contribution Engine — Canonical Calculations & Business Rules", () => {
  const defaultRateRule = {
    type: "PERCENTAGE" as const,
    rate: new Decimal(30),
    source: "GLOBAL" as const,
    performanceLevelId: null,
    performanceLevelName: null,
  };

  // ── 1. Canonical formula verification ──
  it("#1 computes exact canonical contribution for unit quantity", () => {
    // 50 - 20 - 1 - 7 = 22
    const res = calculateOrderContribution({
      sellingPrice: 50,
      quantity: 1,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 7,
      minContributionThreshold: 7,
      rateRule: defaultRateRule,
    });

    expect(res.revenue.toFixed(3)).toBe("50.000");
    expect(res.productCost.toFixed(3)).toBe("20.000");
    expect(res.packagingCostTotal.toFixed(3)).toBe("1.000");
    expect(res.deliveryCostTotal.toFixed(3)).toBe("7.000");
    expect(res.totalCosts.toFixed(3)).toBe("28.000");
    expect(res.contribution.toFixed(3)).toBe("22.000");
    expect(res.isEligible).toBe(true);
  });

  // ── 2. Multi-quantity scaling (flat delivery) ──
  it("#2 scales product & packaging by quantity, delivery stays flat per order", () => {
    // Q=3: Revenue = 150, ProductCost = 60, Packaging = 3, Delivery = 7
    // TotalCosts = 70, Contribution = 80
    const res = calculateOrderContribution({
      sellingPrice: 50,
      quantity: 3,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 7,
      minContributionThreshold: 7,
      rateRule: defaultRateRule,
    });

    expect(res.revenue.toFixed(3)).toBe("150.000");
    expect(res.productCost.toFixed(3)).toBe("60.000");
    expect(res.packagingCostTotal.toFixed(3)).toBe("3.000");
    expect(res.deliveryCostTotal.toFixed(3)).toBe("7.000");
    expect(res.totalCosts.toFixed(3)).toBe("70.000");
    expect(res.contribution.toFixed(3)).toBe("80.000");
  });

  // ── 3. Minimum contribution: exactly 7.00 DT is BLOCKED ──
  it("#3 blocks an order whose contribution is exactly equal to the threshold (7.00 DT)", () => {
    // Revenue = 35, Costs = 28 -> Contribution = 7.000 DT
    const res = calculateOrderContribution({
      sellingPrice: 35,
      quantity: 1,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 7,
      minContributionThreshold: 7,
      rateRule: defaultRateRule,
    });

    expect(res.contribution.toFixed(3)).toBe("7.000");
    expect(res.isEligible).toBe(false); // Strictly > 7.00 required!
  });

  // ── 4. Minimum contribution: 7.01 DT is ALLOWED ──
  it("#4 allows an order whose contribution is strictly greater than 7.00 DT (7.01 DT)", () => {
    // Revenue = 35.01, Costs = 28 -> Contribution = 7.010 DT
    const res = calculateOrderContribution({
      sellingPrice: 35.01,
      quantity: 1,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 7,
      minContributionThreshold: 7,
      rateRule: defaultRateRule,
    });

    expect(res.contribution.toFixed(3)).toBe("7.010");
    expect(res.isEligible).toBe(true);
  });

  // ── 5. Minimum contribution: 6.99 DT is BLOCKED ──
  it("#5 blocks an order whose contribution is below the threshold (6.99 DT)", () => {
    const res = calculateOrderContribution({
      sellingPrice: 34.99,
      quantity: 1,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 7,
      minContributionThreshold: 7,
      rateRule: defaultRateRule,
    });

    expect(res.contribution.toFixed(3)).toBe("6.990");
    expect(res.isEligible).toBe(false);
  });

  // ── 6. Negative contribution is BLOCKED ──
  it("#6 blocks an order with negative contribution", () => {
    const res = calculateOrderContribution({
      sellingPrice: 20,
      quantity: 1,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 7,
      minContributionThreshold: 7,
      rateRule: defaultRateRule,
    });

    expect(res.contribution.toNumber()).toBeLessThan(0);
    expect(res.isEligible).toBe(false);
  });

  // ── 7. Zero contribution is BLOCKED ──
  it("#7 blocks an order with zero contribution", () => {
    const res = calculateOrderContribution({
      sellingPrice: 28,
      quantity: 1,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 7,
      minContributionThreshold: 7,
      rateRule: defaultRateRule,
    });

    expect(res.contribution.toFixed(3)).toBe("0.000");
    expect(res.isEligible).toBe(false);
  });

  // ── 8. 4-tier hierarchy: Tier 1 PARTNER_PRODUCT wins ──
  it("#8 Tier 1 PARTNER_PRODUCT wins over partner, level, and global", () => {
    const rule = resolveContributionRate({
      partnerProduct: { commissionType: "PERCENTAGE", commissionValue: 45 },
      partner: { commissionType: "PERCENTAGE", commissionValue: 40 },
      performanceLevel: { id: "lvl-1", name: "Gold", sharePercentage: 50, isActive: true },
      global: { commissionType: "PERCENTAGE", commissionValue: 30 },
    });

    expect(rule.source).toBe("PARTNER_PRODUCT");
    expect(rule.rate.toNumber()).toBe(45);
  });

  // ── 9. 4-tier hierarchy: Tier 2 PARTNER wins over level and global ──
  it("#9 Tier 2 PARTNER admin override wins when no partnerProduct override", () => {
    const rule = resolveContributionRate({
      partnerProduct: null,
      partner: { commissionType: "PERCENTAGE", commissionValue: 40 },
      performanceLevel: { id: "lvl-1", name: "Gold", sharePercentage: 50, isActive: true },
      global: { commissionType: "PERCENTAGE", commissionValue: 30 },
    });

    expect(rule.source).toBe("PARTNER");
    expect(rule.rate.toNumber()).toBe(40);
  });

  // ── 10. 4-tier hierarchy: Tier 3 PERFORMANCE_LEVEL wins over global ──
  it("#10 Tier 3 PERFORMANCE_LEVEL wins when no partnerProduct or partner override", () => {
    const rule = resolveContributionRate({
      partnerProduct: null,
      partner: null,
      performanceLevel: { id: "lvl-1", name: "Gold", sharePercentage: 55, isActive: true },
      global: { commissionType: "PERCENTAGE", commissionValue: 30 },
    });

    expect(rule.source).toBe("PERFORMANCE_LEVEL");
    expect(rule.rate.toNumber()).toBe(55);
    expect(rule.performanceLevelName).toBe("Gold");
    expect(rule.performanceLevelId).toBe("lvl-1");
  });

  // ── 11. 4-tier hierarchy: Tier 4 GLOBAL applies when no overrides ──
  it("#11 Tier 4 GLOBAL (30%) applies as fallback", () => {
    const rule = resolveContributionRate({
      partnerProduct: null,
      partner: null,
      performanceLevel: null,
      global: { commissionType: "PERCENTAGE", commissionValue: 30 },
    });

    expect(rule.source).toBe("GLOBAL");
    expect(rule.rate.toNumber()).toBe(30);
  });

  // ── 12. Explicit 0% is valid at Tier 1 ──
  it("#12 explicit 0% rate is valid at Tier 1 (PARTNER_PRODUCT) and does not fall through", () => {
    const rule = resolveContributionRate({
      partnerProduct: { commissionType: "PERCENTAGE", commissionValue: 0 },
      partner: { commissionType: "PERCENTAGE", commissionValue: 40 },
      performanceLevel: { id: "lvl-1", name: "Gold", sharePercentage: 50, isActive: true },
      global: { commissionType: "PERCENTAGE", commissionValue: 30 },
    });

    expect(rule.source).toBe("PARTNER_PRODUCT");
    expect(rule.rate.toNumber()).toBe(0);
  });

  // ── 13. Explicit 0% is valid at Tier 2 ──
  it("#13 explicit 0% rate is valid at Tier 2 (PARTNER) and does not fall through", () => {
    const rule = resolveContributionRate({
      partnerProduct: null,
      partner: { commissionType: "PERCENTAGE", commissionValue: 0 },
      performanceLevel: { id: "lvl-1", name: "Gold", sharePercentage: 50, isActive: true },
      global: { commissionType: "PERCENTAGE", commissionValue: 30 },
    });

    expect(rule.source).toBe("PARTNER");
    expect(rule.rate.toNumber()).toBe(0);
  });

  // ── 14. Explicit 0% is valid at Tier 3 ──
  it("#14 explicit 0% rate is valid at Tier 3 (PERFORMANCE_LEVEL) and does not fall through", () => {
    const rule = resolveContributionRate({
      partnerProduct: null,
      partner: null,
      performanceLevel: { id: "lvl-1", name: "Bronze", sharePercentage: 0, isActive: true },
      global: { commissionType: "PERCENTAGE", commissionValue: 30 },
    });

    expect(rule.source).toBe("PERFORMANCE_LEVEL");
    expect(rule.rate.toNumber()).toBe(0);
  });

  // ── 15. Inactive level is ignored ──
  it("#15 inactive PerformanceLevel is ignored and falls through to GLOBAL", () => {
    const rule = resolveContributionRate({
      partnerProduct: null,
      partner: null,
      performanceLevel: { id: "lvl-1", name: "Disabled", sharePercentage: 60, isActive: false },
      global: { commissionType: "PERCENTAGE", commissionValue: 30 },
    });

    expect(rule.source).toBe("GLOBAL");
    expect(rule.rate.toNumber()).toBe(30);
  });

  // ── 16. Null/undefined overrides fall through cleanly ──
  it("#16 null/undefined commissionValue falls through without error", () => {
    const rule = resolveContributionRate({
      partnerProduct: { commissionType: "PERCENTAGE", commissionValue: null },
      partner: { commissionType: "PERCENTAGE", commissionValue: undefined },
      performanceLevel: null,
      global: { commissionType: "PERCENTAGE", commissionValue: 30 },
    });

    expect(rule.source).toBe("GLOBAL");
    expect(rule.rate.toNumber()).toBe(30);
  });

  // ── 17. Partner share & platform split math ──
  it("#17 splits contribution accurately: 30% of 22 DT -> 6.600 DT partner, 15.400 DT platform", () => {
    const res = calculateOrderContribution({
      sellingPrice: 50,
      quantity: 1,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 7,
      minContributionThreshold: 7,
      rateRule: defaultRateRule,
    });

    expect(res.contribution.toFixed(3)).toBe("22.000");
    expect(res.partnerEarning.toFixed(3)).toBe("6.600");
    expect(res.platformShare.toFixed(3)).toBe("15.400");
    expect(res.partnerEarning.plus(res.platformShare).toFixed(3)).toBe("22.000");
  });

  // ── 18. Exact sum conservation across arbitrary rates ──
  it("#18 exact sum conservation: partnerEarning + platformShare == contribution (no penny loss)", () => {
    const rates = [0, 10, 33.333, 50, 66.667, 100];

    for (const r of rates) {
      const res = calculateOrderContribution({
        sellingPrice: 47.777,
        quantity: 2,
        purchaseCost: 13.123,
        packagingCost: 1.5,
        deliveryCost: 8,
        minContributionThreshold: 7,
        rateRule: {
          type: "PERCENTAGE",
          rate: new Decimal(r),
          source: "PARTNER",
          performanceLevelId: null,
          performanceLevelName: null,
        },
      });

      const sum = res.partnerEarning.plus(res.platformShare);
      expect(sum.toFixed(3)).toBe(res.contribution.toFixed(3));
    }
  });

  // ── 19. Rounding half-up precision (2 decimal places for Contribution & Earnings) ──
  it("#19 rounds Contribution and Partner Earning using standard half-up to 2 decimal places", () => {
    const res = calculateOrderContribution({
      sellingPrice: 50.005,
      quantity: 1,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 7,
      minContributionThreshold: 7,
      rateRule: {
        type: "PERCENTAGE",
        rate: new Decimal(33.333),
        source: "GLOBAL",
        performanceLevelId: null,
        performanceLevelName: null,
      },
    });

    // 50.005 - 28 = 22.005 -> rounds to 22.01 DT
    expect(res.contribution.toFixed(2)).toBe("22.01");
    // 22.01 * 0.33333 = 7.33659... -> rounds to 7.34 DT
    expect(res.partnerEarning.toFixed(2)).toBe("7.34");
    // Platform Share = 22.01 - 7.34 = 14.67 DT (exact remainder)
    expect(res.platformShare.toFixed(2)).toBe("14.67");
    expect(res.partnerEarning.plus(res.platformShare).toFixed(2)).toBe("22.01");
  });

  // ── 20. Fixed amount commission capped at contribution ──
  it("#20 FIXED commission is capped at contribution (never creates negative platform share)", () => {
    const res = calculateOrderContribution({
      sellingPrice: 40,
      quantity: 1,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 7,
      minContributionThreshold: 7,
      rateRule: {
        type: "FIXED",
        rate: new Decimal(50), // Fixed 50 DT, but contribution is only 12 DT
        source: "PARTNER",
        performanceLevelId: null,
        performanceLevelName: null,
      },
    });

    expect(res.contribution.toFixed(3)).toBe("12.000");
    expect(res.partnerEarning.toFixed(3)).toBe("12.000");
    expect(res.platformShare.toFixed(3)).toBe("0.000");
  });

  // ── 21. Rate percentage clamped between 0 and 100 ──
  it("#21 clamps percentage rate between 0% and 100%", () => {
    const resOver = calculateOrderContribution({
      sellingPrice: 50,
      quantity: 1,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 7,
      minContributionThreshold: 7,
      rateRule: {
        type: "PERCENTAGE",
        rate: new Decimal(150),
        source: "PARTNER",
        performanceLevelId: null,
        performanceLevelName: null,
      },
    });

    expect(resOver.partnerEarning.toFixed(3)).toBe("22.000");
    expect(resOver.platformShare.toFixed(3)).toBe("0.000");
  });

  // ── 22. Snapshot structure and metadata ──
  it("#22 generates a complete, immutable financial snapshot", () => {
    const res = calculateOrderContribution({
      sellingPrice: 50,
      quantity: 2,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 7,
      minContributionThreshold: 7,
      rateRule: {
        type: "PERCENTAGE",
        rate: new Decimal(35),
        source: "PERFORMANCE_LEVEL",
        performanceLevelId: "lvl-silver",
        performanceLevelName: "Silver",
      },
    });

    const s = res.snapshot;
    expect(s.version).toBe(1);
    expect(typeof s.calculatedAt).toBe("string");
    expect(s.unitSellingPrice).toBe("50.000");
    expect(s.quantity).toBe(2);
    expect(s.unitPurchaseCost).toBe("20.000");
    expect(s.unitPackagingCost).toBe("1.000");
    expect(s.orderDeliveryCost).toBe("7.000");
    expect(s.discount).toBe("0.000");
    expect(s.revenue).toBe("100.000");
    expect(s.netRevenue).toBe("100.000");
    expect(s.productCost).toBe("40.000");
    expect(s.packagingCost).toBe("2.000");
    expect(s.deliveryCost).toBe("7.000");
    expect(s.totalCosts).toBe("49.000");
    expect(s.contribution).toBe("51.00");
    expect(s.minContributionThreshold).toBe("7.00");
    expect(s.isEligible).toBe(true);
    expect(s.ratePercentage).toBe("35.00");
    expect(s.commissionType).toBe("PERCENTAGE");
    expect(s.commissionSource).toBe("PERFORMANCE_LEVEL");
    expect(s.performanceLevelId).toBe("lvl-silver");
    expect(s.performanceLevelName).toBe("Silver");
    expect(s.partnerEarning).toBe("17.85");
    expect(s.platformShare).toBe("33.15");
  });

  // ── 23. Snapshot integrity verification passes on match ──
  it("#23 verifyConfirmationIntegrity passes when snapshots match", () => {
    const res = calculateOrderContribution({
      sellingPrice: 50,
      quantity: 1,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 7,
      minContributionThreshold: 7,
      rateRule: defaultRateRule,
    });

    const preview = { ...res.snapshot };
    const current = { ...res.snapshot, calculatedAt: new Date().toISOString() };

    const check = verifyConfirmationIntegrity(preview, current);
    expect(check.isIdentical).toBe(true);
    expect(check.differences).toHaveLength(0);
  });

  // ── 24. Snapshot integrity verification rejects tampering or drift ──
  it("#24 verifyConfirmationIntegrity identifies financial differences when inputs changed", () => {
    const res = calculateOrderContribution({
      sellingPrice: 50,
      quantity: 1,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 7,
      minContributionThreshold: 7,
      rateRule: defaultRateRule,
    });

    const preview = { ...res.snapshot };
    const modified: FinancialSnapshot = {
      ...res.snapshot,
      unitSellingPrice: "55.000",
      revenue: "55.000",
      contribution: "27.00",
    };

    const check = verifyConfirmationIntegrity(preview, modified);
    expect(check.isIdentical).toBe(false);
    expect(check.differences.length).toBeGreaterThanOrEqual(3);
    expect(check.differences.some((d) => d.includes("unitSellingPrice"))).toBe(true);
    expect(check.differences.some((d) => d.includes("contribution"))).toBe(true);
  });
});

describe("P0 — Partner Earning Rounding Consistency (2-decimal business rules)", () => {
  it("rounds Contribution and Partner Earning to exactly 2 decimal places", () => {
    // Net revenue = 44, Costs = 20 + 1 + 8 = 29 -> Contribution = 15.00
    // Rate = 30% -> Partner Earning = 4.50, Platform Share = 10.50
    const res = calculateOrderContribution({
      sellingPrice: 44,
      quantity: 1,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 8,
      minContributionThreshold: 7,
      rateRule: {
        type: "PERCENTAGE",
        rate: new Decimal(30),
        source: "GLOBAL",
        performanceLevelId: null,
        performanceLevelName: null,
      },
    });

    expect(res.contribution.toFixed(2)).toBe("15.00");
    expect(res.partnerEarning.toFixed(2)).toBe("4.50");
    expect(res.platformShare.toFixed(2)).toBe("10.50");
    expect(res.partnerEarning.plus(res.platformShare).toFixed(2)).toBe("15.00");
  });

  it("calculates Platform Share as the exact remainder (PlatformShare = Contribution - PartnerEarning)", () => {
    // Contribution = 10.00, Rate = 33.333% -> 10.00 * 0.33333 = 3.3333 -> 3.33
    // Platform Share = 10.00 - 3.33 = 6.67
    const res = calculateOrderContribution({
      sellingPrice: 38,
      quantity: 1,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 7,
      minContributionThreshold: 7,
      rateRule: {
        type: "PERCENTAGE",
        rate: new Decimal(33.333),
        source: "PARTNER",
        performanceLevelId: null,
        performanceLevelName: null,
      },
    });

    expect(res.contribution.toFixed(2)).toBe("10.00");
    expect(res.partnerEarning.toFixed(2)).toBe("3.33");
    expect(res.platformShare.toFixed(2)).toBe("6.67");
    expect(res.platformShare.equals(res.contribution.minus(res.partnerEarning))).toBe(true);
    expect(res.partnerEarning.plus(res.platformShare).equals(res.contribution)).toBe(true);
  });

  it("satisfies PartnerEarning + PlatformShare = Contribution across broad rate and cost spectrum", () => {
    const testCases = [
      { price: 44.456, qty: 1, cost: 20.123, pkg: 1.25, del: 8.5, rate: 30 },
      { price: 65.5, qty: 2, cost: 15.333, pkg: 1.11, del: 7.75, rate: 17.5 },
      { price: 100, qty: 1, cost: 45.45, pkg: 2.22, del: 9.33, rate: 49.99 },
      { price: 35.01, qty: 1, cost: 20, pkg: 1, del: 7, rate: 66.666 },
      { price: 88.888, qty: 3, cost: 12.345, pkg: 1.5, del: 8, rate: 23.45 },
    ];

    for (const tc of testCases) {
      const res = calculateOrderContribution({
        sellingPrice: tc.price,
        quantity: tc.qty,
        purchaseCost: tc.cost,
        packagingCost: tc.pkg,
        deliveryCost: tc.del,
        minContributionThreshold: 7,
        rateRule: {
          type: "PERCENTAGE",
          rate: new Decimal(tc.rate),
          source: "PARTNER",
          performanceLevelId: null,
          performanceLevelName: null,
        },
      });

      // 1. Contribution has at most 2 decimal places
      expect(res.contribution.decimalPlaces()).toBeLessThanOrEqual(2);
      // 2. Partner Earning has at most 2 decimal places
      expect(res.partnerEarning.decimalPlaces()).toBeLessThanOrEqual(2);
      // 3. Platform Share has at most 2 decimal places
      expect(res.platformShare.decimalPlaces()).toBeLessThanOrEqual(2);
      // 4. Exact sum equality
      expect(res.partnerEarning.plus(res.platformShare).equals(res.contribution)).toBe(true);
      // 5. Remainder equality
      expect(res.platformShare.equals(res.contribution.minus(res.partnerEarning))).toBe(true);
    }
  });

  it("handles Zero percentage (0%) correctly: Partner receives 0.00 DT, Platform receives 100%", () => {
    const res = calculateOrderContribution({
      sellingPrice: 50,
      quantity: 1,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 7,
      minContributionThreshold: 7,
      rateRule: {
        type: "PERCENTAGE",
        rate: new Decimal(0),
        source: "PARTNER",
        performanceLevelId: null,
        performanceLevelName: null,
      },
    });

    expect(res.contribution.toFixed(2)).toBe("22.00");
    expect(res.partnerEarning.toFixed(2)).toBe("0.00");
    expect(res.platformShare.toFixed(2)).toBe("22.00");
    expect(res.partnerEarning.plus(res.platformShare).equals(res.contribution)).toBe(true);
  });

  it("handles 100% percentage correctly: Partner receives 100%, Platform receives 0.00 DT", () => {
    const res = calculateOrderContribution({
      sellingPrice: 50,
      quantity: 1,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 7,
      minContributionThreshold: 7,
      rateRule: {
        type: "PERCENTAGE",
        rate: new Decimal(100),
        source: "PARTNER",
        performanceLevelId: null,
        performanceLevelName: null,
      },
    });

    expect(res.contribution.toFixed(2)).toBe("22.00");
    expect(res.partnerEarning.toFixed(2)).toBe("22.00");
    expect(res.platformShare.toFixed(2)).toBe("0.00");
    expect(res.partnerEarning.plus(res.platformShare).equals(res.contribution)).toBe(true);
  });

  it("handles decimal edge cases: half-up roundings at 0.005 boundaries", () => {
    // Testing half-up at second decimal place:
    // e.g. Contribution = 25.00, Rate = 15.5% -> 25.00 * 0.155 = 3.875 -> rounds to 3.88 DT
    const res = calculateOrderContribution({
      sellingPrice: 53,
      quantity: 1,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 7,
      minContributionThreshold: 7,
      rateRule: {
        type: "PERCENTAGE",
        rate: new Decimal(15.5),
        source: "GLOBAL",
        performanceLevelId: null,
        performanceLevelName: null,
      },
    });

    // 53 - 28 = 25.00 DT
    expect(res.contribution.toFixed(2)).toBe("25.00");
    // 25 * 0.155 = 3.875 -> rounds half-up to 3.88
    expect(res.partnerEarning.toFixed(2)).toBe("3.88");
    // Platform Share = 25.00 - 3.88 = 21.12
    expect(res.platformShare.toFixed(2)).toBe("21.12");
    expect(res.partnerEarning.plus(res.platformShare).toFixed(2)).toBe("25.00");
  });
});
