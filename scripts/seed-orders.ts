import { PrismaClient, OrderStatus, Role } from "@prisma/client";
import { createOrder } from "../src/modules/orders/create";
import { changeOrderStatus } from "../src/modules/orders/status";

const prisma = new PrismaClient();

/** Realistic demo orders created through the REAL services (consistent
 * stock, snapshots, history, audit). Skips if orders already exist. */

const FIRST_NAMES = [
  "Ahmed", "Salma", "Karim", "Ines", "Mehdi", "Rania", "Fares", "Mariem",
  "Omar", "Syrine", "Wassim", "Lina", "Anis", "Nada", "Ziad", "Eya",
  "Tarek", "Meriem", "Hatem", "Ons",
];
const LAST_NAMES = [
  "Ben Ali", "Trabelsi", "Gharbi", "Jlassi", "Khelifi", "Mansour",
  "Bouzid", "Ferchichi", "Ayari", "Hamdi", "Saidi", "Mabrouk",
];
const CITIES: Record<string, string[]> = {
  Tunis: ["Ariana", "La Marsa", "Centre Urbain"],
  Sfax: ["Sfax Ville", "Sakiet Ezzit"],
  Sousse: ["Sousse Ville", "Monastir"],
  Ariana: ["Ariana Ville", "Ennasr"],
  Ben_Arous: ["Ben Arous", "El Mourouj"],
};

const PLAN: { target: OrderStatus; count: number }[] = [
  { target: "CONFIRMED", count: 10 },
  { target: "VALIDATED", count: 8 },
  { target: "ON_HOLD", count: 4 },
  { target: "PREPARING", count: 8 },
  { target: "PACKAGED", count: 8 },
  { target: "SHIPPED", count: 8 },
  { target: "IN_DELIVERY", count: 12 },
  { target: "DELIVERED", count: 32 },
  { target: "REFUSED", count: 6 },
  { target: "RETURNED", count: 6 },
  { target: "CANCELLED", count: 6 },
];

/** Full hop path (INCLUDING the target) for pipeline statuses. */
const HOPS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  ON_HOLD: ["VALIDATED"],
  PREPARING: ["VALIDATED", "PREPARING"],
  PACKAGED: ["VALIDATED", "PREPARING", "PACKAGED"],
  SHIPPED: ["VALIDATED", "PREPARING", "PACKAGED", "SHIPPED"],
  IN_DELIVERY: ["VALIDATED", "PREPARING", "PACKAGED", "SHIPPED", "IN_DELIVERY"],
  DELIVERED: ["VALIDATED", "PREPARING", "PACKAGED", "SHIPPED", "IN_DELIVERY", "DELIVERED"],
  REFUSED: ["VALIDATED", "PREPARING", "PACKAGED", "SHIPPED", "IN_DELIVERY"],
  RETURNED: ["VALIDATED", "PREPARING", "PACKAGED", "SHIPPED", "IN_DELIVERY"],
  CANCELLED: ["VALIDATED"],
};

const REASONS: Partial<Record<OrderStatus, string>> = {
  ON_HOLD: "Problème opérationnel — démo",
  CANCELLED: "Annulé — démo",
  REFUSED: "Client a refusé la livraison — démo",
  RETURNED: "Retour transporteur — démo",
};

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const existing = await prisma.order.count();
  if (existing > 0) {
    console.log(`ℹ️  ${existing} commandes existent déjà — seed commandes ignoré.`);
    return;
  }

  // Ensure plenty of stock for demo consumption.
  await prisma.product.updateMany({ data: { stockQuantity: { increment: 250 } } });

  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  const partners = await prisma.partner.findMany({
    where: { status: "ACTIVE" },
    include: { assignedProducts: { where: { status: "ACTIVE" } } },
  });
  const active = partners.filter((p) => p.assignedProducts.length > 0);
  if (active.length === 0) throw new Error("Aucun partenaire actif avec produits.");

  const plan: OrderStatus[] = [];
  for (const { target, count } of PLAN) {
    for (let i = 0; i < count; i++) plan.push(target);
  }

  let created = 0;
  for (const target of plan) {
    const partner = rand(active);
    const assignment = rand(partner.assignedProducts);
    const product = await prisma.product.findUniqueOrThrow({
      where: { id: assignment.productId },
    });
    const cityKey = rand(Object.keys(CITIES));
    const phone = String(20000000 + Math.floor(Math.random() * 79999999));

    // No price is passed here on purpose: createOrder derives the selling price
    // from the Product inside its transaction (spec §42/§47). The seed therefore
    // cannot drift from the real pricing rules.
    const order = await createOrder(
      {
        productId: product.id,
        quantity: 1 + Math.floor(Math.random() * 3),
        customerFullName: `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`,
        phone,
        governorate: cityKey.replace("_", " "),
        city: rand(CITIES[cityKey]),
        address: `${1 + Math.floor(Math.random() * 120)} rue ${rand(["Paris", "Habib Bourguiba", "Farhat Hached", "France", "Antaki"])}`,
        notes: Math.random() > 0.7 ? "Appeler avant livraison." : "",
        confirmed: "on",
      },
      { partnerId: partner.id, actorId: partner.userId },
    );
    created++;

    for (const hop of HOPS[target] ?? []) {
      await changeOrderStatus({
        orderId: order.id,
        to: hop,
        actorId: admin.id,
        role: "ADMIN" as Role,
      });
    }
    if (REASONS[target]) {
      await changeOrderStatus({
        orderId: order.id,
        to: target,
        actorId: admin.id,
        role: "ADMIN" as Role,
        reason: REASONS[target],
      });
    } else if (target === "VALIDATED") {
      await changeOrderStatus({
        orderId: order.id,
        to: "VALIDATED",
        actorId: admin.id,
        role: "ADMIN" as Role,
      });
    }
    // CONFIRMED needs no hop; other pipeline targets are in HOPS above.

    // Backdate:60% spread over the last30 days,40% today (for "today" KPI).
    const daysAgo = Math.random() > 0.4 ? Math.floor(Math.random() * 30) : 0;
    const createdAt = new Date(
      Date.now() - daysAgo * 86_400_000 - Math.floor(Math.random() * 86_400_000),
    );
    await prisma.order.update({ where: { id: order.id }, data: { createdAt } });

    if (target === "DELIVERED") {
      const deliveredAt = new Date(
        createdAt.getTime() + (1 + Math.random() * 4) * 86_400_000,
      );
      const settlementDueAt = new Date(deliveredAt.getTime() + 48 * 3_600_000);
      await prisma.order.update({
        where: { id: order.id },
        data: { deliveredAt, settlementDueAt, updatedAt: deliveredAt },
      });
    }
    if (created % 25 === 0) console.log(`   … ${created}/${plan.length}`);
  }

  console.log(`✅ ${created} commandes de démonstration créées.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

