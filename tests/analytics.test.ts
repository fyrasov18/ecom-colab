import { describe, expect, it } from "vitest";
import {
  aggregatePlatformPerformance,
  aggregateProductPerformance,
  orderAmount,
  percent,
  summarizeOrders,
  type PerfOrderLine,
  type PlatformPerfLine,
} from "@/modules/analytics/compute";

/** Order with a single line of 1 unit at 100 DT (unless overridden). */
function line<T extends Partial<PerfOrderLine> & { status: PerfOrderLine["status"] }>(
  overrides: T,
): PerfOrderLine & T {
  return {
    quantity: 1,
    unitSellingPrice: 100,
    partnerEarning: 60,
    platformShare: 40,
    items: [{ productId: "p1", productName: "Produit A", quantity: 1 }],
    ...overrides,
  } as PerfOrderLine & T;
}

describe("percent - safe ratio", () => {
  it("never returns NaN on an empty denominator", () => {
    expect(percent(0, 0)).toBe(0);
    expect(percent(5, 0)).toBe(0);
  });

  it("rounds to the nearest integer percent", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(3, 3)).toBe(100);
  });

  it("ignores non-finite input", () => {
    expect(percent(Number.NaN, 10)).toBe(0);
    expect(percent(5, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("summarizeOrders - operational funnel", () => {
  it("returns all-zero metrics on an empty order book", () => {
    const s = summarizeOrders({});
    expect(s.delivered).toBe(0);
    expect(s.resolved).toBe(0);
    expect(s.deliveryRate).toBe(0);
    expect(s.returnRate).toBe(0);
  });

  it("buckets preparing vs in-delivery stages", () => {
    const s = summarizeOrders({
      CONFIRMED: 1,
      VALIDATED: 1,
      PREPARING: 1,
      PACKAGED: 1,
      SHIPPED: 2,
      IN_DELIVERY: 3,
      DELIVERED: 8,
      REFUSED: 1,
      RETURNED: 1,
      CANCELLED: 4,
    });
    expect(s.preparing).toBe(4);
    expect(s.inDelivery).toBe(5);
    expect(s.delivered).toBe(8);
    expect(s.returnedOrRefused).toBe(2);
    expect(s.resolved).toBe(10);
  });

  it("excludes CANCELLED / ON_HOLD from the delivery rate denominator", () => {
    const s = summarizeOrders({
      DELIVERED: 9,
      REFUSED: 1,
      CANCELLED: 50,
      ON_HOLD: 20,
    });
    // 9 / 10 resolved, not 9 / 80.
    expect(s.deliveryRate).toBe(90);
    expect(s.returnRate).toBe(10);
  });
});

describe("orderAmount - gross customer charge", () => {
  it("multiplies unit price by order quantity with millime precision", () => {
    expect(orderAmount({ unitSellingPrice: 12.5, quantity: 3 }).toFixed(3)).toBe("37.500");
    expect(orderAmount({ unitSellingPrice: 0.1, quantity: 3 }).toFixed(3)).toBe("0.300");
  });
});

describe("aggregateProductPerformance", () => {
  it("returns an empty list when there are no orders", () => {
    expect(aggregateProductPerformance([])).toEqual([]);
  });

  it("only counts DELIVERED orders as revenue", () => {
    const rows = aggregateProductPerformance([
      line({ status: "DELIVERED" }),
      line({ status: "PREPARING" }),
      line({ status: "REFUSED" }),
    ]);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.totalOrders).toBe(3);
    expect(row.unitsSold).toBe(3);
    expect(row.deliveredUnits).toBe(1);
    expect(row.returnedUnits).toBe(1);
    expect(row.turnover).toBe(100);
    expect(row.earnings).toBe(60);
    expect(row.deliveryRate).toBe(50);
  });

  it("splits a multi-line order pro-rata so turnover is never double counted", () => {
    const rows = aggregateProductPerformance([
      line({
        status: "DELIVERED",
        quantity: 3,
        unitSellingPrice: 10,
        partnerEarning: 18,
        items: [
          { productId: "p1", productName: "A", quantity: 1 },
          { productId: "p2", productName: "B", quantity: 2 },
        ],
      }),
    ]);
    expect(rows.reduce((acc, r) => acc + r.turnover, 0)).toBe(30);
    expect(rows.reduce((acc, r) => acc + r.earnings, 0)).toBe(18);

    const a = rows.find((r) => r.productId === "p1")!;
    const b = rows.find((r) => r.productId === "p2")!;
    expect(a.turnover).toBe(10);
    expect(b.turnover).toBe(20);
  });

  it("reports 0% delivery rate when nothing has resolved yet", () => {
    const rows = aggregateProductPerformance([line({ status: "SHIPPED" })]);
    expect(rows[0].deliveryRate).toBe(0);
    expect(rows[0].turnover).toBe(0);
  });

  it("sorts by earnings descending", () => {
    const rows = aggregateProductPerformance([
      line({ status: "DELIVERED", partnerEarning: 10, items: [{ productId: "low", productName: "Low", quantity: 1 }] }),
      line({ status: "DELIVERED", partnerEarning: 90, items: [{ productId: "high", productName: "High", quantity: 1 }] }),
    ]);
    expect(rows.map((r) => r.productId)).toEqual(["high", "low"]);
  });
});

describe("aggregatePlatformPerformance", () => {
  const partners = [
    { id: "pa", displayName: "Alpha", code: "PA", status: "ACTIVE" },
    { id: "pb", displayName: "Beta", code: "PB", status: "ACTIVE" },
  ];

  const orders: PlatformPerfLine[] = [
    line({
      status: "DELIVERED",
      partnerId: "pa",
      unitSellingPrice: 100,
      quantity: 2,
      partnerEarning: 120,
      platformShare: 80,
    }),
    line({
      status: "DELIVERED",
      partnerId: "pb",
      unitSellingPrice: 50,
      partnerEarning: 30,
      platformShare: 20,
    }),
    line({ status: "REFUSED", partnerId: "pb" }),
    line({ status: "CANCELLED", partnerId: "pa" }),
  ];

  it("returns zeroed KPIs on a fresh install", () => {
    const r = aggregatePlatformPerformance({ partners: [], orders: [] });
    expect(r.kpis).toEqual({
      totalOrders: 0,
      deliveredOrders: 0,
      returnedOrders: 0,
      deliveryRate: 0,
      returnRate: 0,
      turnover: 0,
      partnerPayout: 0,
      platformMargin: 0,
    });
    expect(r.topPartners).toEqual([]);
    expect(r.topProducts).toEqual([]);
  });

  it("computes revenue, payout and margin from DELIVERED orders only", () => {
    const r = aggregatePlatformPerformance({ partners, orders });
    expect(r.kpis.totalOrders).toBe(4);
    expect(r.kpis.deliveredOrders).toBe(2);
    expect(r.kpis.returnedOrders).toBe(1);
    expect(r.kpis.turnover).toBe(250);
    expect(r.kpis.partnerPayout).toBe(150);
    expect(r.kpis.platformMargin).toBe(100);
  });

  it("rates delivery over resolved orders only", () => {
    const r = aggregatePlatformPerformance({ partners, orders });
    // 2 delivered / (2 delivered + 1 refused) = 67%
    expect(r.kpis.deliveryRate).toBe(67);
    expect(r.kpis.returnRate).toBe(33);
  });

  it("ranks partners by delivered turnover", () => {
    const r = aggregatePlatformPerformance({ partners, orders });
    expect(r.topPartners.map((p) => p.partnerId)).toEqual(["pa", "pb"]);

    const alpha = r.topPartners[0];
    expect(alpha.totalOrders).toBe(2);
    expect(alpha.deliveredOrders).toBe(1);
    expect(alpha.returnedOrders).toBe(0);
    expect(alpha.turnover).toBe(200);
    expect(alpha.earnings).toBe(120);
    expect(alpha.deliveryRate).toBe(100);

    const beta = r.topPartners[1];
    expect(beta.deliveredOrders).toBe(1);
    expect(beta.returnedOrders).toBe(1);
    expect(beta.turnover).toBe(50);
    expect(beta.deliveryRate).toBe(50);
  });

  it("keeps partners with no orders in the leaderboard at zero", () => {
    const r = aggregatePlatformPerformance({
      partners: [...partners, { id: "pc", displayName: "Gamma", code: "PC", status: "ACTIVE" }],
      orders: [],
    });
    const gamma = r.topPartners.find((p) => p.partnerId === "pc")!;
    expect(gamma.totalOrders).toBe(0);
    expect(gamma.turnover).toBe(0);
    expect(gamma.deliveryRate).toBe(0);
  });

  it("ignores orders whose partner no longer exists", () => {
    const r = aggregatePlatformPerformance({
      partners,
      orders: [line({ status: "DELIVERED", partnerId: "deleted" })],
    });
    expect(r.kpis.turnover).toBe(100);
    expect(r.topPartners).toHaveLength(2);
  });
});


