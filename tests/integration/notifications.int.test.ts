import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma as appPrisma } from "@/lib/prisma";
import { notify, notifyBackOffice, notifyPartnerAccount } from "@/modules/notifications/service";
import { listNotifications, markAllAsRead, markAsRead, countUnread, NotificationError } from "@/modules/notifications/queries";
import { createOrder } from "@/modules/orders/create";
import { changeOrderStatus } from "@/modules/orders/status";
import { requestWithdrawal } from "@/modules/finance/withdrawals";

const prisma = new PrismaClient();
const stamp = Date.now();

let adminId = "";
let superAdminId = "";
let partnerAId = "";
let partnerAUserId = "";
let partnerBId = "";
let partnerBUserId = "";
let productId = "";

/** Notes about the partner's own order, so notifications are unambiguous. */
function orderInput(overrides: Record<string, unknown> = {}) {
  return {
    productId,
    quantity: 1,
    sellingPrice: 60,
    customerFullName: "Notif Test",
    phone: `55${String(stamp).slice(-6)}`,
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
  const mk = async (email: string, role: "ADMIN" | "SUPER_ADMIN" | "PARTNER") =>
    prisma.user.create({
      data: { email, passwordHash: hash, firstName: "Notif", lastName: "Test", role },
    });

  const admin = await mk(`notif-admin-${stamp}@test.local`, "ADMIN");
  adminId = admin.id;
  const superAdmin = await mk(`notif-super-${stamp}@test.local`, "SUPER_ADMIN");
  superAdminId = superAdmin.id;

  const userA = await mk(`notif-partner-a-${stamp}@test.local`, "PARTNER");
  partnerAId = (
    await prisma.partner.create({
      data: { userId: userA.id, code: `NA${stamp}`, displayName: "Notif Partner A" },
    })
  ).id;
  partnerAUserId = userA.id;

  const userB = await mk(`notif-partner-b-${stamp}@test.local`, "PARTNER");
  partnerBId = (
    await prisma.partner.create({
      data: { userId: userB.id, code: `NB${stamp}`, displayName: "Notif Partner B" },
    })
  ).id;
  partnerBUserId = userB.id;

  const product = await prisma.product.create({
    data: {
      name: `Notif Product ${stamp}`,
      slug: `notif-product-${stamp}`,
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
  await prisma.partnerProduct.create({ data: { partnerId: partnerAId, productId } });
});

afterAll(async () => {
  const partnerIds = [partnerAId, partnerBId];
  const userIds = [adminId, superAdminId, partnerAUserId, partnerBUserId];

  // FK-safe teardown: notifications cascade from User, ledger does not cascade.
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.financialTransaction.deleteMany({ where: { partnerId: { in: partnerIds } } });
  await prisma.withdrawal.deleteMany({ where: { partnerId: { in: partnerIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await prisma.orderStatusHistory.deleteMany({ where: { changedById: { in: userIds } } });
  await prisma.order.deleteMany({ where: { partnerId: { in: partnerIds } } });
  await prisma.customer.deleteMany({ where: { ownerPartnerId: { in: partnerIds } } });
  await prisma.wallet.deleteMany({ where: { partnerId: { in: partnerIds } } });
  await prisma.partnerProduct.deleteMany({ where: { partnerId: { in: partnerIds } } });
  await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
  await appPrisma.$disconnect();
});

beforeEach(async () => {
  await prisma.notification.deleteMany({
    where: { userId: { in: [adminId, superAdminId, partnerAUserId, partnerBUserId] } },
  });
});

describe("notifications — atomicity (the contract the emitters rely on)", () => {
  it("a notification written through a transaction client is ROLLED BACK with it", async () => {
    const before = await prisma.notification.count();

    await expect(
      prisma.$transaction(async (tx) => {
        await notify(tx, {
          userId: partnerAUserId,
          type: "SYSTEM",
          title: "doomed",
          body: "this must never survive",
        });
        // Simulate a later step of the business operation failing.
        throw new Error("business operation failed");
      }),
    ).rejects.toThrow("business operation failed");

    expect(await prisma.notification.count()).toBe(before);
    expect(
      await prisma.notification.findFirst({ where: { title: "doomed" } }),
    ).toBeNull();
  });

  it("the same notification DOES survive outside a transaction (why tx matters)", async () => {
    await notify(appPrisma, {
      userId: partnerAUserId,
      type: "SYSTEM",
      title: "committed directly",
      body: "no transaction wrapping this one",
    });
    expect(
      await prisma.notification.findFirst({ where: { title: "committed directly" } }),
    ).not.toBeNull();
  });
});

describe("notifications — audience resolution", () => {
  it("notifyBackOffice reaches every active back-office user", async () => {
    await notifyBackOffice(prisma, {
      type: "STOCK",
      title: "low stock",
      body: "body",
    });
    expect(await prisma.notification.count({ where: { userId: adminId } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: superAdminId } })).toBe(1);
    // Partners must never receive back-office alerts.
    expect(await prisma.notification.count({ where: { userId: partnerAUserId } })).toBe(0);
  });

  it("notifyPartnerAccount resolves the partner's own user", async () => {
    await notifyPartnerAccount(prisma, partnerAId, {
      type: "SYSTEM",
      title: "for A",
      body: "body",
    });
    expect(await prisma.notification.count({ where: { userId: partnerAUserId, title: "for A" } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: partnerBUserId } })).toBe(0);
  });

  it("notifyPartnerAccount is a no-op for an unknown partner (no crash)", async () => {
    const res = await notifyPartnerAccount(prisma, "does-not-exist", {
      type: "SYSTEM",
      title: "nobody",
      body: "body",
    });
    expect(res).toEqual({ count: 0 });
  });
});

describe("notifications — emitters fire on real business events", () => {
  it("an order status change notifies ONLY the owning partner", async () => {
    const order = await createOrder(orderInput(), {
      partnerId: partnerAId,
      actorId: partnerAUserId,
    });
    await changeOrderStatus({ orderId: order.id, to: "VALIDATED", actorId: adminId, role: "ADMIN" });

    const forA = await prisma.notification.findMany({ where: { userId: partnerAUserId } });
    expect(forA).toHaveLength(1);
    expect(forA[0].type).toBe("ORDER_STATUS");
    expect(forA[0].title).toContain(String(order.orderNumber));
    expect(forA[0].link).toBe(`/mes-commandes/${order.id}`);

    // Data isolation: partner B is untouched.
    expect(await prisma.notification.count({ where: { userId: partnerBUserId } })).toBe(0);
    // The operator who acted is not spammed about it.
    expect(await prisma.notification.count({ where: { userId: adminId } })).toBe(0);

    await prisma.order.delete({ where: { id: order.id } });
  });

  it("a rejected transition writes NO notification (rolled back together)", async () => {
    const order = await createOrder(orderInput(), {
      partnerId: partnerAId,
      actorId: partnerAUserId,
    });

    // PACKAGED -> VALIDATED is forbidden; the whole transaction must abort.
    await changeOrderStatus({ orderId: order.id, to: "VALIDATED", actorId: adminId, role: "ADMIN" });
    await prisma.order.update({ where: { id: order.id }, data: { status: "PACKAGED" } });
    await prisma.notification.deleteMany({ where: { userId: partnerAUserId } });

    // Snapshot AFTER the legitimate first change: the failed attempt must add
    // nothing on top, rather than "there is nothing at all".
    const auditBefore = await prisma.auditLog.count({
      where: { entityId: order.id, action: "ORDER_STATUS_CHANGED" },
    });
    expect(auditBefore).toBe(1);

    await expect(
      changeOrderStatus({ orderId: order.id, to: "VALIDATED", actorId: adminId, role: "ADMIN" }),
    ).rejects.toThrow();

    expect(await prisma.notification.count({ where: { userId: partnerAUserId } })).toBe(0);
    const still = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(still.status).toBe("PACKAGED");

    // The failed attempt left no history row and no audit row behind.
    expect(
      await prisma.orderStatusHistory.count({
        where: { orderId: order.id, newStatus: "VALIDATED" },
      }),
    ).toBe(1); // only the successful first one
    expect(
      await prisma.auditLog.count({
        where: { entityId: order.id, action: "ORDER_STATUS_CHANGED" },
      }),
    ).toBe(auditBefore);

    await prisma.order.delete({ where: { id: order.id } });
  });

  it("a refund/return that reverses the earning tells the partner about the money", async () => {
    const order = await createOrder(orderInput(), {
      partnerId: partnerAId,
      actorId: partnerAUserId,
    });
    for (const hop of ["VALIDATED", "PREPARING", "PACKAGED", "SHIPPED", "IN_DELIVERY", "DELIVERED"] as const) {
      await changeOrderStatus({ orderId: order.id, to: hop, actorId: adminId, role: "ADMIN" });
    }
    await prisma.notification.deleteMany({ where: { userId: partnerAUserId } });

    await changeOrderStatus({
      orderId: order.id,
      to: "RETURNED",
      actorId: adminId,
      role: "ADMIN",
      reason: "integration return",
    });

    const types = await prisma.notification.findMany({
      where: { userId: partnerAUserId },
      select: { type: true, title: true },
    });
    // One status notice + one explicit financial reversal notice.
    expect(types.map((t) => t.type).sort()).toEqual(["EARNING", "ORDER_STATUS"]);

    await prisma.financialTransaction.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  });

  it("a withdrawal request notifies the back office, not the partner", async () => {
    // Seeded MIN_WITHDRAWAL_AMOUNT is 100 DT, so earn comfortably above it:
    // qty 10 => contribution 29*10 - 7 = 283 DT => partner earning 169,800 DT.
    const order = await createOrder(orderInput({ quantity: 10 }), {
      partnerId: partnerAId,
      actorId: partnerAUserId,
    });
    for (const hop of ["VALIDATED", "PREPARING", "PACKAGED", "SHIPPED", "IN_DELIVERY", "DELIVERED"] as const) {
      await changeOrderStatus({ orderId: order.id, to: hop, actorId: adminId, role: "ADMIN" });
    }
    await prisma.financialTransaction.updateMany({
      where: { orderId: order.id, type: "PARTNER_EARNING" },
      data: { status: "AVAILABLE" },
    });

    await requestWithdrawal({
      partnerId: partnerAId,
      amount: 100,
      paymentMethod: "VIR",
      paymentAccount: "TEST-1",
      actorId: partnerAUserId,
    });

    expect(await prisma.notification.count({ where: { userId: adminId, type: "WITHDRAWAL" } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: superAdminId, type: "WITHDRAWAL" } })).toBe(1);
    // The requester already knows; they must not be notified about it.
    expect(
      await prisma.notification.count({ where: { userId: partnerAUserId, type: "WITHDRAWAL" } }),
    ).toBe(0);

    await prisma.financialTransaction.deleteMany({ where: { orderId: order.id } });
    await prisma.withdrawal.deleteMany({ where: { partnerId: partnerAId } });
    await prisma.order.delete({ where: { id: order.id } });
  });

  it("low stock alerts the back office ONCE, not on every subsequent order", async () => {
    await prisma.product.update({
      where: { id: productId },
      data: { stockQuantity: 7, lowStockThreshold: 5 },
    });

    // First order crosses 7 -> 6? No: threshold is 5, so 7->6 does not cross.
    const o1 = await createOrder(orderInput({ quantity: 1 }), {
      partnerId: partnerAId,
      actorId: partnerAUserId,
    });
    expect(await prisma.notification.count({ where: { userId: adminId, type: "STOCK" } })).toBe(0);

    // 6 -> 5 lands exactly ON the threshold: this is the crossing.
    const o2 = await createOrder(orderInput({ quantity: 1 }), {
      partnerId: partnerAId,
      actorId: partnerAUserId,
    });
    const alerts = await prisma.notification.count({ where: { userId: adminId, type: "STOCK" } });
    expect(alerts).toBe(1);

    // Already low: further orders must stay silent (anti-flooding rule).
    const o3 = await createOrder(orderInput({ quantity: 1 }), {
      partnerId: partnerAId,
      actorId: partnerAUserId,
    });
    expect(await prisma.notification.count({ where: { userId: adminId, type: "STOCK" } })).toBe(1);

    for (const o of [o1, o2, o3]) {
      await prisma.financialTransaction.deleteMany({ where: { orderId: o.id } });
      await prisma.order.delete({ where: { id: o.id } });
    }
    await prisma.product.update({
      where: { id: productId },
      data: { stockQuantity: 100 },
    });
  });
});

describe("notifications — read state and data isolation", () => {
  const seed = async (userId: string, n: number) => {
    for (let i = 0; i < n; i += 1) {
      await notify(prisma, {
        userId,
        type: "SYSTEM",
        title: `n${i}`,
        body: "b",
      });
    }
  };

  it("lists only the caller's notifications, newest first", async () => {
    await seed(partnerAUserId, 3);
    await seed(partnerBUserId, 2);

    const a = await listNotifications(partnerAUserId);
    expect(a.total).toBe(3);
    expect(a.items).toHaveLength(3);
    expect(a.items[0].createdAt.getTime()).toBeGreaterThanOrEqual(a.items[1].createdAt.getTime());
    // B's items are invisible to A.
    expect(a.items.every((i) => i.title.startsWith("n"))).toBe(true);
  });

  it("filters by unread / read and by type", async () => {
    await seed(partnerAUserId, 3);
    const first = await listNotifications(partnerAUserId, { pageSize: 5 });
    await markAsRead(partnerAUserId, first.items[0].id);

    expect((await listNotifications(partnerAUserId, { view: "unread" })).total).toBe(2);
    expect((await listNotifications(partnerAUserId, { view: "read" })).total).toBe(1);
    expect((await listNotifications(partnerAUserId, { type: "SYSTEM" })).total).toBe(3);
    expect((await listNotifications(partnerAUserId, { type: "ORDER_STATUS" })).total).toBe(0);
  });

  it("countUnread reflects the read state", async () => {
    await seed(partnerAUserId, 2);
    expect(await countUnread(partnerAUserId)).toBe(2);
    const first = await listNotifications(partnerAUserId);
    await markAsRead(partnerAUserId, first.items[0].id);
    expect(await countUnread(partnerAUserId)).toBe(1);
  });

  it("a user CANNOT mark somebody else's notification as read", async () => {
    await seed(partnerBUserId, 1);
    const bItem = (await listNotifications(partnerBUserId)).items[0];

    await expect(markAsRead(partnerAUserId, bItem.id)).rejects.toThrow(NotificationError);
    // And it must still be unread for its real owner.
    expect(await countUnread(partnerBUserId)).toBe(1);
  });

  it("markAllAsRead only clears the caller's own notifications", async () => {
    await seed(partnerAUserId, 3);
    await seed(partnerBUserId, 2);

    const cleared = await markAllAsRead(partnerAUserId);
    expect(cleared).toBe(3);
    expect(await countUnread(partnerAUserId)).toBe(0);
    expect(await countUnread(partnerBUserId)).toBe(2);
  });

  it("marking an already-read notification is idempotent, not an error", async () => {
    await seed(partnerAUserId, 1);
    const item = (await listNotifications(partnerAUserId)).items[0];
    await markAsRead(partnerAUserId, item.id);
    await expect(markAsRead(partnerAUserId, item.id)).resolves.toBe(true);
    expect(await countUnread(partnerAUserId)).toBe(0);
  });

  it("pagination stays inside the caller's slice", async () => {
    // NOTE: listNotifications clamps pageSize to a 5..50 window, so a smaller
    // requested size is deliberately widened rather than honoured literally.
    await seed(partnerAUserId, 12);
    const p1 = await listNotifications(partnerAUserId, { page: 1, pageSize: 5 });
    const p2 = await listNotifications(partnerAUserId, { page: 2, pageSize: 5 });
    const p3 = await listNotifications(partnerAUserId, { page: 3, pageSize: 5 });

    expect(p1.items).toHaveLength(5);
    expect(p2.items).toHaveLength(5);
    expect(p3.items).toHaveLength(2);
    expect(p1.totalPages).toBe(3);
    expect(p1.total).toBe(12);

    // Every row is returned exactly once across the pages.
    const seen = [...p1.items, ...p2.items, ...p3.items].map((i) => i.id);
    expect(new Set(seen).size).toBe(12);
  });

  it("clamps an out-of-range pageSize instead of trusting it", async () => {
    await seed(partnerAUserId, 3);
    const small = await listNotifications(partnerAUserId, { pageSize: 1 });
    expect(small.pageSize).toBe(5); // raised to the floor
    const huge = await listNotifications(partnerAUserId, { pageSize: 10_000 });
    expect(huge.pageSize).toBe(50); // capped
  });
});



