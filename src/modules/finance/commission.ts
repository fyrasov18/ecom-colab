import Decimal from "decimal.js";
import { d, roundMoney } from "@/lib/money";
import type { CommissionSource, CommissionType } from "@prisma/client";

/**
 * Commission resolution — single source of truth for partner share rules.
 * Precedence: PartnerProduct override > Partner default > Product default > Global.
 * Never hard-code a percentage anywhere else in the codebase.
 */
export type CommissionRule = {
  type: CommissionType;
  value: Decimal;
  source: CommissionSource;
};

type MaybeRule = {
  commissionType: CommissionType | null;
  commissionValue: Decimal | null;
} | null | undefined;

export function resolveCommission(input: {
  partnerProduct?: MaybeRule;
  partner?: MaybeRule;
  product?: MaybeRule;
  global: { commissionType: CommissionType; commissionValue: Decimal | number | string };
}): CommissionRule {
  const { partnerProduct, partner, product, global } = input;

  if (partnerProduct?.commissionType && partnerProduct.commissionValue != null) {
    return {
      type: partnerProduct.commissionType,
      value: d(partnerProduct.commissionValue),
      source: "PARTNER_PRODUCT",
    };
  }
  if (partner?.commissionType && partner.commissionValue != null) {
    return { type: partner.commissionType, value: d(partner.commissionValue), source: "PARTNER" };
  }
  if (product?.commissionType && product.commissionValue != null) {
    return { type: product.commissionType, value: d(product.commissionValue), source: "PRODUCT" };
  }
  return {
    type: global.commissionType,
    value: d(global.commissionValue),
    source: "GLOBAL",
  };
}

/**
 * Partner earning from an order contribution.
 * - PERCENTAGE: contribution × value/100 (value clamped 0–100 by validation).
 * - FIXED: flat amount per order, capped at the contribution (the platform
 *   never pays out more than the order generates).
 * platformShare = contribution − earning (exact, no drift).
 */
export function computePartnerEarning(
  contribution: Decimal | number | string,
  rule: CommissionRule,
): { earning: Decimal; platformShare: Decimal } {
  const c = roundMoney(contribution);
  let earning: Decimal;
  if (rule.type === "PERCENTAGE") {
    const pct = Decimal.min(d(rule.value), 100);
    earning = c.times(pct).dividedBy(100);
  } else {
    earning = Decimal.min(c, d(rule.value));
  }
  earning = roundMoney(earning);
  const platformShare = roundMoney(c.minus(earning));
  return { earning, platformShare };
}
