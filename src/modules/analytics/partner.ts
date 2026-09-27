import { prisma } from "@/lib/prisma";
import { d } from "@/lib/money";
import {
  aggregateProductPerformance,
  orderAmount,
  summarizeOrders,
  type OrderStatusCounts,
  type PerfOrderLine,
  type ProductPerfRow,
} from "./compute";

/** Prisma Decimal -> plain number so the result crosses the RSC boundary safely. */
const n = (value: { toNumber(): number } | null | undefined): number =>
  value ? value.toNumber() : 0;

/** Money is 3-decimal (millimes); keep floats aligned with that precision. */
const round3 = (value: number): number => Math.round(value * 1000) / 1000;

const RECENT_ORDERS = 6;

const perfSelect = {
  status: true,
  quantity: true,
  unitSellingPrice: true,
  partnerEarning: true,
  platformShare: true,
  items: {
    select: { productId: true, productName: true, quantity: true },
  },
} as const;

async function loadPerfRows(partnerId: string) {
  const orders = await prisma.order.findMany({
    where: { partnerId },
    select: perfSelect,
    orderBy: { createdAt: "desc" },
  });
  return orders.map(
    (o): PerfOrderLine => ({
      status: o.status,
      quantity: o.quantity,
      unitSellingPrice: n(o.unitSellingPrice),
      partnerEarning: n(o.partnerEarning),
      platformShare: n(o.platformShare),
      items: o.items,
    }),
  );
}

/**
 * Partner dashboard KPIs. Ownership is enforced by the `partnerId` argument,
 * which is always taken from the session (never from user input).
 */
export async function getPartnerDashboardData(partnerId: string) {
  const [wallet, statusGroups, totalOrders, recentOrders, assignedProductsCount] =
    await Promise.all([
      prisma.wallet.findUnique({ where: { partnerId } }),
      prisma.order.groupBy({
        by: ["status"],
        where: { partnerId },
        _count: { _all: true },
      }),
      prisma.order.count({ where: { partnerId } }),
      prisma.order.findMany({
        where: { partnerId },
        take: RECENT_ORDERS,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          quantity: true,
          unitSellingPrice: true,
          createdAt: true,
          customer: { select: { fullName: true } },
          items: { select: { productName: true } },
        },
      }),
      prisma.partnerProduct.count({ where: { partnerId, status: "ACTIVE" } }),
    ]);

  const counts = Object.fromEntries(
    statusGroups.map((g) => [g.status, g._count._all]),
  ) as OrderStatusCounts;
  const summary = summarizeOrders(counts);

  return {
    wallet: {
      availableBalance: n(wallet?.availableBalance),
      pendingBalance: n(wallet?.pendingBalance),
      totalEarned: n(wallet?.totalEarned),
      totalWithdrawn: n(wallet?.totalWithdrawn),
    },
    orders: { total: totalOrders, ...summary },
    assignedProductsCount,
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      amount: orderAmount({ unitSellingPrice: n(o.unitSellingPrice), quantity: o.quantity }).toNumber(),
      customerName: o.customer.fullName,
      productName: o.items[0]?.productName ?? "—",
      createdAt: o.createdAt.toISOString(),
    })),
  };
}

export type PartnerPerformance = Awaited<
  ReturnType<typeof getPartnerPerformanceData>
>;

/** Extended partner view: dashboard KPIs + per-product performance breakdown. */
export async function getPartnerPerformanceData(partnerId: string) {
  const [dashboard, perfRows] = await Promise.all([
    getPartnerDashboardData(partnerId),
    loadPerfRows(partnerId),
  ]);

  const productPerformances: ProductPerfRow[] = aggregateProductPerformance(perfRows);

  const delivered = perfRows.filter((o) => o.status === "DELIVERED");
  // Money math goes through decimal.js (see lib/money), never raw floats.
  const turnover = delivered
    .reduce((acc, o) => acc.add(orderAmount(o)), d(0))
    .toNumber();
  const averageBasket = delivered.length > 0 ? round3(turnover / delivered.length) : 0;

  return {
    ...dashboard,
    productPerformances,
    commercial: {
      deliveredOrders: delivered.length,
      turnover: round3(turnover),
      averageBasket,
      unitsSold: perfRows.reduce(
        (acc, o) => acc + o.items.reduce((a, i) => a + i.quantity, 0),
        0,
      ),
    },
  };
}

