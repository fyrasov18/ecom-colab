import { z } from "zod";
import { GOVERNORATES } from "./labels";

/**
 * Tunisian phone:8 digits (+ optional +216). Normalized to8 digits —
 * used as the strong dedup key per partner.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 11 && digits.startsWith("216")) return digits.slice(3);
  if (digits.length === 13 && digits.startsWith("00216")) return digits.slice(5);
  return digits;
}

const phoneSchema = z
  .string()
  .trim()
  .transform(normalizePhone)
  .refine((v) => /^\d{8}$/.test(v), {
    message: "Numéro tunisien invalide (8 chiffres).",
  });

export const CONFIRMATION_TEXT =
  "Je confirme que le client a accepté la commande et les conditions de livraison.";

export const createOrderSchema = z.object({
  productId: z.string().min(1, "Produit requis"),
  quantity: z.coerce.number().int().min(1, "Quantité minimale : 1").max(99),
  sellingPrice: z.coerce
    .number({ message: "Prix de vente invalide" })
    .positive("Prix de vente requis")
    .max(1_000_000),
  customerFullName: z.string().trim().min(3, "Nom complet requis").max(160),
  phone: phoneSchema,
  governorate: z.string().trim().min(2, "Gouvernorat requis").max(80),
  city: z.string().trim().min(1, "Ville requise").max(80),
  address: z.string().trim().min(5, "Adresse requise").max(400),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  /**
   * CRITICAL business rule — the partner personally confirmed the order
   * with the customer BEFORE creating it in the platform.
   */
  confirmed: z.literal("on", {
    errorMap: () => ({
      message:
        "Vous devez confirmer que le client a accepté la commande et les conditions de livraison.",
    }),
  }),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const statusChangeSchema = z.object({
  orderId: z.string().min(1),
  to: z.enum([
    "VALIDATED",
    "ON_HOLD",
    "PREPARING",
    "PACKAGED",
    "SHIPPED",
    "IN_DELIVERY",
    "DELIVERED",
    "REFUSED",
    "RETURNED",
    "CANCELLED",
  ]),
  reason: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const orderListFilterSchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum([
    "CONFIRMED",
    "VALIDATED",
    "ON_HOLD",
    "PREPARING",
    "PACKAGED",
    "SHIPPED",
    "IN_DELIVERY",
    "DELIVERED",
    "REFUSED",
    "RETURNED",
    "CANCELLED",
  ]).optional(),
  partnerId: z.string().optional(),
  productId: z.string().optional(),
  governorate: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export { GOVERNORATES };
