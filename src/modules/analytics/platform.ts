import { prisma } from "@/lib/prisma";
import { aggregatePlatformPerformance, type PlatformPerfLine } from "./compute";

const n = (value: { toNumber(): number } | null | undefined): number =>
  value ? value.toNumber() : 0;

const TOP_N = 10;

/**
 * Platform-wide performance analytics (admin scope).
 *
 * Purely derived from orders: only DELIVERED orders contribute turnover,
 * partner payout and platform margin, matching the settlement engine.
 */
export async function getPlatformPerformances() {
  const [partners, orders] = await Promise.all([
    prisma.partner.findMany({
      select: { id: true, displayName: true, code: true, status: true },
    }),
    prisma.order.findMany({
      select: {
        partnerId: true,
        status: true,
        quantity: true,
        unitSellingPrice: true,
        partnerEarning: true,
        platformShare: true,
        items: { select: { productId: true, productName: true, quantity: true } },
      },
    }),
  ]);

  const lines: PlatformPerfLine[] = orders.map((o) => ({
    partnerId: o.partnerId,
    status: o.status,
    quantity: o.quantity,
    unitSellingPrice: n(o.unitSellingPrice),
    partnerEarning: n(o.partnerEarning),
    platformShare: n(o.platformShare),
    items: o.items,
  }));

  const result = aggregatePlatformPerformance({
    partners: partners.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      code: p.code,
      status: p.status,
    })),
    orders: lines,
  });

  return {
    ...result,
    topPartners: result.topPartners.slice(0, TOP_N),
    topProducts: result.topProducts.slice(0, TOP_N),
  };
}

export type PlatformPerformances = Awaited<ReturnType<typeof getPlatformPerformances>>;
