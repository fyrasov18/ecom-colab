import { describe, it, expect } from "vitest";
import {
  performanceLevelSchema,
  resolvePerformanceShare,
  orderLevelsAsLadder,
  type LevelLike,
} from "@/modules/finance/performance-levels";

const level = (over: Partial<LevelLike> = {}): LevelLike => ({
  id: "lvl_1",
  name: "Or",
  sharePercentage: 60,
  isActive: true,
  ...over,
});

describe("performanceLevelSchema", () => {
  it("accepts a valid level", () => {
    const r = performanceLevelSchema.parse({
      name: "Or",
      sharePercentage: 60,
      sortOrder: 2,
    });
    expect(r.name).toBe("Or");
    expect(r.sharePercentage).toBe(60);
  });

  it("rejects a share above 100 %", () => {
    expect(
      performanceLevelSchema.safeParse({
        name: "X",
        sharePercentage: 140,
        sortOrder: 1,
      }).success,
    ).toBe(false);
  });

  it("rejects a negative share", () => {
    expect(
      performanceLevelSchema.safeParse({
        name: "X",
        sharePercentage: -5,
        sortOrder: 1,
      }).success,
    ).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(
      performanceLevelSchema.safeParse({
        name: "   ",
        sharePercentage: 50,
        sortOrder: 1,
      }).success,
    ).toBe(false);
  });

  it("accepts free-form criteria without requiring a migration", () => {
    const r = performanceLevelSchema.parse({
      name: "Or",
      sharePercentage: 60,
      sortOrder: 2,
      criteria: { minDeliveryRate: 90, windowDays: 30 },
    });
    expect(r.criteria).toEqual({ minDeliveryRate: 90, windowDays: 30 });
  });
});

describe("resolvePerformanceShare", () => {
  it("uses the assigned ACTIVE level", () => {
    expect(
      resolvePerformanceShare(level({ sharePercentage: 65 }), {
        sharePercentage: 40,
      }),
    ).toEqual({
      sharePercentage: 65,
      source: "PERFORMANCE_LEVEL",
      performanceLevelName: "Or",
      performanceLevelId: "lvl_1",
    });
  });

  it("falls back to the commission chain when no level is assigned", () => {
    const r = resolvePerformanceShare(null, { sharePercentage: 40 });
    expect(r.source).toBe("FALLBACK");
    expect(r.sharePercentage).toBe(40);
    expect(r.performanceLevelName).toBeNull();
  });

  it("ignores an INACTIVE level, so deactivating stops new orders at once", () => {
    const r = resolvePerformanceShare(level({ isActive: false }), {
      sharePercentage: 40,
    });
    expect(r.source).toBe("FALLBACK");
    expect(r.sharePercentage).toBe(40);
  });

  it("ignores a malformed share instead of applying bad data", () => {
    const r = resolvePerformanceShare(level({ sharePercentage: "NaN" }), {
      sharePercentage: 40,
    });
    expect(r.source).toBe("FALLBACK");
    expect(r.sharePercentage).toBe(40);
  });

  it("accepts a decimal share coming from the DB", () => {
    const r = resolvePerformanceShare(level({ sharePercentage: "62.50" }), {
      sharePercentage: 40,
    });
    expect(r.source).toBe("PERFORMANCE_LEVEL");
    expect(r.sharePercentage).toBe(62.5);
  });

  it("accepts the 0 % and 100 % boundaries", () => {
    expect(
      resolvePerformanceShare(level({ sharePercentage: 0 }), {
        sharePercentage: 40,
      }).sharePercentage,
    ).toBe(0);
    expect(
      resolvePerformanceShare(level({ sharePercentage: 100 }), {
        sharePercentage: 40,
      }).sharePercentage,
    ).toBe(100);
  });

  /**
   * §19/§53: the share used by an order is captured at creation. Resolving
   * again after the level changed yields a DIFFERENT number, which is exactly
   * why the order stores its own frozen snapshot instead of re-reading.
   */
  it("produces a different share after the level changes (orders must snapshot)", () => {
    const before = resolvePerformanceShare(level({ sharePercentage: 60 }), {
      sharePercentage: 60,
    });
    const after = resolvePerformanceShare(level({ sharePercentage: 75 }), {
      sharePercentage: 60,
    });
    expect(before.sharePercentage).toBe(60);
    expect(after.sharePercentage).toBe(75);
    expect(after.sharePercentage).not.toBe(before.sharePercentage);
  });
});

describe("orderLevelsAsLadder", () => {
  it("sorts the highest priority first without mutating the input", () => {
    const input = [
      { name: "Bronze", sortOrder: 1 },
      { name: "Or", sortOrder: 3 },
      { name: "Argent", sortOrder: 2 },
    ];
    expect(orderLevelsAsLadder(input).map((l) => l.name)).toEqual([
      "Or",
      "Argent",
      "Bronze",
    ]);
    expect(input.map((l) => l.name)).toEqual(["Bronze", "Or", "Argent"]);
  });
});
