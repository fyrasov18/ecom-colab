/**
 * Low-stock alerting rules for the back office.
 *
 * NOTE: product status labels/tones intentionally do NOT live here — they are
 * owned by `app/(admin)/produits/page.tsx` (STATUS_LABEL / STATUS_BADGE).
 * This module only holds the pure *alerting rules*, which have no UI concern.
 */

/**
 * Should this stock/threshold change raise a low-stock alert?
 *
 * Alerting on the *transition* into the low zone (and not on every order while
 * the product sits below its threshold) is what keeps the back office from
 * being flooded: a product at 2 units with a threshold of 5 alerts once, when
 * it drops from 6 to 2 — and stays quiet until it is restocked above 5.
 *
 * Comparing both before/after pairs (not just the quantities) also covers the
 * case where the stock is untouched but the threshold is *raised* above it.
 */
export function shouldAlertLowStock(input: {
  stockBefore: number;
  stockAfter: number;
  thresholdBefore: number;
  thresholdAfter: number;
}): boolean {
  const wasLow = input.stockBefore <= input.thresholdBefore;
  const isLow = input.stockAfter <= input.thresholdAfter;
  return !wasLow && isLow;
}

/** Convenience wrapper for movements where the threshold is unchanged. */
export function crossedLowStock(
  before: number,
  after: number,
  threshold: number,
): boolean {
  return shouldAlertLowStock({
    stockBefore: before,
    stockAfter: after,
    thresholdBefore: threshold,
    thresholdAfter: threshold,
  });
}

/** Back-office alert copy for a low-stock crossing. */
export function buildLowStockBody(
  productName: string,
  remaining: number,
  threshold: number,
): string {
  return remaining <= 0
    ? `${productName} est en rupture de stock (seuil : ${threshold}).`
    : `${productName} descend à ${remaining} unité(s) restante(s) (seuil : ${threshold}).`;
}
