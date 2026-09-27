import { Prisma, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

export type OrderListFilters = {
  q?: string;
  status?: OrderStatus;
  partnerId?: string;
  productId?: string;
  governorate?: string;
  from?: string;
  to?: string;
  page?: number;
};

function buildWhere(f: OrderListFilters): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];
  if (f.status) and.push({ status: f.status });
  if (f.partnerId) and.push({ partnerId: f.partnerId });
  if (f.governorate)
    and.push({ customer: { governorate: { equals: f.governorate, mode: "insensitive" } } });
  if (f.productId) and.push({ items: { some: { productId: f.productId } } });
  if (f.from) {
    const d = new Date(f.from);
    if (!isNaN(d.getTime())) and.push({ createdAt: { gte: d } });
  }
  if (f.to) {
    const d = new Date(f.to);
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      and.push({ createdAt: { lte: d } });
    }
  }
  if (f.q) {
    const q = f.q.trim();
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
          { customer: { phone: { contains: q } } },
          { partner: { displayName: { contains: q, mode: "insensitive" } } },
        ],
      });
    }
  }
  return { AND: and };
}

/** Admin list — every filter is server-side. */
export async function listOrders(filters: OrderListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const where = buildWhere(filters);
  const [total, items] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      // id tie-breaker: stable total order across pages on createdAt ties.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        customer: { select: { fullName: true, phone: true, governorate: true } },
        partner: { select: { displayName: true, code: true } },
        items: { select: { productName: true, quantity: true } },
      },
    }),
  ]);
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Partner list — ownership enforced in the WHERE clause (server-side). */
export async function listPartnerOrders(
  partnerId: string,
  filters: { status?: OrderStatus; page?: number } = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.OrderWhereInput = {
    partnerId,
    ...(filters.status ? { status: filters.status } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      // id tie-breaker: stable total order across pages on createdAt ties.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        customer: { select: { fullName: true, phone: true, city: true } },
        items: { select: { productName: true, quantity: true } },
      },
    }),
  ]);
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

const detailInclude = {
  customer: true,
  partner: { select: { id: true, displayName: true, code: true } },
  items: true,
  shipment: true,
  returnRecord: true,
  statusHistory: {
    orderBy: { createdAt: "asc" as const },
    include: { changedBy: { select: { firstName: true, lastName: true, role: true } } },
  },
} satisfies Prisma.OrderInclude;

export async function getOrderDetail(id: string) {
  return prisma.order.findUnique({ where: { id }, include: detailInclude });
}

/** Detail scoped to a partner — returns null unless it IS their order. */
export async function getPartnerOrder(partnerId: string, id: string) {
  return prisma.order.findFirst({
    where: { id, partnerId },
    include: detailInclude,
  });
}
