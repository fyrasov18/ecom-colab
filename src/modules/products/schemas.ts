import { z } from "zod";

const moneyAmount = z
  .number({ message: "Montant invalide" })
  .min(0, "Doit être ≥ 0")
  .max(1_000_000, "Montant trop élevé");

export const productInputSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(160),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  purchaseCost: moneyAmount,
  packagingCost: moneyAmount,
  deliveryCost: moneyAmount,
  sellingPrice: z.number().positive("Prix de vente requis").max(1_000_000),
  stockQuantity: z.coerce.number().int("Entier requis").min(0),
  lowStockThreshold: z.coerce.number().int("Entier requis").min(0),
  status: z.enum(["ACTIVE", "INACTIVE", "OUT_OF_STOCK", "ARCHIVED"]),
  commissionType: z.enum(["PERCENTAGE", "FIXED"]).nullable(),
  commissionValue: moneyAmount.nullable(),
});

export type ProductInput = z.infer<typeof productInputSchema>;

/** Server-side guard: commission value required when a type is set. */
export const productSchema = productInputSchema
  .refine(
    (v) => (v.commissionType == null && v.commissionValue == null) || (v.commissionType != null && v.commissionValue != null),
    { message: "Type et valeur de commission doivent être définis ensemble", path: ["commissionValue"] },
  )
  .refine(
    (v) => v.commissionType !== "PERCENTAGE" || (v.commissionValue ?? 0) <= 100,
    { message: "Le pourcentage ne peut pas dépasser 100", path: ["commissionValue"] },
  );

export const productStatusSchema = z.enum(["ACTIVE", "INACTIVE", "OUT_OF_STOCK", "ARCHIVED"]);

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
}
