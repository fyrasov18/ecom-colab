/**
 * Performance-level validation & resolution â€” pure, no Prisma, unit-tested.
 *
 * IMPORTANT (business rule status): the levels themselves, their names and
 * their share percentages are NOT defined yet. This module therefore provides
 * the *architecture* only:
 *
 *  - Admin-configurable share percentage (0â€“100), never hard-coded.
 *  - Free-form `criteria` so progression rules can be defined later without a
 *    code change.
 *  - A resolver that reads the partner's ASSIGNED level. It never *infers* a
 *    level from metrics, because no automatic promotion rule has been agreed.
 */

import { z } from "zod";

export const performanceLevelCriteriaSchema = z.object({
  minDeliveredOrders: z.coerce.number().min(0).default(0),
  minDeliveryRate: z.coerce.number().min(0).max(100).default(0),
  minConfirmationRate: z.coerce.number().min(0).max(100).default(0),
  maxReturnRate: z.coerce.number().min(0).max(100).default(100),
  minTurnover: z.coerce.number().min(0).default(0),
  color: z.string().default("blue"), // "amber" | "emerald" | "blue" | "purple" | "rose" | "slate" | "indigo" | "bronze" | "silver" | "gold" | "teal" | "cyan" | "orange"
  icon: z.string().default("Award"), // "Award" | "Trophy" | "Star" | "Crown" | "Shield" | "TrendingUp" | "Medal" | "Zap" | "Flame" | "Sparkles" | "Gem" | "Target"
  nameEn: z.string().optional().default(""),
  nameAr: z.string().optional().default(""),
  descriptionEn: z.string().optional().default(""),
  descriptionAr: z.string().optional().default(""),
  benefits: z.array(z.string()).default([]),
});

export type PerformanceLevelCriteria = z.infer<typeof performanceLevelCriteriaSchema>;

export const performanceLevelSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  sharePercentage: z.coerce
    .number()
    .min(0, "Le partage ne peut pas être négatif")
    .max(100, "Le partage ne peut pas dépasser 100 %"),
  criteria: z.record(z.unknown()).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int("Entier requis").min(0).max(10_000),
});

export type PerformanceLevelInput = z.infer<typeof performanceLevelSchema>;

/** The share rule actually applied to one order's profit pool. */
export type ResolvedShare = {
  sharePercentage: number;
  source: "PERFORMANCE_LEVEL" | "FALLBACK";
  performanceLevelName: string | null;
  performanceLevelId: string | null;
};

export type LevelLike = {
  id: string;
  name: string;
  sharePercentage: unknown; // Decimal | string | number
  isActive: boolean;
};

/**
 * Resolve the profit share for an order.
 *
 * Precedence is explicit and conservative: a partner's assigned ACTIVE level
 * wins; otherwise the caller-supplied fallback (today: the existing commission
 * chain) is used. An INACTIVE level is ignored rather than applied, so
 * deactivating a tier immediately stops affecting new orders.
 *
 * It takes a pre-read level instead of a partnerId so this rule stays pure and
 * testable, and so the order service controls the transaction it reads in.
 */
export function resolvePerformanceShare(
  level: LevelLike | null | undefined,
  fallback: { sharePercentage: number },
): ResolvedShare {
  if (level && level.isActive) {
    const pct = Number(level.sharePercentage);
    if (Number.isFinite(pct) && pct >= 0 && pct <= 100) {
      return {
        sharePercentage: pct,
        source: "PERFORMANCE_LEVEL",
        performanceLevelName: level.name,
        performanceLevelId: level.id,
      };
    }
  }
  return {
    sharePercentage: fallback.sharePercentage,
    source: "FALLBACK",
    performanceLevelName: null,
    performanceLevelId: null,
  };
}

/** Levels ordered as a tier ladder: highest priority (sortOrder) first. */
export function orderLevelsAsLadder<T extends { sortOrder: number }>(levels: T[]): T[] {
  return [...levels].sort((a, b) => b.sortOrder - a.sortOrder);
}

/** Parse free-form JSON criteria safely with resilient defaults. */
export function parsePerformanceCriteria(raw: unknown): PerformanceLevelCriteria {
  if (!raw || typeof raw !== "object") {
    return performanceLevelCriteriaSchema.parse({});
  }
  const result = performanceLevelCriteriaSchema.safeParse(raw);
  return result.success ? result.data : performanceLevelCriteriaSchema.parse({});
}

export type PartnerMetrics = {
  totalOrders: number;
  deliveredOrders: number;
  deliveryRate: number;
  confirmationRate: number;
  returnRate: number;
  turnover: number;
};

export type CriteriaCheck = {
  met: boolean;
  current: number;
  required: number;
};

export type CriteriaEvaluation = {
  isEligible: boolean;
  metCount: number;
  totalCount: number;
  checks: {
    deliveredOrders: CriteriaCheck;
    deliveryRate: CriteriaCheck;
    confirmationRate: CriteriaCheck;
    returnRate: CriteriaCheck;
    turnover: CriteriaCheck;
  };
};

/** Evaluate whether partner metrics meet all thresholds of a performance level. */
export function evaluateLevelCriteria(
  metrics: PartnerMetrics,
  rawCriteria: unknown,
): CriteriaEvaluation {
  const criteria = parsePerformanceCriteria(rawCriteria);

  const deliveredOrdersMet = metrics.deliveredOrders >= (criteria.minDeliveredOrders ?? 0);
  const deliveryRateMet = metrics.deliveryRate >= (criteria.minDeliveryRate ?? 0);
  const confirmationRateMet = metrics.confirmationRate >= (criteria.minConfirmationRate ?? 0);
  const returnRateMet = metrics.returnRate <= (criteria.maxReturnRate ?? 100);
  const turnoverMet = metrics.turnover >= (criteria.minTurnover ?? 0);

  const checks = {
    deliveredOrders: {
      met: deliveredOrdersMet,
      current: metrics.deliveredOrders,
      required: criteria.minDeliveredOrders ?? 0,
    },
    deliveryRate: {
      met: deliveryRateMet,
      current: metrics.deliveryRate,
      required: criteria.minDeliveryRate ?? 0,
    },
    confirmationRate: {
      met: confirmationRateMet,
      current: metrics.confirmationRate,
      required: criteria.minConfirmationRate ?? 0,
    },
    returnRate: {
      met: returnRateMet,
      current: metrics.returnRate,
      required: criteria.maxReturnRate ?? 100,
    },
    turnover: {
      met: turnoverMet,
      current: metrics.turnover,
      required: criteria.minTurnover ?? 0,
    },
  };

  const metCount = [
    deliveredOrdersMet,
    deliveryRateMet,
    confirmationRateMet,
    returnRateMet,
    turnoverMet,
  ].filter(Boolean).length;

  return {
    isEligible: metCount === 5,
    metCount,
    totalCount: 5,
    checks,
  };
}

/**
 * Composite performance score on a 0–100 scale:
 * - Delivery rate: up to 40 pts
 * - Confirmation rate: up to 30 pts
 * - Order volume (scaled to 50 delivered orders): up to 20 pts
 * - Return penalty: up to 10 pts
 */
export function calculatePerformanceScore(metrics: PartnerMetrics): number {
  const deliveryPts = (Math.min(100, Math.max(0, metrics.deliveryRate)) / 100) * 40;
  const confPts = (Math.min(100, Math.max(0, metrics.confirmationRate)) / 100) * 30;
  const volumePts = Math.min(20, (metrics.deliveredOrders / 50) * 20);
  const returnPenalty = (Math.min(100, Math.max(0, metrics.returnRate)) / 100) * 10;
  const returnPts = Math.max(0, 10 - returnPenalty);

  return Math.round(deliveryPts + confPts + volumePts + returnPts);
}

/** Get localized level name from criteria or base name */
export function getLocalizedLevelName(
  level: { name: string; criteria?: unknown },
  locale: string,
): string {
  const criteria = parsePerformanceCriteria(level.criteria);
  if (locale === "ar" && criteria.nameAr?.trim()) {
    return criteria.nameAr.trim();
  }
  if (locale === "en" && criteria.nameEn?.trim()) {
    return criteria.nameEn.trim();
  }
  return level.name;
}

/** Get localized level description from criteria or base description */
export function getLocalizedLevelDescription(
  level: { description?: string | null; criteria?: unknown },
  locale: string,
): string {
  const criteria = parsePerformanceCriteria(level.criteria);
  if (locale === "ar" && criteria.descriptionAr?.trim()) {
    return criteria.descriptionAr.trim();
  }
  if (locale === "en" && criteria.descriptionEn?.trim()) {
    return criteria.descriptionEn.trim();
  }
  return level.description || "";
}

export type ProgressionValidationWarning = {
  levelId: string;
  levelName: string;
  message: string;
};

/**
 * Validate that level ordering and progression criteria remain logically sound
 * and free of duplicate ranks or contradictory thresholds.
 */
export function validateProgressionRules(
  levels: Array<{
    id: string;
    name: string;
    sortOrder: number;
    sharePercentage: number;
    criteria?: unknown;
  }>,
): { isValid: boolean; duplicateSortOrders: number[]; warnings: ProgressionValidationWarning[] } {
  const sortOrderMap = new Map<number, string[]>();
  for (const lvl of levels) {
    const list = sortOrderMap.get(lvl.sortOrder) || [];
    list.push(lvl.name);
    sortOrderMap.set(lvl.sortOrder, list);
  }

  const duplicateSortOrders: number[] = [];
  for (const [order, list] of sortOrderMap.entries()) {
    if (list.length > 1) duplicateSortOrders.push(order);
  }

  // Ladder check: ascending by sortOrder (rank 1 -> rank N)
  const sorted = [...levels].sort((a, b) => a.sortOrder - b.sortOrder);
  const warnings: ProgressionValidationWarning[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevCrit = parsePerformanceCriteria(prev.criteria);
    const currCrit = parsePerformanceCriteria(curr.criteria);

    // Advisory: If current higher rank has lower commission share than previous rank
    if (curr.sharePercentage < prev.sharePercentage) {
      warnings.push({
        levelId: curr.id,
        levelName: curr.name,
        message: `Le niveau supérieur « ${curr.name} » (${curr.sharePercentage}%) a un partage de profit inférieur au niveau « ${prev.name} » (${prev.sharePercentage}%).`,
      });
    }

    // Advisory: If current higher rank requires fewer delivered orders than previous rank
    if ((currCrit.minDeliveredOrders ?? 0) < (prevCrit.minDeliveredOrders ?? 0)) {
      warnings.push({
        levelId: curr.id,
        levelName: curr.name,
        message: `Le niveau supérieur « ${curr.name} » requiert moins de commandes livrées (${currCrit.minDeliveredOrders}) que le niveau inférieur « ${prev.name} » (${prevCrit.minDeliveredOrders}).`,
      });
    }
  }

  return {
    isValid: duplicateSortOrders.length === 0,
    duplicateSortOrders,
    warnings,
  };
}
