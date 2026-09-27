import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createOrder, OrderError } from "@/modules/orders/create";
import { changeOrderStatus, StatusError } from "@/modules/orders/status";
import { getPartnerOrder } from "@/modules/orders/queries";

const prisma = new PrismaClient();
const stamp = Date.now();

let adminId = "";
let partnerAId = "";
let partnerAUserId = "";
let partnerBId = "";
let productId = "";
let outsiderProductId = "";

function orderInput(overrides: Record<string, unknown> = {}) {
  return {
    productId,
    quantity: 2,
    sellingPrice: 60,
    customerFullName: "Ahmed Ben Ali",
    phone: "22333444",
    governorate: "Tunis",
    city: "Ariana",
    address: "10 rue de Paris",
    notes: "",
    confirmed: "on",
    ...overrides,
  } as never;
}

beforeAll(async () => {
  const hash = bcrypt.hashSync("Test1234!", 4);
  const admin = await prisma.user.create({
    data: {
      email: `int-admin-${stamp}@test.local`,
      passwordHash: hash,
      firstName: "Int",
      lastName: "Admin",
      role: "ADMIN",
    },
  });
  adminId = admin.id;

  const userA = await prisma.user.create({
    data: {
      email: `int-partner-a-${stamp}@test.local`,
      passwordHash: hash,
      firstName: "Partner",
      lastName: "A",
      role: "PARTNER",
    },
  });
  const partnerA = await prisma.partner.create({
    data: {
      userId: userA.id,
      code: `IA${stamp}`,
      displayName: "Integration Partner A",
    },
  });
  partnerAId = partnerA.id;
  partnerAUserId = userA.id;

  const userB = await prisma.user.create({
    data: {
      email: `int-partner-b-${stamp}@test.local`,
      passwordHash: hash,
      firstName: "Partner",
      lastName: "B",
      role: "PARTNER",
    },
  });
  const partnerB = await prisma.partner.create({
    data: {
      userId: userB.id,
      code: `IB${stamp}`,
      displayName: "Integration Partner B",
    },
  });
  partnerBId = partnerB.id;

  const product = await prisma.product.create({
    data: {
      name: `Integration Product ${stamp}`,
      slug: `integration-product-${stamp}`,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 7,
      sellingPrice: 50,
      stockQuantity: 100,
      lowStockThreshold: 5,
      status: "ACTIVE",
    },
  });
  productId = product.id;

  const outsiderProduct = await prisma.product.create({
    data: {
      name: `Outsider Product ${stamp}`,
      slug: `outsider-product-${stamp}`,
      purchaseCost: 10,
      packagingCost: 1,
      deliveryCost: 5,
      sellingPrice: 40,
      stockQuantity: 50,
      status: "ACTIVE",
    },
  });
  outsiderProductId = outsiderProduct.id;

  await prisma.partnerProduct.create({
    data: { partnerId: partnerAId, productId },
  });
});

afterAll(async () => {
  // Cleanup in FK-safe order. The ledger is immutable and has no cascade, so
  // any partner that earned (DELIVERED orders) must be cleared first.
  const partnerIds = [partnerAId, partnerBId];
  await prisma.financialTransaction.deleteMany({
    where: { partnerId: { in: partnerIds } },
  });
  await prisma.withdrawal.deleteMany({ where: { partnerId: { in: partnerIds } } });
  await prisma.wallet.deleteMany({ where: { partnerId: { in: partnerIds } } });
  await prisma.order.deleteMany({ where: { partnerId: { in: partnerIds } } });
  await prisma.customer.deleteMany({ where: { ownerPartnerId: { in: partnerIds } } });
  await prisma.partnerProduct.deleteMany({
    where: { partnerId: { in: partnerIds } },
  });
  await prisma.product.deleteMany({ where: { id: { in: [productId, outsiderProductId] } } });
  await prisma.partner.deleteMany({ where: { id: { in: [partnerAId, partnerBId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminId, partnerAUserId] } } });
  await prisma.user.deleteMany({ where: { email: { contains: `int-partner-b-${stamp}` } } });
  await prisma.$disconnect();
});

describe("Order lifecycle integration (spec §33)", () => {
  let orderId = "";

  it("#1 partner creates a CONFIRMED order with a frozen snapshot", async () => {
    const before = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    const order = await createOrder(orderInput(), {
      partnerId: partnerAId,
      actorId: partnerAUserId,
    });
    orderId = order.id;

    expect(order.status).toBe("CONFIRMED");
    expect(order.partnerConfirmedAt).not.toBeNull();
    expect(order.orderNumber).toBeGreaterThan(1000);

    // Snapshot math: revenue120 − product40 − packaging2 − delivery7 =71
    expect(order.contribution.toFixed(3)).toBe("71.000");
    // Partner default commission =60% (model default)
    expect(order.partnerEarning.toFixed(3)).toBe("42.600");
    expect(order.platformShare.toFixed(3)).toBe("28.400");
    expect(order.partnerEarning.plus(order.platformShare).toFixed(3)).toBe(
      order.contribution.toFixed(3),
    );

    const after = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(after.stockQuantity).toBe(before.stockQuantity - 2);

    const history = await prisma.orderStatusHistory.findFirst({
      where: { orderId: order.id },
    });
    expect(history?.newStatus).toBe("CONFIRMED");
    expect(history?.reason).toContain("Je confirme que le client a accepté");
  });

  it("#2 REJECTS creation without the confirmation checkbox", async () => {
    await expect(
      createOrder(orderInput({ confirmed: undefined }) as never, {
        partnerId: partnerAId,
        actorId: partnerAUserId,
      }),
    ).rejects.toThrow();
  });

  it("dedups customers by phone within the partner", async () => {
    const second = await createOrder(
      orderInput({ customerFullName: "Ahmed B. Ali (maj)" }) as never,
      { partnerId: partnerAId, actorId: partnerAUserId },
    );
    const first = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { customerId: true },
    });
    expect(second.customerId).toBe(first.customerId);
    const count = await prisma.customer.count({
      where: { ownerPartnerId: partnerAId, phone: "22333444" },
    });
    expect(count).toBe(1);
    await prisma.order.delete({ where: { id: second.id } });
  });

  it("#3 partner B cannot read partner A's order (ownership in query)", async () => {
    const stolen = await getPartnerOrder(partnerBId, orderId);
    expect(stolen).toBeNull();
    const own = await getPartnerOrder(partnerAId, orderId);
    expect(own).not.toBeNull();
  });

  it("#3 partner B cannot order a product not assigned to them", async () => {
    await expect(
      createOrder(orderInput({ productId: outsiderProductId }) as never, {
        partnerId: partnerBId,
        actorId: partnerBId,
      }),
    ).rejects.toThrow(OrderError);
  });

  it("#4 admin validates; history + audit recorded", async () => {
    const updated = await changeOrderStatus({
      orderId,
      to: "VALIDATED",
      actorId: adminId,
      role: "ADMIN",
    });
    expect(updated.status).toBe("VALIDATED");
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: orderId, action: "ORDER_STATUS_CHANGED" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
  });

  it("#5 transitions are enforced server-side", async () => {
    await expect(
      changeOrderStatus({ orderId, to: "SHIPPED", actorId: adminId, role: "ADMIN" }),
    ).rejects.toThrow(StatusError);
    await expect(
      changeOrderStatus({
        orderId,
        to: "PREPARING",
        actorId: partnerAUserId,
        role: "PARTNER",
      }),
    ).rejects.toThrow(StatusError);
    await expect(
      changeOrderStatus({ orderId, to: "ON_HOLD", actorId: adminId, role: "ADMIN" }),
    ).rejects.toThrow("motif");
    await changeOrderStatus({
      orderId,
      to: "ON_HOLD",
      actorId: adminId,
      role: "ADMIN",
      reason: "test hold",
    });
    const resumed = await changeOrderStatus({
      orderId,
      to: "VALIDATED",
      actorId: adminId,
      role: "ADMIN",
    });
    expect(resumed.status).toBe("VALIDATED");
    expect(resumed.statusBeforeHold).toBeNull();
  });

  it("#14 product cost changes never alter a historical snapshot", async () => {
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const before = order.productCost.toFixed(3);
    expect(before).toBe("40.000"); // qty2 ×20 DT
    await prisma.product.update({
      where: { id: productId },
      data: { purchaseCost: 99.999 },
    });
    const after = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(after.productCost.toFixed(3)).toBe(before);
    await prisma.product.update({
      where: { id: productId },
      data: { purchaseCost: 20 },
    });
  });

  it("cancellation restocks the product", async () => {
    const stockBefore = (
      await prisma.product.findUniqueOrThrow({ where: { id: productId } })
    ).stockQuantity;
    const o = await createOrder(orderInput({ quantity: 3 }) as never, {
      partnerId: partnerAId,
      actorId: partnerAUserId,
    });
    const mid = (
      await prisma.product.findUniqueOrThrow({ where: { id: productId } })
    ).stockQuantity;
    expect(mid).toBe(stockBefore - 3);

    await changeOrderStatus({
      orderId: o.id,
      to: "CANCELLED",
      actorId: adminId,
      role: "ADMIN",
      reason: "test cancel",
    });
    const stockAfter = (
      await prisma.product.findUniqueOrThrow({ where: { id: productId } })
    ).stockQuantity;
    expect(stockAfter).toBe(stockBefore);
    await prisma.order.delete({ where: { id: o.id } });
  });

  it("delivery freezes deliveredAt + settlementDueAt (+48h)", async () => {
    const o = await createOrder(orderInput({ phone: "99887766" }) as never, {
      partnerId: partnerAId,
      actorId: partnerAUserId,
    });
    for (const hop of ["VALIDATED", "PREPARING", "PACKAGED", "SHIPPED", "IN_DELIVERY"] as const) {
      await changeOrderStatus({ orderId: o.id, to: hop, actorId: adminId, role: "ADMIN" });
    }
    const delivered = await changeOrderStatus({
      orderId: o.id,
      to: "DELIVERED",
      actorId: adminId,
      role: "ADMIN",
    });
    expect(delivered.deliveredAt).not.toBeNull();
    expect(delivered.settlementDueAt).not.toBeNull();
    const diff =
      (delivered.settlementDueAt!.getTime() - delivered.deliveredAt!.getTime()) /
      3_600_000;
    expect(Math.round(diff)).toBe(48);
    await prisma.order.delete({ where: { id: o.id } });
  });
});


