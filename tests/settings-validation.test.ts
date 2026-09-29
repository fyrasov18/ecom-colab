import { describe, expect, it } from "vitest";
import { SETTING_DEFAULTS, SETTING_KEYS } from "@/modules/settings/defaults";
import { SETTING_VALUE_SCHEMAS } from "@/modules/settings/schemas";

/**
 * Settings are admin-writable, so their validation is a security boundary:
 * these tests pin the accepted values (and the defaults agree with them).
 */
const parse = (key: string, value: unknown) =>
  SETTING_VALUE_SCHEMAS[key]!.safeParse(value);

describe("system settings validation", () => {
  it("has a validator for every declared setting key", () => {
    for (const key of Object.values(SETTING_KEYS)) {
      expect(SETTING_VALUE_SCHEMAS[key], key).toBeDefined();
    }
  });

  it("accepts every compiled default", () => {
    for (const key of Object.values(SETTING_KEYS)) {
      const result = parse(key, SETTING_DEFAULTS[key]);
      expect(result.success, `${key} default rejected`).toBe(true);
    }
  });

  describe("settlement period (hours)", () => {
    const key = SETTING_KEYS.SETTLEMENT_PERIOD_HOURS;

    it("accepts the documented 1–720 hour range", () => {
      expect(parse(key, 1).success).toBe(true);
      expect(parse(key, 48).success).toBe(true);
      expect(parse(key, 720).success).toBe(true);
    });

    it("rejects out-of-range, fractional and string values", () => {
      expect(parse(key, 0).success).toBe(false);
      expect(parse(key, 721).success).toBe(false);
      expect(parse(key, 12.5).success).toBe(false);
      expect(parse(key, "48").success).toBe(false);
    });
  });

  describe("minimum withdrawal amount", () => {
    const key = SETTING_KEYS.MIN_WITHDRAWAL_AMOUNT;

    it("accepts positive amounts", () => {
      expect(parse(key, 100).success).toBe(true);
      expect(parse(key, 0.001).success).toBe(true);
    });

    it("rejects zero and negative amounts", () => {
      expect(parse(key, 0).success).toBe(false);
      expect(parse(key, -10).success).toBe(false);
    });
  });

  describe("return / refusal cost rule", () => {
    const key = SETTING_KEYS.RETURN_COST_RULE;

    it("accepts only the three documented rules", () => {
      expect(parse(key, "REVERSE_PENDING_EARNING").success).toBe(true);
      expect(parse(key, "REVERSE_PLUS_DELIVERY").success).toBe(true);
      expect(parse(key, "NO_COST").success).toBe(true);
      expect(parse(key, "REVERSE_EVERYTHING").success).toBe(false);
    });
  });

  describe("global commission (fallback rule)", () => {
    const key = SETTING_KEYS.GLOBAL_COMMISSION;

    it("accepts a percentage within 0–100", () => {
      expect(parse(key, { commissionType: "PERCENTAGE", commissionValue: 60 }).success).toBe(true);
      expect(parse(key, { commissionType: "PERCENTAGE", commissionValue: 100 }).success).toBe(true);
    });

    it("rejects a percentage above 100", () => {
      const result = parse(key, { commissionType: "PERCENTAGE", commissionValue: 150 });
      expect(result.success).toBe(false);
      expect(result.success ? "" : result.error.issues[0]?.message).toContain("100");
    });

    it("accepts a fixed amount above 100 DT", () => {
      expect(parse(key, { commissionType: "FIXED", commissionValue: 250 }).success).toBe(true);
    });

    it("rejects non-positive values and unknown commission types", () => {
      expect(parse(key, { commissionType: "FIXED", commissionValue: 0 }).success).toBe(false);
      expect(parse(key, { commissionType: "FREE", commissionValue: 10 }).success).toBe(false);
      expect(parse(key, { commissionType: "PERCENTAGE" }).success).toBe(false);
      expect(parse(key, 60).success).toBe(false);
    });
  });
});
