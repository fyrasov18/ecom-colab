import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Global search across the operational entities.
 *
 * SECURITY (spec §38): the scope is derived from the SESSION role — never from
 * anything the client sends. A partner can only ever reach their own orders,
 * their own customers and the products assigned to them; there is no code path
 * where a partner query widens beyond that.
 */

export type SearchScope =
  | { role: "admin" }
  | { role: "partner"; partnerId: string };

export type SearchGroup = "orders" | "customers" | "products" | "partners";

export type SearchHit = {
  id: string;
  group: SearchGroup;
  title: string;
  subtitle: string;
  href: string;
};

export type SearchResults = {
  query: string;
  groups: { key: SearchGroup; label: string; hits: SearchHit[] }[];
  total: number;
};

const GROUP_LABELS: Record<SearchGroup, string> = {
  orders: "Commandes",
  customers: "Clients",
  products: "Produits",
  partners: "Partenaires",
};

/** Per-group caps keep the dropdown light and the queries bounded. */
const PER_GROUP = 5;
const MIN_QUERY_LENGTH = 2;

function isNumeric(q: string): boolean {
  return /^\d+$/.test(q);
}

export async function globalSearch(
  scope: SearchScope,
  rawQuery: string,
): Promise<SearchResults> {
  const q = rawQuery.trim();
  if (q.length < MIN_QUERY_LENGTH) {
    return { query: q, groups: [], total: 0 };
  }

  const isAdmin = scope.role === "admin";
  const partnerId = scope.role === "partner" ? scope.partnerId : null;

  const ordersWhere: Prisma.OrderWhereInput = {
    ...(partnerId ? { partnerId } : {}),
    OR: [
      ...(isNumeric(q) ? [{ orderNumber: { equals: Number(q) } }] : []),
      { customer: { phone: { contains: q } } },
      { customer: { fullName: { contains: q, mode: "insensitive" } } },
    ],
  };

  const customersWhere: Prisma.CustomerWhereInput = {
    // A partner never sees the global customer directory — only their own.
    ...(partnerId ? { ownerPartnerId: partnerId } : {}),
    OR: [
      ...(isNumeric(q) ? [{ phone: { contains: q } }] : []),
      { fullName: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
    ],
  };

  // Partners only ever match products that are explicitly assigned to them.
  const productsWhere: Prisma.ProductWhereInput = {
    ...(partnerId
      ? { partnerAssignations: { some: { partnerId, status: "ACTIVE" } } }
      : {}),
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
    ],
  };

  // Partner search NEVER returns other partners.
  const partnersWhere: Prisma.PartnerWhereInput | null = isAdmin
    ? {
        OR: [
          { displayName: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
        ],
      }
    : null;

  const [orders, customers, products, partners] = await Promise.all([
    prisma.order.findMany({
      where: ordersWhere,
      orderBy: { createdAt: "desc" },
      take: PER_GROUP,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        customer: { select: { fullName: true } },
        partner: { select: { displayName: true } },
      },
    }),
    prisma.customer.findMany({
      where: customersWhere,
      orderBy: { updatedAt: "desc" },
      take: PER_GROUP,
      select: {
        id: true,
        fullName: true,
        phone: true,
        governorate: true,
        orders: { select: { id: true } },
      },
    }),
    prisma.product.findMany({
      where: productsWhere,
      orderBy: { name: "asc" },
      take: PER_GROUP,
      // Explicit field selection: no cost, supplier or platform margin leaks.
      select: { id: true, name: true, slug: true, status: true, source: true },
    }),
    partnersWhere
      ? prisma.partner.findMany({
          where: partnersWhere,
          orderBy: { displayName: "asc" },
          take: PER_GROUP,
          select: { id: true, displayName: true, code: true, status: true },
        })
      : Promise.resolve([]),
  ]);

  const groups: SearchResults["groups"] = [
    {
      key: "orders",
      label: GROUP_LABELS.orders,
      hits: orders.map((o) => ({
        id: o.id,
        group: "orders" as const,
        title: `#${o.orderNumber} — ${o.customer.fullName}`,
        subtitle: `${o.status} · ${o.partner.displayName}`,
        href: isAdmin ? `/commandes/${o.id}` : `/mes-commandes/${o.id}`,
      })),
    },
    {
      key: "customers",
      label: GROUP_LABELS.customers,
      hits: customers.map((c) => ({
        id: c.id,
        group: "customers" as const,
        title: c.fullName,
        subtitle: `${c.phone} · ${c.governorate} · ${c.orders.length} commande(s)`,
        href: isAdmin ? `/clients/${c.id}` : `/mes-commandes?customerId=${c.id}`,
      })),
    },
    {
      key: "products",
      label: GROUP_LABELS.products,
      hits: products.map((p) => ({
        id: p.id,
        group: "products" as const,
        title: p.name,
        subtitle: p.status === "DRAFT" ? "Brouillon" : p.status,
        href: isAdmin ? `/produits/${p.id}` : `/catalogue/${p.id}`,
      })),
    },
    {
      key: "partners",
      label: GROUP_LABELS.partners,
      hits: partners.map((p) => ({
        id: p.id,
        group: "partners" as const,
        title: p.displayName,
        subtitle: `${p.code} · ${p.status}`,
        href: `/partenaires/${p.id}`,
      })),
    },
  ];

  const nonEmpty = groups.filter((g) => g.hits.length > 0);
  return {
    query: q,
    groups: nonEmpty,
    total: nonEmpty.reduce((acc, g) => acc + g.hits.length, 0),
  };
}
