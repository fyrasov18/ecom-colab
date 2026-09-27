import { describe, expect, it } from "vitest";
import {
  checkWithdrawalRequest,
  deriveWalletBalances,
  evaluateReturnCostRule,
  withdrawableAmount,
} from "@/modules/finance/rules";

/** Pure money rules — no database involved. */

const money = (value: { toFixed: (n: number) => string }) => value.toFixed(3);

describe("return cost rule (finance.return_cost_rule)", () => {
  it("REVERSE_PENDING_EARNING reverses a PENDING earning, platform absorbs delivery", () => {
    const outcome = evaluateReturnCostRule({
      rule: "REVERSE_PENDING_EARNING",
      earning: { amount: "23.400", status: "PENDING" },
      deliveryCost: "7.000",
      earningAvailableAt: new Date("2026-01-03T10:00:00.000Z"),
    });
    expect(outcome.reversal).not.toBeNull();
    expect(money(outcome.reversal!.amount)).toBe("23.400");
    expect(outcome.reversal!.status).toBe("PENDING");
    expect(outcome.reversal!.availableAt?.toISOString()).toBe(
      "2026-01-03T10:00:00.000Z",
    );
    expect(outcome.deliveryCharge).toBeNull();
  });

  it("never reverses an already AVAILABLE earning (money already belongs to the partner)", () => {
    const outcome = evaluateReturnCostRule({
      rule: "REVERSE_PENDING_EARNING",
      earning: { amount: "23.400", status: "AVAILABLE" },
      deliveryCost: "7.000",
    });
    expect(outcome.reversal).toBeNull();
    expect(outcome.deliveryCharge).toBeNull();
  });

  it("charges nothing when there is no earning (return before delivery)", () => {
    const outcome = evaluateReturnCostRule({
      rule: "REVERSE_PENDING_EARNING",
      earning: null,
      deliveryCost: "7.000",
    });
    expect(outcome.reversal).toBeNull();
    expect(outcome.deliveryCharge).toBeNull();
  });

  it("REVERSE_PLUS_DELIVERY reverses the earning AND charges the delivery cost", () => {
    const outcome = evaluateReturnCostRule({
      rule: "REVERSE_PLUS_DELIVERY",
      earning: { amount: "23.400", status: "PENDING" },
      deliveryCost: "7.000",
    });
    expect(money(outcome.reversal!.amount)).toBe("23.400");
    expect(money(outcome.deliveryCharge!)).toBe("7.000");
  });

  it("REVERSE_PLUS_DELIVERY still charges delivery with no earning, but ignores a zero cost", () => {
    const withCost = evaluateReturnCostRule({
      rule: "REVERSE_PLUS_DELIVERY",
      earning: null,
      deliveryCost: "5.000",
    });
    expect(withCost.reversal).toBeNull();
    expect(money(withCost.deliveryCharge!)).toBe("5.000");

    const zeroCost = evaluateReturnCostRule({
      rule: "REVERSE_PLUS_DELIVERY",
      earning: null,
      deliveryCost: "0.000",
    });
    expect(zeroCost.deliveryCharge).toBeNull();
  });

  it("NO_COST means the platform absorbs everything", () => {
    const outcome = evaluateReturnCostRule({
      rule: "NO_COST",
      earning: { amount: "23.400", status: "PENDING" },
      deliveryCost: "7.000",
    });
    expect(outcome.reversal).toBeNull();
    expect(outcome.deliveryCharge).toBeNull();
  });
});


describe("wallet derivation from the ledger", () => {
  it("splits AVAILABLE from PENDING and keeps them strictly apart", () => {
    const balances = deriveWalletBalances([
      { type: "PARTNER_EARNING", status: "AVAILABLE", amount: "100.000" },
      { type: "PARTNER_EARNING", status: "PENDING", amount: "50.000" },
    ]);
    expect(money(balances.availableBalance)).toBe("100.000");
    expect(money(balances.pendingBalance)).toBe("50.000");
    expect(money(balances.totalEarned)).toBe("150.000");
  });

  it("keeps a reversed pending earning as a NEGATIVE pending balance (never withdrawable)", () => {
    const balances = deriveWalletBalances([
      { type: "PARTNER_EARNING", status: "PENDING", amount: "23.400" },
      { type: "RETURN_COST", status: "PENDING", amount: "-23.400" },
    ]);
    expect(money(balances.pendingBalance)).toBe("0.000");
    expect(money(balances.availableBalance)).toBe("0.000");
    expect(money(balances.totalEarned)).toBe("23.400");
  });

  it("charges a return cost against the available balance", () => {
    const balances = deriveWalletBalances([
      { type: "PARTNER_EARNING", status: "AVAILABLE", amount: "100.000" },
      { type: "RETURN_COST", status: "AVAILABLE", amount: "-7.000" },
    ]);
    expect(money(balances.availableBalance)).toBe("93.000");
  });

  it("tracks totalWithdrawn as a positive figure and ignores pending entries", () => {
    const balances = deriveWalletBalances([
      { type: "PARTNER_EARNING", status: "AVAILABLE", amount: "500.000" },
      { type: "WITHDRAWAL", status: "AVAILABLE", amount: "-120.000" },
      { type: "PARTNER_EARNING", status: "PENDING", amount: "30.000" },
    ]);
    expect(money(balances.totalWithdrawn)).toBe("120.000");
    expect(money(balances.availableBalance)).toBe("380.000");
    expect(money(balances.pendingBalance)).toBe("30.000");
  });

  it("returns zeroes for an empty ledger", () => {
    const balances = deriveWalletBalances([]);
    expect(money(balances.availableBalance)).toBe("0.000");
    expect(money(balances.pendingBalance)).toBe("0.000");
    expect(money(balances.totalEarned)).toBe("0.000");
    expect(money(balances.totalWithdrawn)).toBe("0.000");
  });
});


describe("withdrawal guard rails", () => {
  const base = { minAmount: 100, availableBalance: "500.000" };

  it("rejects a non-positive amount", () => {
    expect(checkWithdrawalRequest({ ...base, amount: 0 }).ok).toBe(false);
  });

  it("rejects an amount below the configured minimum", () => {
    const check = checkWithdrawalRequest({ ...base, amount: 99.5 });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.error).toContain("minimum");
  });

  it("rejects when only pending earnings remain (not withdrawable)", () => {
    const check = checkWithdrawalRequest({
      amount: 200,
      availableBalance: "50.000",
      activeRequestsTotal: 0,
      minAmount: 100,
    });
    expect(check.ok).toBe(false);
  });

  it("rejects a second active request", () => {
    const check = checkWithdrawalRequest({
      ...base,
      amount: 200,
      hasActiveRequest: true,
    });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.error).toContain("déjà en cours");
  });

  it("accounts for amounts already requested but not yet paid", () => {
    const tooMuch = checkWithdrawalRequest({
      amount: 300,
      availableBalance: "500.000",
      activeRequestsTotal: "250.000",
      minAmount: 100,
    });
    expect(tooMuch.ok).toBe(false); // only 250 DT are still drawable

    const ok = checkWithdrawalRequest({
      amount: 250,
      availableBalance: "500.000",
      activeRequestsTotal: "250.000",
      minAmount: 100,
    });
    expect(ok.ok).toBe(true);
  });

  it("accepts a valid request and never lets the drawable total go negative", () => {
    expect(checkWithdrawalRequest({ ...base, amount: 100 }).ok).toBe(true);
    expect(money(withdrawableAmount("500.000", "250.000"))).toBe("250.000");
    expect(money(withdrawableAmount("10.000", "250.000"))).toBe("0.000");
  });
});
