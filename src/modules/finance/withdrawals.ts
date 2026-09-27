import { Prisma } from "@prisma/client";
import type { PrismaClient, Role, WithdrawalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { d, roundMoney } from "@/lib/money";
import { isAdminRole } from "@/lib/roles";
import { recordAudit } from "@/modules/audit/service";
import { notifyBackOffice, notifyPartnerAccount } from "@/modules/notifications/service";
import { getMinWithdrawalAmount } from "@/modules/settings/service";
import { createWithdrawalPayment, recomputeWallet } from "./ledger";
import { checkWithdrawalRequest } from "./rules";

type Db = PrismaClient | Prisma.TransactionClient;

export class WithdrawalError extends Error {}

/**
 * A partner may only have ONE active request at a time. No funds are locked
 * when requesting: the wallet only moves on PAID (approved business decision),
 * so over-requesting is prevented by this single-active-request rule combined
 * with the available-balance check.
 */
export const ACTIVE_WITHDRAWAL_STATUSES: WithdrawalStatus[] = [
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
];

const REVIEW_STATUSES: WithdrawalStatus[] = ["REQUESTED", "UNDER_REVIEW"];

function assertOperator(role: Role) {
  if (!isAdminRole(role)) {
    throw new WithdrawalError("Action réservée à l'opérateur.");
  }
}

/** Ledger-derived wallet + what is actually drawable right now. */
export async function getWithdrawableSummary(
  partnerId: string,
  db: Db = prisma,
) {
  const wallet = await recomputeWallet(db, partnerId);
  const active = await db.withdrawal.aggregate({
    where: { partnerId, status: { in: ACTIVE_WITHDRAWAL_STATUSES } },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const minAmount = await getMinWithdrawalAmount(db);
  const activeRequestsTotal = roundMoney(active._sum.amount ?? 0);
  const drawable = roundMoney(
    d(wallet.availableBalance).minus(activeRequestsTotal),
  );

  return {
    wallet,
    activeRequestsTotal,
    activeRequestCount: active._count._all,
    hasActiveRequest: active._count._all > 0,
    minAmount: d(minAmount),
    drawable: drawable.greaterThan(0) ? drawable : d(0),
  };
}

/**
 * Partner request: REQUESTED. Validated against the ledger (never against a
 * client-provided number) — minimum amount, available balance, one active
 * request max.
 */
export async function requestWithdrawal(opts: {
  partnerId: string;
  amount: number | string | Prisma.Decimal;
  paymentMethod: string;
  paymentAccount: string;
  actorId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const partner = await tx.partner.findUnique({
      where: { id: opts.partnerId },
      select: { id: true, status: true, code: true },
    });
    if (!partner) throw new WithdrawalError("Partenaire introuvable.");
    if (partner.status !== "ACTIVE") {
      throw new WithdrawalError(
        "Votre compte partenaire n'est pas actif — contactez l'opérateur.",
      );
    }

    const summary = await getWithdrawableSummary(opts.partnerId, tx);
    const check = checkWithdrawalRequest({
      amount: opts.amount,
      availableBalance: summary.wallet.availableBalance,
      activeRequestsTotal: summary.activeRequestsTotal,
      minAmount: summary.minAmount,
      hasActiveRequest: summary.hasActiveRequest,
    });
    if (!check.ok) throw new WithdrawalError(check.error);

    const amount = roundMoney(d(opts.amount));
    const withdrawal = await tx.withdrawal.create({
      data: {
        partnerId: opts.partnerId,
        amount: new Prisma.Decimal(amount.toFixed(3)),
        paymentMethod: opts.paymentMethod,
        paymentAccount: opts.paymentAccount,
        status: "REQUESTED",
      },
    });

    await recordAudit(tx, {
      actorId: opts.actorId,
      action: "WITHDRAWAL_REQUESTED",
      entityType: "Withdrawal",
      entityId: withdrawal.id,
      after: {
        partnerCode: partner.code,
        amount: amount.toFixed(3),
        paymentMethod: opts.paymentMethod,
        availableBalance: summary.wallet.availableBalance.toFixed(3),
      },
    });

    // Phase 7: the back office is the audience for a new request; the partner
    // never needs to be told about their own submission.
    await notifyBackOffice(tx, {
      type: "WITHDRAWAL",
      title: `Demande de retrait — ${partner.code}`,
      body: `Retrait de ${amount.toFixed(3)} DT demandé via ${opts.paymentMethod}.`,
      link: "/finance",
    });

    return withdrawal;
  });
}

async function loadForReview(
  tx: Prisma.TransactionClient,
  withdrawalId: string,
  allowed: WithdrawalStatus[],
) {
  const withdrawal = await tx.withdrawal.findUnique({
    where: { id: withdrawalId },
    select: {
      id: true,
      partnerId: true,
      amount: true,
      status: true,
      paymentMethod: true,
      paymentAccount: true,
    },
  });
  if (!withdrawal) throw new WithdrawalError("Demande de retrait introuvable.");
  if (!allowed.includes(withdrawal.status)) {
    throw new WithdrawalError(
      `Transition impossible depuis le statut ${withdrawal.status}.`,
    );
  }
  return withdrawal;
}

/** OPERATOR: REQUESTED → UNDER_REVIEW (compliance check in progress). */
export async function markWithdrawalUnderReview(opts: {
  withdrawalId: string;
  actorId: string;
  role: Role;
}) {
  assertOperator(opts.role);
  return prisma.$transaction(async (tx) => {
    const withdrawal = await loadForReview(tx, opts.withdrawalId, ["REQUESTED"]);
    const updated = await tx.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: "UNDER_REVIEW",
        reviewedById: opts.actorId,
        reviewedAt: new Date(),
      },
    });
    await recordAudit(tx, {
      actorId: opts.actorId,
      action: "WITHDRAWAL_UNDER_REVIEW",
      entityType: "Withdrawal",
      entityId: withdrawal.id,
      before: { status: withdrawal.status },
      after: { status: "UNDER_REVIEW", amount: withdrawal.amount.toFixed(3) },
    });
    return updated;
  });
}

/** OPERATOR: REQUESTED|UNDER_REVIEW → APPROVED (no money movement yet). */
export async function approveWithdrawal(opts: {
  withdrawalId: string;
  actorId: string;
  role: Role;
}) {
  assertOperator(opts.role);
  return prisma.$transaction(async (tx) => {
    const withdrawal = await loadForReview(
      tx,
      opts.withdrawalId,
      REVIEW_STATUSES,
    );
    const updated = await tx.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: "APPROVED",
        reviewedById: opts.actorId,
        reviewedAt: new Date(),
      },
    });
    await recordAudit(tx, {
      actorId: opts.actorId,
      action: "WITHDRAWAL_APPROVED",
      entityType: "Withdrawal",
      entityId: withdrawal.id,
      before: { status: withdrawal.status },
      after: { status: "APPROVED", amount: withdrawal.amount.toFixed(3) },
    });
    await notifyPartnerAccount(tx, withdrawal.partnerId, {
      type: "WITHDRAWAL",
      title: "Retrait approuvé",
      body: `Votre demande de ${withdrawal.amount.toFixed(3)} DT est approuvée et en attente de paiement.`,
      link: "/portefeuille",
    });
    return updated;
  });
}

/**
 * OPERATOR: → REJECTED (reason mandatory). No ledger entry is created or
 * removed: nothing was locked at request time, so the balance simply stays
 * available for a future request.
 */
export async function rejectWithdrawal(opts: {
  withdrawalId: string;
  actorId: string;
  role: Role;
  reason: string;
}) {
  assertOperator(opts.role);
  return prisma.$transaction(async (tx) => {
    const withdrawal = await loadForReview(tx, opts.withdrawalId, [
      ...REVIEW_STATUSES,
      "APPROVED",
    ]);
    const updated = await tx.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: "REJECTED",
        reviewedById: opts.actorId,
        reviewedAt: new Date(),
        rejectionReason: opts.reason,
      },
    });
    await recordAudit(tx, {
      actorId: opts.actorId,
      action: "WITHDRAWAL_REJECTED",
      entityType: "Withdrawal",
      entityId: withdrawal.id,
      before: { status: withdrawal.status },
      after: {
        status: "REJECTED",
        amount: withdrawal.amount.toFixed(3),
        reason: opts.reason,
      },
    });
    await notifyPartnerAccount(tx, withdrawal.partnerId, {
      type: "WITHDRAWAL",
      title: "Retrait rejeté",
      body: `Votre demande de ${withdrawal.amount.toFixed(3)} DT a été rejetée. Motif : ${opts.reason}`,
      link: "/portefeuille",
    });
    return updated;
  });
}

/**
 * OPERATOR: APPROVED → PAID. This is the ONLY point where the ledger moves
 * (negative WITHDRAWAL entry + wallet recompute), and the entry is idempotent,
 * so a retry can never double-charge a partner.
 */
export async function payWithdrawal(opts: {
  withdrawalId: string;
  actorId: string;
  role: Role;
  transactionReference: string;
}) {
  assertOperator(opts.role);
  return prisma.$transaction(async (tx) => {
    const withdrawal = await loadForReview(tx, opts.withdrawalId, ["APPROVED"]);

    await createWithdrawalPayment(tx, {
      withdrawalId: withdrawal.id,
      partnerId: withdrawal.partnerId,
      amount: withdrawal.amount,
      actorId: opts.actorId,
    });

    const updated = await tx.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        transactionReference: opts.transactionReference,
        reviewedById: opts.actorId,
      },
    });

    await recordAudit(tx, {
      actorId: opts.actorId,
      action: "WITHDRAWAL_PAID",
      entityType: "Withdrawal",
      entityId: withdrawal.id,
      before: { status: withdrawal.status },
      after: {
        status: "PAID",
        amount: withdrawal.amount.toFixed(3),
        transactionReference: opts.transactionReference,
      },
    });
    await notifyPartnerAccount(tx, withdrawal.partnerId, {
      type: "WITHDRAWAL",
      title: "Retrait payé",
      body: `Le retrait de ${withdrawal.amount.toFixed(3)} DT a été viré (réf. ${opts.transactionReference}).`,
      link: "/portefeuille",
    });
    return updated;
  });
}
