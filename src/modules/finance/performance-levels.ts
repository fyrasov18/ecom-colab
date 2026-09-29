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

export const performanceLevelSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  sharePercentage: z.coerce
    .number()
    .min(0, "Le partage ne peut pas Ãªtre nÃ©gatif")
    .max(100, "Le partage ne peut pas dÃ©passer 100 %"),
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
