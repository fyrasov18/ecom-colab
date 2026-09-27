import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { computePartnerEarning, resolveCommission } from "@/modules/finance/commission";

const globalRule = { commissionType: "PERCENTAGE" as const, commissionValue: 60 };

describe("resolveCommission precedence", () => {
  it("uses PARTNER_PRODUCT override when present", () => {
    const rule = resolveCommission({
      partnerProduct: { commissionType: "FIXED", commissionValue: new Decimal(5) },
      partner: { commissionType: "PERCENTAGE", commissionValue: new Decimal(70) },
      product: { commissionType: "PERCENTAGE", commissionValue: new Decimal(50) },
      global: globalRule,
    });
    expect(rule.source).toBe("PARTNER_PRODUCT");
    expect(rule.type).toBe("FIXED");
    expect(rule.value.toNumber()).toBe(5);
  });

  it("falls back to PARTNER default", () => {
    const rule = resolveCommission({
      partner: { commissionType: "PERCENTAGE", commissionValue: new Decimal(70) },
      product: { commissionType: "PERCENTAGE", commissionValue: new Decimal(50) },
      global: globalRule,
    });
    expect(rule.source).toBe("PARTNER");
    expect(rule.value.toNumber()).toBe(70);
  });

  it("falls back to PRODUCT rule", () => {
    const rule = resolveCommission({
      product: { commissionType: "PERCENTAGE", commissionValue: new Decimal(50) },
      global: globalRule,
    });
    expect(rule.source).toBe("PRODUCT");
    expect(rule.value.toNumber()).toBe(50);
  });

  it("falls back to GLOBAL rule", () => {
    const rule = resolveCommission({ global: globalRule });
    expect(rule.source).toBe("GLOBAL");
    expect(rule.type).toBe("PERCENTAGE");
    expect(rule.value.toNumber()).toBe(60);
  });

  it("ignores a rule with type but no value", () => {
    const rule = resolveCommission({
      partner: { commissionType: "FIXED", commissionValue: null },
      global: globalRule,
    });
    expect(rule.source).toBe("GLOBAL");
  });
});

describe("computePartnerEarning — spec example: 50 − 20 − 1 − 7 = 22, 60% → 13.20", () => {
  const rule = { type: "PERCENTAGE" as const, value: new Decimal(60), source: "GLOBAL" as const };

  it("computes the exact spec example", () => {
    const contribution = new Decimal(50).minus(20).minus(1).minus(7);
    const { earning, platformShare } = computePartnerEarning(contribution, rule);
    expect(earning.toFixed(3)).toBe("13.200");
    expect(platformShare.toFixed(3)).toBe("8.800");
    // partner + platform = contribution exactly (no drift)
    expect(earning.plus(platformShare).toFixed(3)).toBe(contribution.toFixed(3));
  });

  it("rounds to millimes (HALF_UP)", () => {
    const { earning } = computePartnerEarning("10.001", {
      type: "PERCENTAGE",
      value: new Decimal(33.3),
      source: "GLOBAL",
    });
    expect(earning.toFixed(3)).toBe("3.330");
  });

  it("FIXED commission is capped at the contribution", () => {
    const { earning, platformShare } = computePartnerEarning(10, {
      type: "FIXED",
      value: new Decimal(50),
      source: "PARTNER_PRODUCT",
    });
    expect(earning.toFixed(3)).toBe("10.000");
    expect(platformShare.toFixed(3)).toBe("0.000");
  });

  it("FIXED commission pays the flat amount when below contribution", () => {
    const { earning, platformShare } = computePartnerEarning(30, {
      type: "FIXED",
      value: new Decimal(12),
      source: "PARTNER",
    });
    expect(earning.toFixed(3)).toBe("12.000");
    expect(platformShare.toFixed(3)).toBe("18.000");
  });

  it("never yields a negative platform share", () => {
    const { earning, platformShare } = computePartnerEarning(0, {
      type: "PERCENTAGE",
      value: new Decimal(60),
      source: "GLOBAL",
    });
    expect(earning.toNumber()).toBe(0);
    expect(platformShare.toNumber()).toBe(0);
  });
});
