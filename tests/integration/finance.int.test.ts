import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, type OrderStatus, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createOrder } from "@/modules/orders/create";
import { changeOrderStatus } from "@/modules/orders/status";
import {
  createPartnerEarning,
  settleDueEarnings,
} from "@/modules/finance/ledger";
import {
  approveWithdrawal,
  getWithdrawableSummary,
  markWithdrawalUnderReview,
  payWithdrawal,
  rejectWithdrawal,
  requestWithdrawal,
  WithdrawalError,
} from "@/modules/finance/withdrawals";
import { deriveWalletBalances } from "@/modules/finance/rules";
import { SETTING_KEYS, type SettingKey } from "@/modules/settings/defaults";
import { getSetting, updateSetting } from "@/modules/settings/service";

const prisma = new PrismaClient();
const stamp = Date.now();

let adminId = "";
let partnerUserId = "";
let partnerId = "";
let productId = "";
let counter = 0;

const PIPELINE: OrderStatus[] = [
  "VALIDATED",
  "PREPARING",
  "PACKAGED",
  "SHIPPED",
  "IN_DELIVERY",
];

async function makeOrder() {
  counter++;
  return createOrder(
    {
      productId,
      quantity: 1,
      sellingPrice: 60,
      customerFullName: `Fin Test ${counter}`,
      phone: `33${String(2000000 + counter).slice(-6)}`,
      governorate: "Tunis",
      city: "Ariana",
      address: `${counter} rue de la Finance`,
      notes: "",
      confirmed: "on",
    } as never,
    { partnerId, actorId: partnerUserId },
  );
}

async function advance(orderId: string, statuses: OrderStatus[]) {
  for (const to of statuses) {
    await changeOrderStatus({
      orderId,
      to,
      actorId: adminId,
      role: "ADMIN" as Role,
    });
  }
}

/** Order pushed all the way to DELIVERED → earning booked PENDING. */
async function deliver() {
  const order = await makeOrder();
  await advance(order.id, [...PIPELINE, "DELIVERED"]);
  return prisma.order.findUniqueOrThrow({ where: { id: order.id } });
}

/** Make an order's ledger entries immediately settleable. */
async function makeDue(orderId: string) {
  await prisma.financialTransaction.updateMany({
    where: { orderId },
    data: { availableAt: new Date(Date.now() - 60_000) },
  });
}

function walletOf() {
  return prisma.wallet.findUniqueOrThrow({ where: { partnerId } });
}

const dec = (value: unknown) => Number(value).toFixed(3);

/**
 * The suite pins the three finance settings it depends on (48h window, 100 DT
 * minimum, default return rule) and restores the developer's own values at the
 * end, so a locally tweaked setting can never make the run flaky.
 */
const pinnedSettings: { key: string; existed: boolean; value: unknown }[] = [];

async function pinSetting(key: SettingKey, value: unknown) {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  pinnedSettings.push({
    key,
    existed: Boolean(row),
    value: row?.value ?? null,
  });
  await updateSetting({ key, value, actorId: adminId });
}

async function restoreSettings() {
  for (const pinned of pinnedSettings) {
    if (pinned.existed) {
      await prisma.systemSetting.update({
        where: { key: pinned.key },
        data: { value: pinned.value as never },
      });
    } else {
      await prisma.systemSetting.deleteMany({ where: { key: pinned.key } });
    }
  }
  pinnedSettings.length = 0;
}

beforeAll(async () => {
  const hash = bcrypt.hashSync("Test1234!", 4);
  const admin = await prisma.user.create({
    data: {
      email: `fin-admin-${stamp}@test.local`,
      passwordHash: hash,
      firstName: "Fin",
      lastName: "Admin",
      role: "ADMIN",
    },
  });
  adminId = admin.id;

  const user = await prisma.user.create({
    data: {
      email: `fin-partner-${stamp}@test.local`,
      passwordHash: hash,
      firstName: "Fin",
      lastName: "Partner",
      role: "PARTNER",
    },
  });
  partnerUserId = user.id;

  const partner = await prisma.partner.create({
    data: {
      userId: user.id,
      code: `FN${stamp}`,
      displayName: "Finance Test Partner",
      defaultCommissionType: "PERCENTAGE",
      defaultCommissionValue: 60,
    },
  });
  partnerId = partner.id;

  const product = await prisma.product.create({
    data: {
      name: `Finance Product ${stamp}`,
      slug: `finance-product-${stamp}`,
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

  await pinSetting(SETTING_KEYS.SETTLEMENT_PERIOD_HOURS, 48);
  await pinSetting(SETTING_KEYS.MIN_WITHDRAWAL_AMOUNT, 100);
  await pinSetting(SETTING_KEYS.RETURN_COST_RULE, "REVERSE_PENDING_EARNING");
});

afterAll(async () => {
  await restoreSettings();
  await prisma.financialTransaction.deleteMany({ where: { partnerId } });
  await prisma.withdrawal.deleteMany({ where: { partnerId } });
  await prisma.return.deleteMany({ where: { order: { partnerId } } });
  await prisma.order.deleteMany({ where: { partnerId } });
  await prisma.customer.deleteMany({ where: { ownerPartnerId: partnerId } });
  await prisma.partnerProduct.deleteMany({ where: { partnerId } });
  await prisma.wallet.deleteMany({ where: { partnerId } });
  await prisma.product.delete({ where: { id: productId } }).catch(() => {});
  await prisma.partner.delete({ where: { id: partnerId } }).catch(() => {});
  await prisma.user.deleteMany({
    where: { id: { in: [adminId, partnerUserId] } },
  });
  await prisma.$disconnect();
});

describe("partner earnings ledger", () => {
  it("books a PENDING earning on DELIVERED with a frozen settlement date", async () => {
    const order = await deliver();

    expect(order.earningStatus).toBe("PENDING");
    expect(order.deliveredAt).not.toBeNull();
    expect(order.settlementDueAt).not.toBeNull();

    const hours =
      (order.settlementDueAt!.getTime() - order.deliveredAt!.getTime()) / 3_600_000;
    const configured = await getSetting<number>(
      SETTING_KEYS.SETTLEMENT_PERIOD_HOURS,
    );
    expect(hours).toBeCloseTo(configured, 1);

    const entries = await prisma.financialTransaction.findMany({
      where: { orderId: order.id },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("PARTNER_EARNING");
    expect(entries[0].status).toBe("PENDING");
    expect(entries[0].availableAt?.getTime()).toBe(order.settlementDueAt!.getTime());
    expect(dec(entries[0].amount)).toBe(dec(order.partnerEarning));

    const wallet = await walletOf();
    expect(dec(wallet.pendingBalance)).toBe(dec(order.partnerEarning));
  });

  it("is idempotent: re-running the earning creation never duplicates money", async () => {
    const order = await prisma.order.findFirstOrThrow({
      where: { partnerId, earningStatus: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    await createPartnerEarning(prisma, order);
    await createPartnerEarning(prisma, order);

    const count = await prisma.financialTransaction.count({
      where: { orderId: order.id, type: "PARTNER_EARNING" },
    });
    expect(count).toBe(1);
  });

  it("settles only the entries whose frozen date has passed", async () => {
    const first = await deliver();
    const second = await deliver();
    await makeDue(first.id);

    // Scoped to this partner: the settlement engine also releases entries of
    // other partners, so only our own deltas are asserted.
    const before = await walletOf();
    await settleDueEarnings();

    const settled = await prisma.financialTransaction.findFirstOrThrow({
      where: { orderId: first.id },
    });
    const stillPending = await prisma.financialTransaction.findFirstOrThrow({
      where: { orderId: second.id },
    });
    expect(settled.status).toBe("AVAILABLE");
    expect(stillPending.status).toBe("PENDING");
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { id: first.id } }))
        .earningStatus,
    ).toBe("AVAILABLE");

    const after = await walletOf();
    expect(dec(after.availableBalance)).toBe(
      (Number(before.availableBalance) + Number(first.partnerEarning)).toFixed(3),
    );
    expect(dec(after.pendingBalance)).toBe(
      (Number(before.pendingBalance) - Number(first.partnerEarning)).toFixed(3),
    );

    // Second run is a no-op: nothing of ours was left due.
    await settleDueEarnings();
    const unchanged = await walletOf();
    expect(dec(unchanged.availableBalance)).toBe(dec(after.availableBalance));
    expect(dec(unchanged.pendingBalance)).toBe(dec(after.pendingBalance));
  });

  it("keeps the wallet cache identical to the ledger (invariant)", async () => {
    const rows = await prisma.financialTransaction.findMany({
      where: { partnerId },
      select: { type: true, status: true, amount: true },
    });
    const derived = deriveWalletBalances(rows);
    const wallet = await walletOf();
    expect(dec(wallet.availableBalance)).toBe(derived.availableBalance.toFixed(3));
    expect(dec(wallet.pendingBalance)).toBe(derived.pendingBalance.toFixed(3));
    expect(dec(wallet.totalEarned)).toBe(derived.totalEarned.toFixed(3));
    expect(dec(wallet.totalWithdrawn)).toBe(derived.totalWithdrawn.toFixed(3));
  });
});

describe("return / refusal cost rules", () => {
  it("charges nothing when the order fails before delivery (default rule)", async () => {
    const order = await makeOrder();
    await advance(order.id, PIPELINE);
    await changeOrderStatus({
      orderId: order.id,
      to: "REFUSED",
      actorId: adminId,
      role: "ADMIN",
      reason: "Client absent",
    });

    const record = await prisma.return.findUniqueOrThrow({
      where: { orderId: order.id },
    });
    expect(record.kind).toBe("REFUSED");
    expect(dec(record.costCharged)).toBe("0.000");
    expect(
      await prisma.financialTransaction.count({ where: { orderId: order.id } }),
    ).toBe(0);
  });

  it("reverses a PENDING earning when a DELIVERED order is returned", async () => {
    const order = await deliver();
    await changeOrderStatus({
      orderId: order.id,
      to: "RETURNED",
      actorId: adminId,
      role: "ADMIN",
      reason: "Produit non conforme",
    });

    const entries = await prisma.financialTransaction.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "asc" },
    });
    expect(entries).toHaveLength(2);
    const reversal = entries.find((e) => e.type === "RETURN_COST")!;
    expect(dec(reversal.amount)).toBe(`-${dec(order.partnerEarning)}`);
    expect(reversal.status).toBe("PENDING");

    const record = await prisma.return.findUniqueOrThrow({
      where: { orderId: order.id },
    });
    expect(dec(record.costCharged)).toBe(dec(order.partnerEarning));
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { id: order.id } }))
        .earningStatus,
    ).toBe("REVERSED");

    // The reversal cancels the pending gain and never leaks into "available",
    // even after the settlement date passes.
    const before = await walletOf();
    await makeDue(order.id);
    await settleDueEarnings();
    const after = await walletOf();
    expect(dec(after.availableBalance)).toBe(dec(before.availableBalance));
    expect(dec(after.pendingBalance)).toBe(dec(before.pendingBalance));
  });
});

describe("return cost rule variants (system setting)", () => {
  it("REVERSE_PLUS_DELIVERY additionally charges the delivery cost immediately", async () => {
    await updateSetting({
      key: SETTING_KEYS.RETURN_COST_RULE,
      value: "REVERSE_PLUS_DELIVERY",
      actorId: adminId,
    });
    try {
      const availableBefore = Number((await walletOf()).availableBalance);
      const order = await deliver();
      await changeOrderStatus({
        orderId: order.id,
        to: "RETURNED",
        actorId: adminId,
        role: "ADMIN",
        reason: "Retour transporteur",
      });

      const record = await prisma.return.findUniqueOrThrow({
        where: { orderId: order.id },
      });
      expect(dec(record.costCharged)).toBe(
        (Number(order.partnerEarning) + Number(order.deliveryCost)).toFixed(3),
      );

      const delivery = await prisma.financialTransaction.findFirstOrThrow({
        where: { idempotencyKey: `return-delivery:${order.id}` },
      });
      expect(delivery.type).toBe("RETURN_COST");
      expect(delivery.status).toBe("AVAILABLE");
      expect(dec(delivery.amount)).toBe(`-${dec(order.deliveryCost)}`);

      const after = await walletOf();
      expect(dec(after.availableBalance)).toBe(
        (availableBefore - Number(order.deliveryCost)).toFixed(3),
      );
    } finally {
      await updateSetting({
        key: SETTING_KEYS.RETURN_COST_RULE,
        value: "REVERSE_PENDING_EARNING",
        actorId: adminId,
      });
    }
  });

  it("NO_COST leaves the return unpaid by the partner (platform absorbs it)", async () => {
    await updateSetting({
      key: SETTING_KEYS.RETURN_COST_RULE,
      value: "NO_COST",
      actorId: adminId,
    });
    try {
      const order = await deliver();
      await changeOrderStatus({
        orderId: order.id,
        to: "RETURNED",
        actorId: adminId,
        role: "ADMIN",
        reason: "Geste commercial",
      });

      const record = await prisma.return.findUniqueOrThrow({
        where: { orderId: order.id },
      });
      expect(dec(record.costCharged)).toBe("0.000");
      expect(
        await prisma.financialTransaction.count({
          where: { orderId: order.id, type: "RETURN_COST" },
        }),
      ).toBe(0);
      // Only the original earning remains, still PENDING (nothing reversed).
      expect(
        await prisma.financialTransaction.count({ where: { orderId: order.id } }),
      ).toBe(1);
    } finally {
      await updateSetting({
        key: SETTING_KEYS.RETURN_COST_RULE,
        value: "REVERSE_PENDING_EARNING",
        actorId: adminId,
      });
    }
  });
});

let firstWithdrawalId = "";
let availableAtStart = 0;

describe("withdrawal lifecycle (no funds locked before PAID)", () => {
  it("derives the drawable amount from the ledger and guards the request", async () => {
    // Seed a real available balance: 6 delivered orders settled immediately.
    for (let i = 0; i < 6; i++) {
      const order = await deliver();
      await makeDue(order.id);
    }
    await settleDueEarnings();

    const summary = await getWithdrawableSummary(partnerId);
    availableAtStart = Number(summary.wallet.availableBalance);
    expect(availableAtStart).toBeGreaterThanOrEqual(Number(summary.minAmount));
    expect(Number(summary.drawable)).toBe(availableAtStart);

    // Below the configured minimum → refused.
    await expect(
      requestWithdrawal({
        partnerId,
        amount: Number(summary.minAmount) - 1,
        paymentMethod: "BANK_TRANSFER",
        paymentAccount: "TN59 1000 6035 1000 4821",
        actorId: partnerUserId,
      }),
    ).rejects.toBeInstanceOf(WithdrawalError);

    // Above the available balance (pending earnings are not withdrawable).
    await expect(
      requestWithdrawal({
        partnerId,
        amount: availableAtStart + 50,
        paymentMethod: "BANK_TRANSFER",
        paymentAccount: "TN59 1000 6035 1000 4821",
        actorId: partnerUserId,
      }),
    ).rejects.toBeInstanceOf(WithdrawalError);

    const withdrawal = await requestWithdrawal({
      partnerId,
      amount: 100,
      paymentMethod: "BANK_TRANSFER",
      paymentAccount: "TN59 1000 6035 1000 4821",
      actorId: partnerUserId,
    });
    firstWithdrawalId = withdrawal.id;
    expect(withdrawal.status).toBe("REQUESTED");
    expect(dec(withdrawal.amount)).toBe("100.000");

    // No lock: requesting does not move the ledger.
    expect(dec((await walletOf()).availableBalance)).toBe(dec(availableAtStart));
    expect(
      await prisma.financialTransaction.count({
        where: { partnerId, type: "WITHDRAWAL" },
      }),
    ).toBe(0);

    // One active request at a time.
    await expect(
      requestWithdrawal({
        partnerId,
        amount: 100,
        paymentMethod: "CASH",
        paymentAccount: "Bureau partenaire",
        actorId: partnerUserId,
      }),
    ).rejects.toThrow(/déjà en cours/);

    // The drawable amount shrinks by the pending request.
    const after = await getWithdrawableSummary(partnerId);
    expect(Number(after.drawable)).toBeCloseTo(availableAtStart - 100, 3);
  });

  it("is operator-only and a motivated rejection leaves the ledger untouched", async () => {
    await expect(
      approveWithdrawal({
        withdrawalId: firstWithdrawalId,
        actorId: partnerUserId,
        role: "PARTNER",
      }),
    ).rejects.toBeInstanceOf(WithdrawalError);

    const reviewing = await markWithdrawalUnderReview({
      withdrawalId: firstWithdrawalId,
      actorId: adminId,
      role: "ADMIN",
    });
    expect(reviewing.status).toBe("UNDER_REVIEW");

    const rejected = await rejectWithdrawal({
      withdrawalId: firstWithdrawalId,
      actorId: adminId,
      role: "ADMIN",
      reason: "Coordonnées bancaires incomplètes",
    });
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectionReason).toBe("Coordonnées bancaires incomplètes");
    expect(rejected.reviewedById).toBe(adminId);

    // Nothing was locked, so nothing has to be released.
    expect(dec((await walletOf()).availableBalance)).toBe(dec(availableAtStart));
    expect(
      await prisma.financialTransaction.count({
        where: { partnerId, type: "WITHDRAWAL" },
      }),
    ).toBe(0);

    // The partner may request again now that no active request remains.
    const next = await requestWithdrawal({
      partnerId,
      amount: 100,
      paymentMethod: "BANK_TRANSFER",
      paymentAccount: "TN59 1000 6035 1000 4821",
      actorId: partnerUserId,
    });
    expect(next.status).toBe("REQUESTED");

    // APPROVED still does not touch the ledger…
    const approved = await approveWithdrawal({
      withdrawalId: next.id,
      actorId: adminId,
      role: "ADMIN",
    });
    expect(approved.status).toBe("APPROVED");
    expect(
      await prisma.financialTransaction.count({
        where: { partnerId, type: "WITHDRAWAL" },
      }),
    ).toBe(0);
    expect(dec((await walletOf()).availableBalance)).toBe(dec(availableAtStart));

    // …only PAID does, exactly once.
    const paid = await payWithdrawal({
      withdrawalId: next.id,
      actorId: adminId,
      role: "ADMIN",
      transactionReference: `TRX-${stamp}`,
    });
    expect(paid.status).toBe("PAID");
    expect(paid.paidAt).not.toBeNull();
    expect(paid.transactionReference).toBe(`TRX-${stamp}`);

    const debit = await prisma.financialTransaction.findFirstOrThrow({
      where: { withdrawalId: paid.id },
    });
    expect(debit.type).toBe("WITHDRAWAL");
    expect(dec(debit.amount)).toBe("-100.000");

    const wallet = await walletOf();
    expect(dec(wallet.availableBalance)).toBe(dec(availableAtStart - 100));
    expect(dec(wallet.totalWithdrawn)).toBe("100.000");

    // Double payment is impossible.
    await expect(
      payWithdrawal({
        withdrawalId: paid.id,
        actorId: adminId,
        role: "ADMIN",
        transactionReference: `TRX-${stamp}-DUP`,
      }),
    ).rejects.toBeInstanceOf(WithdrawalError);
    expect(
      await prisma.financialTransaction.count({ where: { withdrawalId: paid.id } }),
    ).toBe(1);

    // Wallet cache still equals the ledger projection.
    const rows = await prisma.financialTransaction.findMany({
      where: { partnerId },
      select: { type: true, status: true, amount: true },
    });
    const derived = deriveWalletBalances(rows);
    const fresh = await walletOf();
    expect(dec(fresh.availableBalance)).toBe(derived.availableBalance.toFixed(3));
    expect(dec(fresh.totalWithdrawn)).toBe(derived.totalWithdrawn.toFixed(3));
  });
});

describe("settlement cron endpoint", () => {
  it("rejects unauthenticated calls and settles idempotently when authorised", async () => {
    const { GET } = await import("@/app/api/cron/settle/route");
    const original = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-cron-secret";

    try {
      const order = await deliver();
      await makeDue(order.id);

      const unauthorized = await GET(
        new Request("http://localhost/api/cron/settle"),
      );
      expect(unauthorized.status).toBe(401);

      const wrongKey = await GET(
        new Request("http://localhost/api/cron/settle?key=nope"),
      );
      expect(wrongKey.status).toBe(401);

      const ok = await GET(
        new Request("http://localhost/api/cron/settle?key=test-cron-secret"),
      );
      expect(ok.status).toBe(200);
      const body = (await ok.json()) as { ok: boolean; settled: number };
      expect(body.ok).toBe(true);
      // Other partners' due entries may exist in a live dev DB → at least ours.
      expect(body.settled).toBeGreaterThanOrEqual(1);
      const released = await prisma.financialTransaction.findFirstOrThrow({
        where: { orderId: order.id },
      });
      expect(released.status).toBe("AVAILABLE");

      const bearer = await GET(
        new Request("http://localhost/api/cron/settle", {
          headers: { authorization: "Bearer test-cron-secret" },
        }),
      );
      expect(bearer.status).toBe(200);
      const second = (await bearer.json()) as { settled: number };
      expect(second.settled).toBe(0); // nothing left to release
    } finally {
      if (original === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = original;
    }
  });

  it("returns 500 when CRON_SECRET is not configured", async () => {
    const { GET } = await import("@/app/api/cron/settle/route");
    const original = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      const response = await GET(
        new Request("http://localhost/api/cron/settle?key=anything"),
      );
      expect(response.status).toBe(500);
    } finally {
      if (original !== undefined) process.env.CRON_SECRET = original;
    }
  });
});
