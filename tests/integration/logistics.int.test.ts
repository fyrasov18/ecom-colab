import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createOrder } from "@/modules/orders/create";
import { changeOrderStatus } from "@/modules/orders/status";
import { bulkChangeStatus } from "@/modules/logistics/bulk";

const prisma = new PrismaClient();
const stamp = Date.now();

let adminId = "";
let partnerUserId = "";
let partnerId = "";
let productId = "";

async function makeReadyOrder(index: number) {
  const order = await createOrder(
    {
      productId,
      quantity: 1,
      sellingPrice: 60,
      customerFullName: `Log Test ${index}`,
      phone: `22${String(1000000 + index).slice(-6)}`,
      governorate: "Tunis",
      city: "Ariana",
      address: `${index} rue de la Logistique`,
      notes: "",
      confirmed: "on",
    } as never,
    { partnerId, actorId: partnerUserId },
  );
  await changeOrderStatus({
    orderId: order.id,
    to: "VALIDATED",
    actorId: adminId,
    role: "ADMIN" as Role,
  });
  return order;
}

beforeAll(async () => {
  const hash = bcrypt.hashSync("Test1234!", 4);
  const admin = await prisma.user.create({
    data: {
      email: `log-admin-${stamp}@test.local`,
      passwordHash: hash,
      firstName: "Log",
      lastName: "Admin",
      role: "ADMIN",
    },
  });
  adminId = admin.id;

  const user = await prisma.user.create({
    data: {
      email: `log-partner-${stamp}@test.local`,
      passwordHash: hash,
      firstName: "Log",
      lastName: "Partner",
      role: "PARTNER",
    },
  });
  partnerUserId = user.id;
  const partner = await prisma.partner.create({
    data: {
      userId: user.id,
      code: `LG${stamp}`,
      displayName: "Logistics Test Partner",
    },
  });
  partnerId = partner.id;

  const product = await prisma.product.create({
    data: {
      name: `Logistics Product ${stamp}`,
      slug: `logistics-product-${stamp}`,
      purchaseCost: 15,
      packagingCost: 1,
      deliveryCost: 5,
      sellingPrice: 50,
      stockQuantity: 500,
      lowStockThreshold: 5,
      status: "ACTIVE",
    },
  });
  productId = product.id;
  await prisma.partnerProduct.create({ data: { partnerId, productId } });
});

afterAll(async () => {
  // The ledger is immutable and has no cascade: a partner that ever earned
  // (DELIVERED in this suite) cannot be deleted before its rows are removed.
  await prisma.financialTransaction.deleteMany({ where: { partnerId } });
  await prisma.withdrawal.deleteMany({ where: { partnerId } });
  await prisma.wallet.deleteMany({ where: { partnerId } });
  await prisma.order.deleteMany({ where: { partnerId } });
  await prisma.customer.deleteMany({ where: { ownerPartnerId: partnerId } });
  await prisma.partnerProduct.deleteMany({ where: { partnerId } });
  await prisma.product.delete({ where: { id: productId } }).catch(() => {});
  await prisma.partner.delete({ where: { id: partnerId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: [adminId, partnerUserId] } } });
  await prisma.$disconnect();
});

describe("logistics operations", () => {
  it("bulk-advances several orders with partial-failure reporting", async () => {
    const orders = await Promise.all([
      makeReadyOrder(1),
      makeReadyOrder(2),
      makeReadyOrder(3),
    ]);
    const ids = orders.map((o) => o.id);

    const result = await bulkChangeStatus({
      orderIds: ids,
      to: "PREPARING",
      actorId: adminId,
      role: "ADMIN",
    });
    expect(result.applied).toBe(3);
    expect(result.failed).toHaveLength(0);

    const statuses = await prisma.order.findMany({
      where: { id: { in: ids } },
      select: { status: true },
    });
    expect(statuses.every((s) => s.status === "PREPARING")).toBe(true);

    // Second identical run → per-order failures, no crash (stale rows)
    const again = await bulkChangeStatus({
      orderIds: ids,
      to: "PREPARING",
      actorId: adminId,
      role: "ADMIN",
    });
    expect(again.applied).toBe(0);
    expect(again.failed).toHaveLength(3);

    await prisma.order.deleteMany({ where: { id: { in: ids } } });
  });

  it("REJECTS bulk transitions needing individual reasons", async () => {
    await expect(
      bulkChangeStatus({
        orderIds: ["x"],
        to: "REFUSED",
        actorId: adminId,
        role: "ADMIN",
      }),
    ).rejects.toThrow();
    await expect(
      bulkChangeStatus({
        orderIds: ["x"],
        to: "CANCELLED",
        actorId: adminId,
        role: "ADMIN",
      }),
    ).rejects.toThrow();
  });

  it("creates a Shipment when shipped; deliveredAt on delivery", async () => {
    const o = await makeReadyOrder(4);
    await changeOrderStatus({ orderId: o.id, to: "PREPARING", actorId: adminId, role: "ADMIN" });
    await changeOrderStatus({ orderId: o.id, to: "PACKAGED", actorId: adminId, role: "ADMIN" });
    await changeOrderStatus({ orderId: o.id, to: "SHIPPED", actorId: adminId, role: "ADMIN" });

    const shipment = await prisma.shipment.findUnique({ where: { orderId: o.id } });
    expect(shipment).not.toBeNull();
    expect(shipment!.shippedAt).not.toBeNull();

    await changeOrderStatus({ orderId: o.id, to: "IN_DELIVERY", actorId: adminId, role: "ADMIN" });
    await changeOrderStatus({ orderId: o.id, to: "DELIVERED", actorId: adminId, role: "ADMIN" });
    const after = await prisma.shipment.findUnique({ where: { orderId: o.id } });
    expect(after!.deliveredAt).not.toBeNull();

    await prisma.order.delete({ where: { id: o.id } });
  });

  it("creates DISTINCT Return records for REFUSED vs RETURNED", async () => {
    const refused = await makeReadyOrder(5);
    const returned = await makeReadyOrder(6);
    for (const o of [refused, returned]) {
      await changeOrderStatus({ orderId: o.id, to: "PREPARING", actorId: adminId, role: "ADMIN" });
      await changeOrderStatus({ orderId: o.id, to: "PACKAGED", actorId: adminId, role: "ADMIN" });
      await changeOrderStatus({ orderId: o.id, to: "SHIPPED", actorId: adminId, role: "ADMIN" });
      await changeOrderStatus({ orderId: o.id, to: "IN_DELIVERY", actorId: adminId, role: "ADMIN" });
    }

    await changeOrderStatus({
      orderId: refused.id,
      to: "REFUSED",
      actorId: adminId,
      role: "ADMIN",
      reason: "Client refuse le colis",
    });
    await changeOrderStatus({
      orderId: returned.id,
      to: "RETURNED",
      actorId: adminId,
      role: "ADMIN",
      reason: "Produit endommage",
    });

    const r1 = await prisma.return.findUnique({ where: { orderId: refused.id } });
    const r2 = await prisma.return.findUnique({ where: { orderId: returned.id } });
    expect(r1?.kind).toBe("REFUSED");
    expect(r2?.kind).toBe("RETURNED");
    expect(r1?.reason).toBe("Client refuse le colis");

    await prisma.order.deleteMany({
      where: { id: { in: [refused.id, returned.id] } },
    });
  });
});

