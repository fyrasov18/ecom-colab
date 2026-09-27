import type { OrderStatus } from "@prisma/client";
import type Decimal from "decimal.js";
import { d, roundMoney } from "@/lib/money";

/**
 * Pure aggregation helpers shared by the admin and partner analytics queries.
 *
 * These functions contain no Prisma access so the business rules (delivery
 * rate, return rate, earnings allocation) are unit-testable in isolation.
 */

/** Order states that count as "in preparation" (not yet handed to the carrier). */
const PREPARING_STATES = [
  "CONFIRMED",
  "VALIDATED",
  "PREPARING",
  "PACKAGED",
] as const satisfies readonly OrderStatus[];

/**
 * Safe percentage. Returns 0 instead of NaN/Infinity when the denominator is
 * empty, so dashboards never render a broken metric on fresh installs.
 */
export function percent(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export type OrderStatusCounts = Partial<Record<OrderStatus, number>>;

export type OrderSummary = {
  delivered: number;
  inDelivery: number;
  preparing: number;
  returnedOrRefused: number;
  /** Orders whose fate is known: DELIVERED + REFUSED + RETURNED. */
  resolved: number;
  deliveryRate: number;
  returnRate: number;
};

/** Bucket a per-status order count map into the operational funnel. */
export function summarizeOrders(counts: OrderStatusCounts): OrderSummary {
  const delivered = counts.DELIVERED ?? 0;
  const inDelivery = (counts.SHIPPED ?? 0) + (counts.IN_DELIVERY ?? 0);
  const preparing = PREPARING_STATES.reduce(
    (acc, status) => acc + (counts[status] ?? 0),
    0,
  );
  const returnedOrRefused = (counts.REFUSED ?? 0) + (counts.RETURNED ?? 0);
  const resolved = delivered + returnedOrRefused;

  return {
    delivered,
    inDelivery,
    preparing,
    returnedOrRefused,
    resolved,
    deliveryRate: percent(delivered, resolved),
    returnRate: percent(returnedOrRefused, resolved),
  };
}

/** Gross amount charged to the customer for an order. */
export function orderAmount(order: {
  unitSellingPrice: number;
  quantity: number;
}): Decimal {
  return roundMoney(d(order.unitSellingPrice).mul(order.quantity));
}

export type PerfOrderLine = {
  status: OrderStatus;
  /** Order-level quantity (mirrors Order.quantity). */
  quantity: number;
  unitSellingPrice: number;
  partnerEarning: number;
  platformShare: number;
  items: { productId: string; productName: string; quantity: number }[];
};

export type ProductPerfRow = {
  productId: string;
  name: string;
  totalOrders: number;
  unitsSold: number;
  deliveredUnits: number;
  returnedUnits: number;
  turnover: number;
  earnings: number;
  deliveryRate: number;
};

type ProductAccumulator = Omit<ProductPerfRow, "turnover" | "earnings" | "deliveryRate"> & {
  turnover: Decimal;
  earnings: Decimal;
};

function emptyProductRow(
  productId: string,
  name: string,
): ProductAccumulator {
  return {
    productId,
    name,
    totalOrders: 0,
    unitsSold: 0,
    deliveredUnits: 0,
    returnedUnits: 0,
    turnover: d(0),
    earnings: d(0),
  };
}

function finalizeProduct(row: ProductAccumulator): ProductPerfRow {
  const resolved = row.deliveredUnits + row.returnedUnits;
  return {
    productId: row.productId,
    name: row.name,
    totalOrders: row.totalOrders,
    unitsSold: row.unitsSold,
    deliveredUnits: row.deliveredUnits,
    returnedUnits: row.returnedUnits,
    turnover: roundMoney(row.turnover).toNumber(),
    earnings: roundMoney(row.earnings).toNumber(),
    deliveryRate: percent(row.deliveredUnits, resolved),
  };
}

/**
 * Per-product performance.
 *
 * Order-level revenue and earnings are split pro-rata across the order lines
 * (by unit count) so a multi-product order never double-counts turnover.
 * Only DELIVERED orders contribute revenue, matching settlement rules.
 */
export function aggregateProductPerformance(
  orders: PerfOrderLine[],
): ProductPerfRow[] {
  const rows = new Map<string, ProductAccumulator>();

  for (const order of orders) {
    const amount = orderAmount(order);
    const unitsInOrder = order.items.reduce((sum, i) => sum + i.quantity, 0);

    for (const item of order.items) {
      let row = rows.get(item.productId);
      if (!row) {
        row = emptyProductRow(item.productId, item.productName);
        rows.set(item.productId, row);
      }

      row.totalOrders += 1;
      row.unitsSold += item.quantity;

      if (order.status === "DELIVERED") {
        row.deliveredUnits += item.quantity;
        if (unitsInOrder > 0) {
          const share = d(item.quantity).div(unitsInOrder);
          row.turnover = row.turnover.add(amount.mul(share));
          row.earnings = row.earnings.add(
            roundMoney(d(order.partnerEarning).mul(share)),
          );
        }
      } else if (order.status === "REFUSED" || order.status === "RETURNED") {
        row.returnedUnits += item.quantity;
      }
    }
  }

  return [...rows.values()]
    .map(finalizeProduct)
    .sort((a, b) => b.earnings - a.earnings || b.unitsSold - a.unitsSold);
}


export type PlatformPerfLine = PerfOrderLine & { partnerId: string };

export type PartnerPerfRow = {
  partnerId: string;
  displayName: string;
  code: string;
  status: string;
  totalOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
  turnover: number;
  earnings: number;
  deliveryRate: number;
};

export type PlatformPerf = {
  kpis: {
    totalOrders: number;
    deliveredOrders: number;
    returnedOrders: number;
    deliveryRate: number;
    returnRate: number;
    turnover: number;
    partnerPayout: number;
    platformMargin: number;
  };
  topPartners: PartnerPerfRow[];
  topProducts: ProductPerfRow[];
};

export function aggregatePlatformPerformance(input: {
  partners: { id: string; displayName: string; code: string; status: string }[];
  orders: PlatformPerfLine[];
}): PlatformPerf {
  const partners = new Map<
    string,
    Omit<PartnerPerfRow, "turnover" | "earnings" | "deliveryRate"> & {
      turnoverAcc: Decimal;
      earningsAcc: Decimal;
    }
  >(
    input.partners.map((p) => [
      p.id,
      {
        partnerId: p.id,
        displayName: p.displayName,
        code: p.code,
        status: p.status,
        totalOrders: 0,
        deliveredOrders: 0,
        returnedOrders: 0,
        turnoverAcc: d(0),
        earningsAcc: d(0),
      },
    ]),
  );

  let deliveredOrders = 0;
  let returnedOrders = 0;
  // decimal.js is immutable: every accumulation must rebind the variable.
  let turnoverAcc = d(0);
  let payoutAcc = d(0);
  let marginAcc = d(0);

  for (const order of input.orders) {
    const amount = orderAmount(order);
    const partner = partners.get(order.partnerId);

    if (partner) partner.totalOrders += 1;

    if (order.status === "DELIVERED") {
      deliveredOrders += 1;
      turnoverAcc = turnoverAcc.add(amount);
      payoutAcc = payoutAcc.add(order.partnerEarning);
      marginAcc = marginAcc.add(order.platformShare);
      if (partner) {
        partner.deliveredOrders += 1;
        partner.turnoverAcc = partner.turnoverAcc.add(amount);
        partner.earningsAcc = partner.earningsAcc.add(order.partnerEarning);
      }
    } else if (order.status === "REFUSED" || order.status === "RETURNED") {
      returnedOrders += 1;
      if (partner) partner.returnedOrders += 1;
    }
  }

  const resolved = deliveredOrders + returnedOrders;
  const topPartners = [...partners.values()]
    .map(({ turnoverAcc: t, earningsAcc: e, ...row }) => ({
      ...row,
      turnover: roundMoney(t).toNumber(),
      earnings: roundMoney(e).toNumber(),
      deliveryRate: percent(
        row.deliveredOrders,
        row.deliveredOrders + row.returnedOrders,
      ),
    }))
    .sort((a, b) => b.turnover - a.turnover || b.totalOrders - a.totalOrders);

  return {
    kpis: {
      totalOrders: input.orders.length,
      deliveredOrders,
      returnedOrders,
      deliveryRate: percent(deliveredOrders, resolved),
      returnRate: percent(returnedOrders, resolved),
      turnover: roundMoney(turnoverAcc).toNumber(),
      partnerPayout: roundMoney(payoutAcc).toNumber(),
      platformMargin: roundMoney(marginAcc).toNumber(),
    },
    topPartners,
    topProducts: aggregateProductPerformance(input.orders),
  };
}
