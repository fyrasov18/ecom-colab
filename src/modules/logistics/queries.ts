import { Prisma, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Operational lanes for daily logistics. `next` = the forward pipeline
 * target offered as a (bulk-)advance action; null = individual handling
 * only (reasons / dynamic resume / informational).
 */
export type LaneKey =
  | "TO_VALIDATE"
  | "TO_PREPARE"
  | "PREPARING"
  | "READY_TO_SHIP"
  | "SHIPPED"
  | "IN_DELIVERY"
  | "ON_HOLD"
  | "RETURNS"
  | "DELIVERED";

export type LaneDef = {
  key: LaneKey;
  label: string;
  statuses: OrderStatus[];
  next: OrderStatus | null;
  tone: "info" | "warning" | "success" | "destructive" | "muted";
};

export const LANES: LaneDef[] = [
  { key: "TO_VALIDATE", label: "À valider", statuses: ["CONFIRMED"], next: "VALIDATED", tone: "info" },
  { key: "TO_PREPARE", label: "À préparer", statuses: ["VALIDATED"], next: "PREPARING", tone: "info" },
  { key: "PREPARING", label: "En préparation", statuses: ["PREPARING"], next: "PACKAGED", tone: "info" },
  { key: "READY_TO_SHIP", label: "Prêtes à expédier", statuses: ["PACKAGED"], next: "SHIPPED", tone: "info" },
  { key: "SHIPPED", label: "Expédiées", statuses: ["SHIPPED"], next: "IN_DELIVERY", tone: "info" },
  { key: "IN_DELIVERY", label: "En livraison", statuses: ["IN_DELIVERY"], next: "DELIVERED", tone: "info" },
  { key: "ON_HOLD", label: "En attente", statuses: ["ON_HOLD"], next: null, tone: "warning" },
  { key: "RETURNS", label: "Retours / Refus", statuses: ["REFUSED", "RETURNED"], next: null, tone: "destructive" },
  { key: "DELIVERED", label: "Livrées", statuses: ["DELIVERED"], next: null, tone: "success" },
];

export function getLane(key: string): LaneDef {
  return LANES.find((l) => l.key === key) ?? LANES[0];
}

export async function getLaneCounts(): Promise<Record<LaneKey, number>> {
  const grouped = await prisma.order.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const byStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
  const counts = {} as Record<LaneKey, number>;
  for (const lane of LANES) {
    counts[lane.key] = lane.statuses.reduce(
      (acc, s) => acc + (byStatus.get(s) ?? 0),
      0,
    );
  }
  return counts;
}

const PAGE_SIZE = 25;

export async function getLaneOrders(
  lane: LaneDef,
  filters: { q?: string; partnerId?: string; page?: number } = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const and: Prisma.OrderWhereInput[] = [{ status: { in: lane.statuses } }];
  if (filters.partnerId) and.push({ partnerId: filters.partnerId });
  if (filters.q) {
    const q = filters.q.trim();
    if (/^\d+$/.test(q)) {
      and.push({
        OR: [
          { orderNumber: { equals: Number(q) } },
          { customer: { phone: { contains: q } } },
        ],
      });
    } else {
      and.push({
        OR: [
          { customer: { fullName: { contains: q, mode: "insensitive" } } },
          { partner: { displayName: { contains: q, mode: "insensitive" } } },
        ],
      });
    }
  }
  const where: Prisma.OrderWhereInput = { AND: and };

  const [total, items] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      // id as tie-breaker: lanes are FIFO (oldest first) and orders created in
      // the same millisecond must keep a total order across OFFSET pages.
      orderBy:
        lane.key === "RETURNS"
          ? [{ updatedAt: "desc" }, { id: "desc" }]
          : [{ createdAt: "asc" }, { id: "asc" }], // oldest first = FIFO for ops
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        customer: { select: { fullName: true, phone: true, city: true, governorate: true } },
        partner: { select: { displayName: true, code: true } },
        items: { select: { productName: true, quantity: true } },
        shipment: { select: { carrier: true, trackingNumber: true, shippedAt: true } },
        returnRecord: { select: { kind: true, reason: true, createdAt: true } },
      },
    }),
  ]);

  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}
