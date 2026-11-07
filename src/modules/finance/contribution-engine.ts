import Decimal from "decimal.js";
import { d, roundMoney, round2 } from "@/lib/money";
import type { CommissionSource, CommissionType, Prisma, PrismaClient } from "@prisma/client";
import { getSetting } from "@/modules/settings/service";
import { SETTING_KEYS } from "@/modules/settings/defaults";

export type DbClient = PrismaClient | Prisma.TransactionClient;

export type ContributionRateRule = {
  type: CommissionType;
  rate: Decimal;
  source: CommissionSource;
  performanceLevelId: string | null;
  performanceLevelName: string | null;
};

export type LevelInput = {
  id: string;
  name: string;
  sharePercentage: Decimal | number | string;
  isActive: boolean;
} | null | undefined;

export type RuleInput = {
  commissionType?: CommissionType | null;
  commissionValue?: Decimal | number | string | null;
} | null | undefined;

/**
 * 4-tier hierarchy for contribution percentage:
 * 1. Partner + Product Override (PARTNER_PRODUCT)
 * 2. Partner Admin Override (PARTNER)
 * 3. Assigned active Performance Level (PERFORMANCE_LEVEL)
 * 4. Global Default (GLOBAL, initial 30%)
 *
 * Explicit 0% is valid and not treated as missing.
 * Product-level commission is excluded.
 */
export function resolveContributionRate(input: {
  partnerProduct?: RuleInput;
  partner?: RuleInput;
  performanceLevel?: LevelInput;
  global?: { commissionType?: CommissionType; commissionValue?: Decimal | number | string };
}): ContributionRateRule {
  const { partnerProduct, partner, performanceLevel, global } = input;

  // Tier 1: Partner + Product Override
  if (
    partnerProduct &&
    partnerProduct.commissionValue !== null &&
    partnerProduct.commissionValue !== undefined
  ) {
    return {
      type: partnerProduct.commissionType ?? "PERCENTAGE",
      rate: d(partnerProduct.commissionValue),
      source: "PARTNER_PRODUCT",
      performanceLevelId: null,
      performanceLevelName: null,
    };
  }

  // Tier 2: Partner Admin Override
  if (
    partner &&
    partner.commissionValue !== null &&
    partner.commissionValue !== undefined
  ) {
    return {
      type: partner.commissionType ?? "PERCENTAGE",
      rate: d(partner.commissionValue),
      source: "PARTNER",
      performanceLevelId: null,
      performanceLevelName: null,
    };
  }

  // Tier 3: Assigned active Performance Level
  if (performanceLevel && performanceLevel.isActive) {
    const pct = d(performanceLevel.sharePercentage);
    if (!pct.isNaN() && pct.gte(0) && pct.lte(100)) {
      return {
        type: "PERCENTAGE",
        rate: pct,
        source: "PERFORMANCE_LEVEL",
        performanceLevelId: performanceLevel.id,
        performanceLevelName: performanceLevel.name,
      };
    }
  }

  // Tier 4: Global Default
  const globalType = global?.commissionType ?? "PERCENTAGE";
  const globalValue = global?.commissionValue != null ? d(global.commissionValue) : d(30);

  return {
    type: globalType,
    rate: globalValue,
    source: "GLOBAL",
    performanceLevelId: null,
    performanceLevelName: null,
  };
}

export type FinancialSnapshot = {
  version: 1;
  calculatedAt: string;
  unitSellingPrice: string;
  quantity: number;
  unitPurchaseCost: string;
  unitPackagingCost: string;
  orderDeliveryCost: string;
  discount: string;
  revenue: string;
  netRevenue: string;
  productCost: string;
  packagingCost: string;
  deliveryCost: string;
  totalCosts: string;
  contribution: string;
  minContributionThreshold: string;
  isEligible: boolean;
  ratePercentage: string;
  commissionType: CommissionType;
  commissionSource: CommissionSource;
  performanceLevelId: string | null;
  performanceLevelName: string | null;
  partnerEarning: string;
  platformShare: string;
};

export type ContributionCalculationResult = {
  unitSellingPrice: Decimal;
  quantity: number;
  purchaseCost: Decimal;
  packagingCost: Decimal;
  deliveryCost: Decimal;
  discount: Decimal;
  revenue: Decimal;
  netRevenue: Decimal;
  productCost: Decimal;
  packagingCostTotal: Decimal;
  deliveryCostTotal: Decimal;
  totalCosts: Decimal;
  contribution: Decimal;
  minContributionThreshold: Decimal;
  isEligible: boolean;
  rate: Decimal;
  commissionType: CommissionType;
  commissionSource: CommissionSource;
  performanceLevelId: string | null;
  performanceLevelName: string | null;
  partnerEarning: Decimal;
  platformShare: Decimal;
  snapshot: FinancialSnapshot;
};

/**
 * Pure calculation of Order Contribution and Partner / Platform split.
 * Formula:
 *   Net Revenue = (Selling Price × Q) − Discounts
 *   Costs = (PurchaseCost × Q) + (PackagingCost × Q) + DeliveryCost (flat)
 *   Contribution = Net Revenue − Costs
 *
 * Eligibility rule:
 *   Round(Contribution, 2) > minContributionThreshold (e.g. 7.00 DT)
 *   Exactly 7.00 DT is BLOCKED, 7.01 DT is ALLOWED.
 */
export function calculateOrderContribution(params: {
  sellingPrice: Decimal | number | string;
  quantity: number;
  purchaseCost: Decimal | number | string;
  packagingCost: Decimal | number | string;
  deliveryCost: Decimal | number | string;
  discount?: Decimal | number | string;
  minContributionThreshold: Decimal | number | string;
  rateRule: ContributionRateRule;
}): ContributionCalculationResult {
  const {
    sellingPrice,
    quantity,
    purchaseCost,
    packagingCost,
    deliveryCost,
    discount = 0,
    minContributionThreshold,
    rateRule,
  } = params;

  if (quantity < 1) {
    throw new Error("Quantity must be at least 1");
  }

  const q = quantity;
  const unitSellingPrice = roundMoney(d(sellingPrice));
  const unitPurchaseCost = roundMoney(d(purchaseCost));
  const unitPackagingCost = roundMoney(d(packagingCost));
  const orderDeliveryCost = roundMoney(d(deliveryCost));
  const discountVal = roundMoney(d(discount));

  const revenue = roundMoney(unitSellingPrice.times(q));
  const netRevenue = roundMoney(revenue.minus(discountVal));
  const productCost = roundMoney(unitPurchaseCost.times(q));
  const packagingCostTotal = roundMoney(unitPackagingCost.times(q));
  const deliveryCostTotal = orderDeliveryCost; // Delivery is flat per order
  const totalCosts = roundMoney(productCost.plus(packagingCostTotal).plus(deliveryCostTotal));

  const contribution = round2(netRevenue.minus(totalCosts));
  const minThreshold = round2(d(minContributionThreshold));

  // Eligibility requirement: strictly greater than minContributionThreshold
  // 7.000 > 7.000 is FALSE -> blocked!
  // 7.010 > 7.000 is TRUE -> allowed!
  const isEligible = contribution.gt(minThreshold);

  let partnerEarning: Decimal;
  if (rateRule.type === "PERCENTAGE") {
    const clampedRate = Decimal.max(0, Decimal.min(100, rateRule.rate));
    partnerEarning = round2(contribution.times(clampedRate).dividedBy(100));
  } else {
    // FIXED commission: capped at contribution, rounded to 2 decimal places
    partnerEarning = round2(Decimal.max(0, Decimal.min(contribution, rateRule.rate)));
  }

  // Exact conservation: platformShare = contribution - partnerEarning
  const platformShare = round2(contribution.minus(partnerEarning));

  const snapshot: FinancialSnapshot = {
    version: 1,
    calculatedAt: new Date().toISOString(),
    unitSellingPrice: unitSellingPrice.toFixed(3),
    quantity: q,
    unitPurchaseCost: unitPurchaseCost.toFixed(3),
    unitPackagingCost: unitPackagingCost.toFixed(3),
    orderDeliveryCost: orderDeliveryCost.toFixed(3),
    discount: discountVal.toFixed(3),
    revenue: revenue.toFixed(3),
    netRevenue: netRevenue.toFixed(3),
    productCost: productCost.toFixed(3),
    packagingCost: packagingCostTotal.toFixed(3),
    deliveryCost: deliveryCostTotal.toFixed(3),
    totalCosts: totalCosts.toFixed(3),
    contribution: contribution.toFixed(2),
    minContributionThreshold: minThreshold.toFixed(2),
    isEligible,
    ratePercentage: rateRule.rate.toFixed(2),
    commissionType: rateRule.type,
    commissionSource: rateRule.source,
    performanceLevelId: rateRule.performanceLevelId,
    performanceLevelName: rateRule.performanceLevelName,
    partnerEarning: partnerEarning.toFixed(2),
    platformShare: platformShare.toFixed(2),
  };

  return {
    unitSellingPrice,
    quantity: q,
    purchaseCost: unitPurchaseCost,
    packagingCost: unitPackagingCost,
    deliveryCost: orderDeliveryCost,
    discount: discountVal,
    revenue,
    netRevenue,
    productCost,
    packagingCostTotal,
    deliveryCostTotal,
    totalCosts,
    contribution,
    minContributionThreshold: minThreshold,
    isEligible,
    rate: rateRule.rate,
    commissionType: rateRule.type,
    commissionSource: rateRule.source,
    performanceLevelId: rateRule.performanceLevelId,
    performanceLevelName: rateRule.performanceLevelName,
    partnerEarning,
    platformShare,
    snapshot,
  };
}

/**
 * Verify whether a preview snapshot is identical to the fresh calculation at confirmation.
 */
export function verifyConfirmationIntegrity(
  preview: FinancialSnapshot,
  current: FinancialSnapshot,
): { isIdentical: boolean; differences: string[] } {
  const differences: string[] = [];

  const checks: (keyof FinancialSnapshot)[] = [
    "unitSellingPrice",
    "quantity",
    "unitPurchaseCost",
    "unitPackagingCost",
    "orderDeliveryCost",
    "discount",
    "revenue",
    "netRevenue",
    "productCost",
    "packagingCost",
    "deliveryCost",
    "totalCosts",
    "contribution",
    "minContributionThreshold",
    "isEligible",
    "ratePercentage",
    "commissionType",
    "commissionSource",
    "performanceLevelId",
    "performanceLevelName",
    "partnerEarning",
    "platformShare",
  ];

  for (const field of checks) {
    const previewVal = preview[field] ?? null;
    const currentVal = current[field] ?? null;

    if (previewVal !== currentVal && String(previewVal) !== String(currentVal)) {
      differences.push(
        `${field}: aperçu=${String(previewVal)}, actuel=${String(currentVal)}`,
      );
    }
  }

  return {
    isIdentical: differences.length === 0,
    differences,
  };
}

/**
 * Database-backed helper to calculate contribution using authoritative values.
 */
export async function fetchAndCalculateOrderContribution(
  db: DbClient,
  params: {
    partnerId: string;
    productId: string;
    quantity: number;
    discount?: Decimal | number | string;
  },
): Promise<ContributionCalculationResult> {
  const { partnerId, productId, quantity, discount = 0 } = params;

  // 1. Fetch assignment, product, partner with performance level
  const assignment = await db.partnerProduct.findUnique({
    where: { partnerId_productId: { partnerId, productId } },
    include: {
      product: true,
      partner: {
        include: {
          performanceLevel: true,
        },
      },
    },
  });

  if (!assignment) {
    throw new Error("Produit non assigné à ce partenaire.");
  }

  const product = assignment.product;
  const partner = assignment.partner;

  // 2. Fetch authoritative settings
  const globalCommission = await getSetting<{
    commissionType: CommissionType;
    commissionValue: number;
  }>(SETTING_KEYS.GLOBAL_COMMISSION, db);

  const minContribution = await getSetting<number>(
    SETTING_KEYS.MIN_ORDER_CONTRIBUTION,
    db,
  );

  // 3. Resolve rate following the 4-tier hierarchy
  const rateRule = resolveContributionRate({
    partnerProduct: {
      commissionType: assignment.commissionType,
      commissionValue: assignment.commissionValue,
    },
    partner: {
      commissionType: partner.defaultCommissionType,
      commissionValue: partner.defaultCommissionValue,
    },
    performanceLevel: partner.performanceLevel,
    global: globalCommission,
  });

  // 4. Calculate contribution
  return calculateOrderContribution({
    sellingPrice: product.sellingPrice,
    quantity,
    purchaseCost: product.purchaseCost,
    packagingCost: product.packagingCost,
    deliveryCost: product.deliveryCost,
    discount,
    minContributionThreshold: minContribution,
    rateRule,
  });
}
