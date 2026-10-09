import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { d, roundMoney } from "@/lib/money";
import { getReturnCostRule } from "@/modules/settings/service";
import { notifyPartnerAccount } from "@/modules/notifications/service";
import { checkAndQualifyOrder } from "@/modules/referrals/qualification";
import { deriveWalletBalances, evaluateReturnCostRule } from "./rules";

type Db = PrismaClient | Prisma.TransactionClient;

export class LedgerError extends Error {}

/** Ledger rows are append-only: an entry is created once, never updated. */
export type LedgerEntryInput = {
  partnerId: string;
  type: "PARTNER_EARNING" | "RETURN_COST" | "WITHDRAWAL" | "ADJUSTMENT";
  amount: Prisma.Decimal | string | number;
  status: "PENDING" | "AVAILABLE";
  idempotencyKey: string;
  orderId?: string | null;
  withdrawalId?: string | null;
  availableAt?: Date | null;
  description?: string | null;
  createdById?: string | null;
};

/**
 * Idempotent ledger append. The unique `idempotencyKey` makes every financial
 * side effect safe to retry (cron re-runs, double clicks, seed backfills).
 */
export async function createLedgerEntry(db: Db, input: LedgerEntryInput) {
  const existing = await db.financialTransaction.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) return existing;

  try {
    return await db.financialTransaction.create({
      data: {
        partnerId: input.partnerId,
        type: input.type,
        amount: new Prisma.Decimal(roundMoney(input.amount).toFixed(3)),
        status: input.status,
        idempotencyKey: input.idempotencyKey,
        orderId: input.orderId ?? null,
        withdrawalId: input.withdrawalId ?? null,
        availableAt: input.availableAt ?? null,
        description: input.description ?? null,
        createdById: input.createdById ?? null,
      },
    });
  } catch (e) {
    // Lost the race against a concurrent identical write → reuse the winner.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const winner = await db.financialTransaction.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (winner) return winner;
    }
    throw e;
  }
}

/**
 * Wallet cache = pure projection of the ledger. Called after every ledger
 * write so the UI never has to aggregate; a mismatch is always detectable
 * by re-deriving from FinancialTransaction (integration-tested).
 */
export async function recomputeWallet(db: Db, partnerId: string) {
  const rows = await db.financialTransaction.findMany({
    where: { partnerId },
    select: { type: true, status: true, amount: true },
  });
  const balances = deriveWalletBalances(
    rows.map((r) => ({ type: r.type, status: r.status, amount: r.amount })),
  );

  return db.wallet.upsert({
    where: { partnerId },
    create: { partnerId, ...toWalletData(balances) },
    update: toWalletData(balances),
  });
}

function toWalletData(balances: {
  availableBalance: Prisma.Decimal;
  pendingBalance: Prisma.Decimal;
  totalEarned: Prisma.Decimal;
  totalWithdrawn: Prisma.Decimal;
}) {
  return {
    availableBalance: new Prisma.Decimal(balances.availableBalance.toFixed(3)),
    pendingBalance: new Prisma.Decimal(balances.pendingBalance.toFixed(3)),
    totalEarned: new Prisma.Decimal(balances.totalEarned.toFixed(3)),
    totalWithdrawn: new Prisma.Decimal(balances.totalWithdrawn.toFixed(3)),
  };
}

/** Ledger total for a partner + order (used by tests/audit screens). */
export async function getOrderLedgerTotal(db: Db, orderId: string) {
  const rows = await db.financialTransaction.findMany({
    where: { orderId },
    select: { amount: true },
  });
  return roundMoney(rows.reduce((acc, r) => acc.plus(d(r.amount)), d(0)));
}

/**
 * DELIVERED → the partner earning enters the ledger as PENDING with the
 * settlement date frozen at delivery time (order.settlementDueAt).
 * Idempotent: `earning:order:<orderId>`.
 */
export async function createPartnerEarning(
  db: Db,
  order: {
    id: string;
    partnerId: string;
    partnerEarning: Prisma.Decimal | string | number;
    settlementDueAt: Date | null;
  },
) {
  const amount = roundMoney(d(order.partnerEarning));
  if (!amount.greaterThan(0)) {
    // Nothing to settle — never create empty money movements.
    return null;
  }
  const availableAt = order.settlementDueAt ?? new Date();

  const entry = await createLedgerEntry(db, {
    partnerId: order.partnerId,
    orderId: order.id,
    type: "PARTNER_EARNING",
    amount,
    status: "PENDING",
    availableAt,
    idempotencyKey: `earning:order:${order.id}`,
    description: "Gain partenaire — commande livrée",
  });

  await db.order.update({
    where: { id: order.id },
    data: { earningStatus: entry.status === "AVAILABLE" ? "AVAILABLE" : "PENDING" },
  });
  await recomputeWallet(db, order.partnerId);
  return entry;
}


const NEG = (amount: ReturnType<typeof d>) => amount.negated();

/**
 * Settlement engine: PENDING → AVAILABLE for every entry whose settlement
 * date has passed. Idempotent by construction (WHERE status = PENDING), so it
 * is safe to call from a cron, a page read, or a script.
 */
export async function settleDueEarnings(opts: { now?: Date; db?: Db } = {}) {
  const db = opts.db ?? prisma;
  const now = opts.now ?? new Date();

  const due = await db.financialTransaction.findMany({
    where: { status: "PENDING", availableAt: { lte: now } },
    select: { id: true, partnerId: true, orderId: true },
    take: 5_000,
  });
  if (due.length === 0) return { settled: 0, partners: [] as string[] };

  await db.financialTransaction.updateMany({
    where: { id: { in: due.map((r) => r.id) }, status: "PENDING" },
    data: { status: "AVAILABLE" },
  });

  const orderIds = due
    .map((r) => r.orderId)
    .filter((id): id is string => Boolean(id));
  if (orderIds.length > 0) {
    await db.order.updateMany({
      where: { id: { in: orderIds }, earningStatus: "PENDING" },
      data: { earningStatus: "AVAILABLE" },
    });

    for (const orderId of orderIds) {
      await checkAndQualifyOrder(orderId, db as Prisma.TransactionClient);
    }
  }

  const partners = Array.from(new Set(due.map((r) => r.partnerId)));
  for (const partnerId of partners) await recomputeWallet(db, partnerId);

  // Phase 7: tell each partner their pending balance just became withdrawable.
  // Grouped per partner so a partner with 5 released orders gets 1 notification.
  const releasedByPartner = new Map<string, number>();
  for (const row of due) {
    releasedByPartner.set(
      row.partnerId,
      (releasedByPartner.get(row.partnerId) ?? 0) + 1,
    );
  }
  for (const [partnerId, count] of releasedByPartner) {
    await notifyPartnerAccount(db, partnerId, {
      type: "SETTLEMENT",
      title: "Gains débloqués",
      body:
        count === 1
          ? "1 gain est désormais disponible et retirable dans votre portefeuille."
          : `${count} gains sont désormais disponibles et retirables dans votre portefeuille.`,
      link: "/portefeuille",
    });
  }

  return { settled: due.length, partners };
}

/**
 * REFUSED / RETURNED → applies the configured return-cost rule to the ledger.
 * `Return.costCharged` stores the total charged to the partner (positive).
 */
export async function applyReturnCostRule(
  db: Db,
  order: {
    id: string;
    partnerId: string;
    deliveryCost: Prisma.Decimal | string | number;
  },
) {
  const rule = await getReturnCostRule(db);
  const earning = await db.financialTransaction.findFirst({
    where: { orderId: order.id, type: "PARTNER_EARNING" },
    select: { amount: true, status: true, availableAt: true },
  });

  const outcome = evaluateReturnCostRule({
    rule,
    earning,
    deliveryCost: order.deliveryCost,
    earningAvailableAt: earning?.availableAt ?? null,
  });

  let charged = d(0);

  if (outcome.reversal) {
    await createLedgerEntry(db, {
      partnerId: order.partnerId,
      orderId: order.id,
      type: "RETURN_COST",
      amount: NEG(outcome.reversal.amount),
      status: "PENDING",
      availableAt: outcome.reversal.availableAt,
      idempotencyKey: `return-reverse:${order.id}`,
      description: "Reprise du gain partenaire en attente (retour/refus)",
    });
    charged = charged.plus(outcome.reversal.amount);
  }

  if (outcome.deliveryCharge) {
    await createLedgerEntry(db, {
      partnerId: order.partnerId,
      orderId: order.id,
      type: "RETURN_COST",
      amount: NEG(outcome.deliveryCharge),
      status: "AVAILABLE",
      idempotencyKey: `return-delivery:${order.id}`,
      description: "Frais de livraison facturés (retour/refus)",
    });
    charged = charged.plus(outcome.deliveryCharge);
  }

  charged = roundMoney(charged);

  await db.return.updateMany({
    where: { orderId: order.id },
    data: { costCharged: new Prisma.Decimal(charged.toFixed(3)) },
  });

  if (charged.greaterThan(0)) {
    await db.order.update({
      where: { id: order.id },
      data: {
        adjustmentsTotal: { increment: charged.toFixed(3) },
        ...(outcome.reversal ? { earningStatus: "REVERSED" as const } : {}),
      },
    });
  }

  await recomputeWallet(db, order.partnerId);

  return {
    rule,
    charged,
    reversedEarning: outcome.reversal?.amount ?? null,
    deliveryCharge: outcome.deliveryCharge,
  };
}

/**
 * PAID withdrawal → immutable negative WITHDRAWAL entry. The unique
 * `idempotencyKey` (plus `withdrawalId @unique`) makes double payment
 * impossible even under concurrent admin clicks.
 */
export async function createWithdrawalPayment(
  db: Db,
  opts: { withdrawalId: string; partnerId: string; amount: Prisma.Decimal | string | number; actorId: string },
) {
  const entry = await createLedgerEntry(db, {
    partnerId: opts.partnerId,
    withdrawalId: opts.withdrawalId,
    type: "WITHDRAWAL",
    amount: d(opts.amount).negated(),
    status: "AVAILABLE",
    idempotencyKey: `withdrawal-pay:${opts.withdrawalId}`,
    description: "Retrait payé au partenaire",
    createdById: opts.actorId,
  });
  await recomputeWallet(db, opts.partnerId);
  return entry;
}

export const LEDGER_PAGE_SIZE = 15;

export async function listLedgerTransactions(opts: {
  partnerId?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? LEDGER_PAGE_SIZE;
  const where = opts.partnerId ? { partnerId: opts.partnerId } : {};

  const [items, total] = await Promise.all([
    prisma.financialTransaction.findMany({
      where,
      // id tie-breaker: stable total order across pages on createdAt ties.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        order: { select: { id: true, orderNumber: true } },
        withdrawal: { select: { id: true, status: true } },
        partner: { select: { id: true, displayName: true, code: true } },
      },
    }),
    prisma.financialTransaction.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type LedgerTransactionRow = Awaited<
  ReturnType<typeof listLedgerTransactions>
>["items"][number];

/**
 * Platform-wide finance overview for the admin page — every figure is a real
 * ledger aggregation (no estimates, no fabricated KPIs).
 */
export async function getFinanceOverview() {
  const [byStatus, byType, activeWithdrawals, recent] = await Promise.all([
    prisma.financialTransaction.groupBy({
      by: ["status"],
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.financialTransaction.groupBy({
      by: ["type"],
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.withdrawal.aggregate({
      where: { status: { in: ["REQUESTED", "UNDER_REVIEW", "APPROVED"] } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.financialTransaction.findMany({
      take: 12,
      orderBy: { createdAt: "desc" },
      include: {
        partner: { select: { displayName: true, code: true } },
        order: { select: { id: true, orderNumber: true } },
        withdrawal: { select: { id: true, status: true } },
      },
    }),
  ]);

  const sumFor = (list: { _sum: { amount: Prisma.Decimal | null } }[]) =>
    roundMoney(list.reduce((acc, r) => acc.plus(d(r._sum.amount ?? 0)), d(0)));

  const available = byStatus.find((s) => s.status === "AVAILABLE");
  const pending = byStatus.find((s) => s.status === "PENDING");
  const earnings = byType.find((t) => t.type === "PARTNER_EARNING");
  const withdrawals = byType.find((t) => t.type === "WITHDRAWAL");
  const returnCosts = byType.find((t) => t.type === "RETURN_COST");

  return {
    availableTotal: roundMoney(sumFor(available ? [available] : [])),
    pendingTotal: roundMoney(sumFor(pending ? [pending] : [])),
    totalEarned: roundMoney(sumFor(earnings ? [earnings] : [])),
    totalWithdrawn: roundMoney(d(sumFor(withdrawals ? [withdrawals] : [])).abs()),
    totalReturnCosts: roundMoney(d(sumFor(returnCosts ? [returnCosts] : [])).abs()),
    pendingEntries: pending?._count._all ?? 0,
    availableEntries: available?._count._all ?? 0,
    activeWithdrawalCount: activeWithdrawals._count._all,
    activeWithdrawalTotal: roundMoney(activeWithdrawals._sum.amount ?? 0),
    recent,
  };
}
