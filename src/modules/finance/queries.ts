import type { WithdrawalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { d, roundMoney } from "@/lib/money";
import { ACTIVE_WITHDRAWAL_STATUSES } from "./withdrawals";

/** Read models for the finance screens — always ledger-derived. */

export const WITHDRAWALS_PAGE_SIZE = 10;

export async function listWithdrawals(opts: {
  partnerId?: string;
  statuses?: WithdrawalStatus[];
  page?: number;
  pageSize?: number;
} = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? WITHDRAWALS_PAGE_SIZE;
  const where = {
    ...(opts.partnerId ? { partnerId: opts.partnerId } : {}),
    ...(opts.statuses?.length ? { status: { in: opts.statuses } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.withdrawal.findMany({
      where,
      orderBy: [{ requestedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        partner: { select: { id: true, displayName: true, code: true } },
        reviewedBy: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.withdrawal.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** One row per status — powers the review queue tabs and KPI cards. */
export async function getWithdrawalsSummary() {
  const grouped = await prisma.withdrawal.groupBy({
    by: ["status"],
    _sum: { amount: true },
    _count: { _all: true },
  });

  const byStatus = Object.fromEntries(
    grouped.map((g) => [
      g.status,
      {
        count: g._count._all,
        total: roundMoney(g._sum.amount ?? 0),
      },
    ]),
  ) as Record<WithdrawalStatus, { count: number; total: ReturnType<typeof roundMoney> } | undefined>;

  const activeTotals = ACTIVE_WITHDRAWAL_STATUSES.reduce(
    (acc, status) => {
      const row = byStatus[status];
      return {
        count: acc.count + (row?.count ?? 0),
        total: acc.total.plus(row?.total ?? 0),
      };
    },
    { count: 0, total: d(0) },
  );

  return {
    byStatus,
    activeCount: activeTotals.count,
    activeTotal: roundMoney(activeTotals.total),
    paidTotal: byStatus.PAID?.total ?? roundMoney(0),
    paidCount: byStatus.PAID?.count ?? 0,
  };
}

/**
 * Settlement queue: what is still PENDING, split between "due now" (the
 * settlement run will release it) and "scheduled" (frozen settlement dates).
 */
export async function getSettlementQueueStats(now: Date = new Date()) {
  const [due, scheduled] = await Promise.all([
    prisma.financialTransaction.aggregate({
      where: { status: "PENDING", availableAt: { lte: now } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.financialTransaction.aggregate({
      where: { status: "PENDING", availableAt: { gt: now } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  return {
    dueNowCount: due._count._all,
    dueNowTotal: roundMoney(due._sum.amount ?? 0),
    scheduledCount: scheduled._count._all,
    scheduledTotal: roundMoney(scheduled._sum.amount ?? 0),
  };
}

/** Partner "gains en attente" list with the exact release date of each gain. */
export async function listPendingEarnings(partnerId: string, take = 8) {
  const [items, next] = await Promise.all([
    prisma.financialTransaction.findMany({
      where: { partnerId, status: "PENDING" },
      orderBy: { availableAt: "asc" },
      take,
      include: { order: { select: { id: true, orderNumber: true } } },
    }),
    prisma.financialTransaction.findFirst({
      where: { partnerId, status: "PENDING", availableAt: { not: null } },
      orderBy: { availableAt: "asc" },
      select: { availableAt: true },
    }),
  ]);

  return { items, nextSettlementAt: next?.availableAt ?? null };
}

/** Finance block shown on the admin partner detail page. */
export async function getPartnerFinanceCard(
  partnerId: string,
  opts: { limit?: number } = {},
) {
  const limit = opts.limit ?? 5;

  const [wallet, transactions, withdrawals, active, returnCosts] =
    await Promise.all([
      prisma.wallet.findUnique({ where: { partnerId } }),
      prisma.financialTransaction.findMany({
        where: { partnerId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { order: { select: { id: true, orderNumber: true } } },
      }),
      prisma.withdrawal.findMany({
        where: { partnerId },
        orderBy: { requestedAt: "desc" },
        take: limit,
      }),
      prisma.withdrawal.aggregate({
        where: { partnerId, status: { in: ACTIVE_WITHDRAWAL_STATUSES } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.financialTransaction.aggregate({
        where: { partnerId, type: "RETURN_COST" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

  return {
    wallet,
    transactions,
    withdrawals,
    activeRequestCount: active._count._all,
    activeRequestTotal: roundMoney(active._sum.amount ?? 0),
    returnCostCount: returnCosts._count._all,
    returnCostTotal: roundMoney(d(returnCosts._sum.amount ?? 0).abs()),
  };
}

/** Admin list of wallets ordered by available balance (no N+1 query). */
export async function listWalletsWithPartner(pageSize = 50) {
  return prisma.wallet.findMany({
    orderBy: { availableBalance: "desc" },
    take: pageSize,
    include: {
      partner: {
        select: { id: true, displayName: true, code: true, status: true },
      },
    },
  });
}

