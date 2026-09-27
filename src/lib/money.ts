import Decimal from "decimal.js";

/**
 * Money utilities. All monetary math goes through decimal.js — never floats.
 * Currency: TND (DT), 3 decimals (millimes).
 */
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const MONEY_PLACES = 3;

export function d(value: string | number | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/** Round a monetary amount to 3 decimal places (millimes). */
export function roundMoney(value: string | number | Decimal): Decimal {
  return d(value).toDecimalPlaces(MONEY_PLACES, Decimal.ROUND_HALF_UP);
}

/** Format for display: "13,200 DT" style with fr-TN conventions. */
export function formatMoney(
  value: string | number | Decimal,
  opts: { currency?: string; showCurrency?: boolean } = {},
): string {
  const { currency = "DT", showCurrency = true } = opts;
  const n = d(value);
  const formatted = n.toDecimalPlaces(MONEY_PLACES).toFixed(MONEY_PLACES);
  return showCurrency ? `${formatted} ${currency}` : formatted;
}

/** Format a user-facing price with trimmed decimals: 12.500 → "12,500", 12.000 → "12". */
export function formatPrice(value: string | number | Decimal): string {
  const n = roundMoney(value);
  const str = n.toFixed(MONEY_PLACES);
  return str.replace(/\.?0+$/, "").replace(".", ",");
}
