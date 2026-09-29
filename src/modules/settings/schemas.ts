import { z } from "zod";
import { SETTING_KEYS } from "./defaults";

/** Fallback commission applied when no more specific rule exists. */
export type GlobalCommission = {
  commissionType: "PERCENTAGE" | "FIXED";
  commissionValue: number;
};

/**
 * Validation for every writable setting key. Deliberately free of Prisma
 * imports so the accepted values can be unit-tested without a database.
 */
export const SETTING_VALUE_SCHEMAS: Record<string, z.ZodTypeAny> = {
  [SETTING_KEYS.SETTLEMENT_PERIOD_HOURS]: z
    .number()
    .int("Doit être un entier")
    .min(1, "Minimum 1 heure")
    .max(720, "Maximum 720 heures (30 jours)"),
  [SETTING_KEYS.MIN_WITHDRAWAL_AMOUNT]: z
    .number()
    .positive("Doit être positif")
    .max(1_000_000),
  [SETTING_KEYS.RETURN_COST_RULE]: z.enum([
    "REVERSE_PENDING_EARNING",
    "REVERSE_PLUS_DELIVERY",
    "NO_COST",
  ]),
  [SETTING_KEYS.GLOBAL_COMMISSION]: z
    .object({
      commissionType: z.enum(["PERCENTAGE", "FIXED"]),
      commissionValue: z.number().positive("Doit être positif"),
    })
    .superRefine((value, ctx) => {
      // A percentage is capped at 100; a fixed amount is capped at a sane
      // ceiling so a typo can never wipe out a partner's earning model.
      const max = value.commissionType === "PERCENTAGE" ? 100 : 1_000_000;
      if (value.commissionValue > max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            value.commissionType === "PERCENTAGE"
              ? "Un pourcentage ne peut pas dépasser 100 %"
              : "Montant trop élevé",
        });
      }
    }),
};
