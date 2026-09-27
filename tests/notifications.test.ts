import { describe, expect, it } from "vitest";
import {
  dayBucket,
  formatUnreadCount,
  isUnread,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_TONES,
} from "@/modules/notifications/labels";
import {
  buildEarningReversalBody,
  buildStatusBody,
} from "@/modules/orders/labels";
import {
  buildLowStockBody,
  crossedLowStock,
  shouldAlertLowStock,
} from "@/modules/products/labels";
import type { NotificationType } from "@prisma/client";

const ALL_TYPES: NotificationType[] = [
  "ORDER_STATUS",
  "EARNING",
  "SETTLEMENT",
  "WITHDRAWAL",
  "STOCK",
  "SYSTEM",
];

describe("notification labels", () => {
  it("covers every NotificationType in the Prisma enum", () => {
    for (const type of ALL_TYPES) {
      expect(NOTIFICATION_TYPE_LABELS[type]).toBeTruthy();
      expect(NOTIFICATION_TYPE_TONES[type]).toBeTruthy();
    }
  });

  it("flags money-in events as success and stock as destructive", () => {
    expect(NOTIFICATION_TYPE_TONES.EARNING).toBe("success");
    expect(NOTIFICATION_TYPE_TONES.SETTLEMENT).toBe("success");
    expect(NOTIFICATION_TYPE_TONES.STOCK).toBe("destructive");
  });
});

describe("isUnread", () => {
  it("is true only while readAt is null", () => {
    expect(isUnread({ readAt: null })).toBe(true);
    expect(isUnread({ readAt: new Date() })).toBe(false);
  });
});

describe("formatUnreadCount", () => {
  it("caps the header pill at 99+", () => {
    expect(formatUnreadCount(0)).toBe("0");
    expect(formatUnreadCount(1)).toBe("1");
    expect(formatUnreadCount(99)).toBe("99");
    expect(formatUnreadCount(100)).toBe("99+");
    expect(formatUnreadCount(1284)).toBe("99+");
  });

  it("never renders a negative or NaN badge", () => {
    expect(formatUnreadCount(-3)).toBe("0");
    expect(formatUnreadCount(Number.NaN)).toBe("0");
  });
});

describe("dayBucket", () => {
  const now = new Date(2026, 2, 15, 12, 0, 0);

  it("labels today and yesterday", () => {
    expect(dayBucket(new Date(2026, 2, 15, 8, 0, 0), now)).toBe("Aujourd'hui");
    expect(dayBucket(new Date(2026, 2, 14, 23, 30, 0), now)).toBe("Hier");
  });

  it("falls back to a date for older entries", () => {
    expect(dayBucket(new Date(2026, 2, 10, 9, 0, 0), now)).toMatch(/mars/);
  });

  it("ignores the time of day when bucketing (no off-by-one at midnight)", () => {
    // 00:01 today and 23:59 today both belong to the same bucket.
    expect(dayBucket(new Date(2026, 2, 15, 0, 1, 0), now)).toBe("Aujourd'hui");
    expect(dayBucket(new Date(2026, 2, 15, 23, 59, 0), now)).toBe("Aujourd'hui");
  });

  it("treats a future timestamp as today rather than crashing", () => {
    const future = new Date(2026, 2, 16, 9, 0, 0);
    expect(dayBucket(future, now)).toBe("Aujourd'hui");
  });
});

describe("buildStatusBody — partner notification wording", () => {
  it("always states the transition", () => {
    const body = buildStatusBody("SHIPPED", "PACKAGED");
    expect(body).toContain("Emballée");
    expect(body).toContain("Expédiée");
  });

  it("explains that earnings are pending settlement on delivery", () => {
    expect(buildStatusBody("DELIVERED", "IN_DELIVERY")).toMatch(/règlement/i);
  });

  it("includes the operator reason on refusals and holds", () => {
    expect(buildStatusBody("REFUSED", "IN_DELIVERY", "Client absent")).toContain(
      "Client absent",
    );
    expect(buildStatusBody("ON_HOLD", "PREPARING", "Stock manquant")).toContain(
      "Stock manquant",
    );
  });

  it("never leaks an empty 'Motif :' when no reason was given", () => {
    expect(buildStatusBody("RETURNED", "IN_DELIVERY")).not.toContain("Motif");
  });
});

describe("shouldAlertLowStock — anti-flooding rule", () => {
  it("alerts when the quantity crosses down through the threshold", () => {
    expect(shouldAlertLowStock({
      stockBefore: 6, stockAfter: 2, thresholdBefore: 5, thresholdAfter: 5,
    })).toBe(true);
  });

  it("stays SILENT while the product is already below the threshold", () => {
    // This is the whole point: 4 -> 2 is not news, the crossing already alerted.
    expect(shouldAlertLowStock({
      stockBefore: 4, stockAfter: 2, thresholdBefore: 5, thresholdAfter: 5,
    })).toBe(false);
  });

  it("stays silent on a restock that moves away from the threshold", () => {
    expect(shouldAlertLowStock({
      stockBefore: 2, stockAfter: 40, thresholdBefore: 5, thresholdAfter: 5,
    })).toBe(false);
  });

  it("treats landing exactly ON the threshold as low", () => {
    expect(shouldAlertLowStock({
      stockBefore: 6, stockAfter: 5, thresholdBefore: 5, thresholdAfter: 5,
    })).toBe(true);
  });

  it("alerts when the threshold is RAISED above an unchanged quantity", () => {
    expect(shouldAlertLowStock({
      stockBefore: 10, stockAfter: 10, thresholdBefore: 5, thresholdAfter: 20,
    })).toBe(true);
  });

  it("stays silent when the threshold is LOWERED below the quantity", () => {
    expect(shouldAlertLowStock({
      stockBefore: 10, stockAfter: 10, thresholdBefore: 20, thresholdAfter: 5,
    })).toBe(false);
  });

  it("does not alert when a product that was already low is restocked", () => {
    expect(shouldAlertLowStock({
      stockBefore: 0, stockAfter: 30, thresholdBefore: 5, thresholdAfter: 5,
    })).toBe(false);
  });
});

describe("crossedLowStock — unchanged-threshold shorthand", () => {
  it("matches shouldAlertLowStock", () => {
    expect(crossedLowStock(6, 2, 5)).toBe(true);
    expect(crossedLowStock(4, 2, 5)).toBe(false);
    expect(crossedLowStock(2, 40, 5)).toBe(false);
  });
});

describe("buildLowStockBody", () => {
  it("reports a hard rupture at zero", () => {
    expect(buildLowStockBody("Lampe", 0, 5)).toMatch(/rupture/i);
  });

  it("reports the remaining units otherwise", () => {
    expect(buildLowStockBody("Lampe", 2, 5)).toContain("2");
  });
});

describe("buildEarningReversalBody", () => {
  it("states the original gain and what was taken back", () => {
    const body = buildEarningReversalBody("13.200", "13.200", "0.000", "RETURN_FEE_ONLY");
    expect(body).toContain("13.200");
    expect(body).toContain("RETURN_FEE_ONLY");
  });

  it("mentions return fees only when something was actually charged", () => {
    expect(buildEarningReversalBody("13.200", "13.200", "7.000", "REVERSE_PLUS_DELIVERY"))
      .toContain("7.000");
    expect(buildEarningReversalBody("13.200", "13.200", "0.000", "NO_COST"))
      .not.toMatch(/Frais de retour/);
  });
});
