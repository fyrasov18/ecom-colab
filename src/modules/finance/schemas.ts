import { z } from "zod";

/** Withdrawal payload contracts — shared by server actions and tests. */

export const PAYMENT_METHODS = [
  "BANK_TRANSFER",
  "CASH",
  "POSTAL",
  "OTHER",
] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "Virement bancaire",
  CASH: "Espèces",
  POSTAL: "Mandat postal",
  OTHER: "Autre",
};

export const withdrawableWithdrawalStatuses = [
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
] as const;

export const withdrawalRequestSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: "Montant invalide." })
    .positive("Le montant doit être supérieur à zéro.")
    .max(1_000_000, "Montant trop élevé."),
  paymentMethod: z.enum(PAYMENT_METHODS, {
    errorMap: () => ({ message: "Choisissez un moyen de paiement." }),
  }),
  paymentAccount: z
    .string()
    .trim()
    .min(4, "Précisez les coordonnées de paiement (RIB, téléphone…).")
    .max(120, "Coordonnées trop longues."),
});

export type WithdrawalRequestInput = z.infer<typeof withdrawalRequestSchema>;

export const withdrawalRejectionSchema = z.object({
  withdrawalId: z.string().min(1, "Demande introuvable."),
  rejectionReason: z
    .string()
    .trim()
    .min(5, "Le motif de rejet est obligatoire (5 caractères minimum).")
    .max(500, "Motif trop long."),
});

export const withdrawalPaymentSchema = z.object({
  withdrawalId: z.string().min(1, "Demande introuvable."),
  transactionReference: z
    .string()
    .trim()
    .min(3, "Indiquez la référence du paiement.")
    .max(80, "Référence trop longue."),
});

export const withdrawalIdSchema = z.object({
  withdrawalId: z.string().min(1, "Demande introuvable."),
});
