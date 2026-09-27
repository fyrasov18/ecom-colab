import { prisma } from "@/lib/prisma";

/** Admin marketing overview: products with their kit completeness. */
export async function listProductsWithMarketing() {
  const products = await prisma.product.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { name: "asc" },
    include: {
      marketingAssets: { select: { kind: true } },
      media: { select: { id: true } },
    },
  });
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    assetCount: p.marketingAssets.length,
    kinds: Array.from(new Set(p.marketingAssets.map((a) => a.kind))),
    mediaCount: p.media.length,
  }));
}
