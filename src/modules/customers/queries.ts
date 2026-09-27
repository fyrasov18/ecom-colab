import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

/** Admin customer directory (all partners' customers). */
export async function listCustomers(filters: { search?: string; page?: number }) {
  const page = Math.max(1, filters.page ?? 1);
  const q = filters.search?.trim();
  const where: Prisma.CustomerWhereInput = q
    ? /^\d+$/.test(q)
      ? { phone: { contains: q } }
      : {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
          ],
        }
    : {};

  const [total, items] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        ownerPartner: { select: { displayName: true, code: true } },
        _count: { select: { orders: true } },
      },
    }),
  ]);
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getCustomerDetail(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      ownerPartner: { select: { id: true, displayName: true, code: true } },
      orders: {
        orderBy: { createdAt: "desc" },
        include: { items: { select: { productName: true, quantity: true } } },
      },
    },
  });
}
