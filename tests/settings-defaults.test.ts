import { describe, expect, it } from "vitest";
import {
  SETTING_DEFAULTS,
  SETTING_KEYS,
  type ReturnCostRule,
} from "@/modules/settings/defaults";

describe("system settings defaults", () => {
  it("has a default for every declared setting key", () => {
    for (const key of Object.values(SETTING_KEYS)) {
      expect(SETTING_DEFAULTS[key]).toBeDefined();
    }
  });

  it("defaults settlement period to 48 hours", () => {
    expect(SETTING_DEFAULTS[SETTING_KEYS.SETTLEMENT_PERIOD_HOURS]).toBe(48);
  });

  it("defaults minimum withdrawal to 100 DT", () => {
    expect(SETTING_DEFAULTS[SETTING_KEYS.MIN_WITHDRAWAL_AMOUNT]).toBe(100);
  });

  it("defaults return cost rule to REVERSE_PENDING_EARNING (approved business rule)", () => {
    const rule: ReturnCostRule =
      SETTING_DEFAULTS[SETTING_KEYS.RETURN_COST_RULE];
    expect(rule).toBe("REVERSE_PENDING_EARNING");
  });
});
