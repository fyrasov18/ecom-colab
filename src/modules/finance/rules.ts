import type Decimal from "decimal.js";
import { d, roundMoney } from "@/lib/money";

/**
 * Pure financial rules — enforced server-side, unit-tested.
 * Nothing here touches the database, so the money logic can never be
 * "accidentally" different from what the tests prove.
 */

export type ReturnCostRuleName =
  | "REVERSE_PENDING_EARNING"
  | "REVERSE_PLUS_DELIVERY"
  | "NO_COST";

export type EarningInfo = {
  amount: Decimal | string | number;
  status: "PENDING" | "AVAILABLE";
};

export type ReturnCostOutcome = {
  /**
   * Mirror reversal of a still-PENDING partner earning. Kept PENDING so the
   * reversed money can never appear in the partner's available balance.
   */
  reversal: { amount: Decimal; status: "PENDING"; availableAt: Date | null } | null;
  /** Immediate delivery-cost charge (AVAILABLE, negative ledger entry). */
  deliveryCharge: Decimal | null;
};

/**
 * Evaluates the return/refusal cost rule (SystemSetting finance.return_cost_rule):
 *
 * - REVERSE_PENDING_EARNING (default): mirror-reverse the partner earning IF
 *   it exists and is still PENDING; the delivery cost is absorbed by the
 *   platform. A pre-delivery return has no earning → nothing is charged.
 * - REVERSE_PLUS_DELIVERY: same reversal, plus the delivery cost is always
 *   charged to the partner (AVAILABLE immediately).
 * - NO_COST: the platform absorbs everything.
 */
export function evaluateReturnCostRule(opts: {
  rule: string;
  earning: EarningInfo | null;
  deliveryCost: Decimal | string | number;
  earningAvailableAt?: Date | null;
}): ReturnCostOutcome {
  const { rule, earning, deliveryCost } = opts;
  const outcome: ReturnCostOutcome = { reversal: null, deliveryCharge: null };
  if (rule === "NO_COST") return outcome;

  if (earning && earning.status === "PENDING") {
    outcome.reversal = {
      amount: roundMoney(d(earning.amount)),
      status: "PENDING",
      availableAt: opts.earningAvailableAt ?? null,
    };
  }

  if (rule === "REVERSE_PLUS_DELIVERY") {
    const cost = roundMoney(d(deliveryCost));
    if (cost.greaterThan(0)) outcome.deliveryCharge = cost;
  }

  return outcome;
}

/**
 * Wallet balances derived from the ledger — the ONE source of truth.
 * The Wallet table is only a cache; these values always win.
 */
export function deriveWalletBalances(
  rows: { type: string; status: string; amount: Decimal | string | number }[],
) {
  let available = d(0);
  let pending = d(0);
  let totalEarned = d(0);
  let totalWithdrawn = d(0);

  for (const row of rows) {
    const amount = d(row.amount);
    if (row.status === "AVAILABLE") available = available.plus(amount);
    else pending = pending.plus(amount);

    if (row.type === "PARTNER_EARNING") totalEarned = totalEarned.plus(amount);
    else if (row.type === "ADJUSTMENT" && amount.greaterThan(0)) {
      totalEarned = totalEarned.plus(amount);
    } else if (row.type === "WITHDRAWAL") {
      totalWithdrawn = totalWithdrawn.plus(amount.abs());
    }
  }

  return {
    availableBalance: roundMoney(available),
    pendingBalance: roundMoney(pending),
    totalEarned: roundMoney(totalEarned),
    totalWithdrawn: roundMoney(totalWithdrawn),
  };
}

/** Withdrawable amount = available balance requested for withdrawal. */
export function withdrawableAmount(
  availableBalance: Decimal | string | number,
  activeRequestsTotal: Decimal | string | number = 0,
) {
  const result = d(availableBalance).minus(d(activeRequestsTotal));
  return roundMoney(result.greaterThan(0) ? result : 0);
}

export type WithdrawalRequestCheck =
  | { ok: true }
  | { ok: false; error: string };

/** Validates a withdrawal request against the ledger-derived balances. */
export function checkWithdrawalRequest(opts: {
  amount: Decimal | string | number;
  availableBalance: Decimal | string | number;
  activeRequestsTotal?: Decimal | string | number;
  minAmount: Decimal | string | number;
  hasActiveRequest?: boolean;
}): WithdrawalRequestCheck {
  const amount = roundMoney(d(opts.amount));
  const min = d(opts.minAmount);

  if (!amount.greaterThan(0)) {
    return { ok: false, error: "Le montant doit être supérieur à zéro." };
  }
  if (opts.hasActiveRequest) {
    return {
      ok: false,
      error:
        "Une demande de retrait est déjà en cours — attendez son traitement avant d'en créer une nouvelle.",
    };
  }
  if (amount.lessThan(min)) {
    return {
      ok: false,
      error: `Le montant minimum de retrait est de ${min.toFixed(3)} DT.`,
    };
  }

  const drawable = withdrawableAmount(
    opts.availableBalance,
    opts.activeRequestsTotal ?? 0,
  );
  if (amount.greaterThan(drawable)) {
    return {
      ok: false,
      error: `Solde disponible insuffisant : ${drawable.toFixed(3)} DT retirable (les gains en attente ne sont pas retirables).`,
    };
  }
  return { ok: true };
}
