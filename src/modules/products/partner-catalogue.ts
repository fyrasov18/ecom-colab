import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

/**
 * Partner-facing catalogue: ONLY products actively assigned to the partner.
 * Enforced server-side — never trust IDs from the URL.
 */
export async function listAssignedProducts(partnerId: string) {
  return prisma.partnerProduct.findMany({
    where: {
      partnerId,
      status: "ACTIVE",
      product: { status: { in: ["ACTIVE", "OUT_OF_STOCK"] } },
    },
    orderBy: { assignedAt: "desc" },
    include: {
      product: {
        include: {
          media: { orderBy: { sortOrder: "asc" } },
          marketingAssets: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] },
        },
      },
    },
  });
}

/**
 * ACTIVE assignments a partner may order from, with the commission inputs
 * (assignment → partner → product → global) the order form needs.
 */
export async function listOrderableAssignments(partnerId: string) {
  return prisma.partnerProduct.findMany({
    where: { partnerId, status: "ACTIVE" },
    orderBy: { assignedAt: "desc" },
    include: { product: true },
  });
}

/** Single product view for a partner — 404 unless assigned and active. */
export async function getAssignedProduct(partnerId: string, productId: string) {
  const assignment = await prisma.partnerProduct.findUnique({
    where: { partnerId_productId: { partnerId, productId } },
    include: {
      product: {
        include: {
          media: { orderBy: { sortOrder: "asc" } },
          marketingAssets: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] },
        },
      },
    },
  });
  if (
    !assignment ||
    assignment.status !== "ACTIVE" ||
    (assignment.product.status !== "ACTIVE" && assignment.product.status !== "OUT_OF_STOCK")
  ) {
    notFound();
  }
  return assignment;
}
