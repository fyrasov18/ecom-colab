import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { d, formatPrice, roundMoney } from "@/lib/money";

describe("money utilities (decimal, never float)", () => {
  it("rounds to 3 decimals (millimes) without float drift", () => {
    expect(roundMoney(0.1 + 0.2).toFixed(3)).toBe("0.300");
    expect(roundMoney("13.2049").toFixed(3)).toBe("13.205");
    expect(roundMoney("13.2051").toFixed(3)).toBe("13.205");
  });

  it("computes contribution exactly: 50 − 20 − 1 − 7 = 22", () => {
    const contribution = d(50).minus(d(20)).minus(d(1)).minus(d(7));
    expect(contribution.toNumber()).toBe(22);
  });

  it("computes 60% partner share exactly: 22 × 0.6 = 13.2", () => {
    const earning = d(22).times(d(60)).dividedBy(100);
    expect(earning.toFixed(3)).toBe("13.200");
  });

  it("formats prices for display", () => {
    expect(formatPrice("13.200")).toBe("13,2");
    expect(formatPrice("12")).toBe("12");
    expect(formatPrice(new Decimal("100.500"))).toBe("100,5");
  });
});
