import type {
  FinancialTransactionStatus,
  FinancialTransactionType,
  WithdrawalStatus,
} from "@prisma/client";

/** French labels for the finance screens (single source of truth). */

export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatus, string> = {
  REQUESTED: "Demandé",
  UNDER_REVIEW: "En vérification",
  APPROVED: "Approuvé",
  PAID: "Payé",
  REJECTED: "Rejeté",
};

export const WITHDRAWAL_STATUS_VARIANTS: Record<
  WithdrawalStatus,
  "secondary" | "info" | "warning" | "success" | "destructive"
> = {
  REQUESTED: "warning",
  UNDER_REVIEW: "info",
  APPROVED: "info",
  PAID: "success",
  REJECTED: "destructive",
};

export const LEDGER_TYPE_LABELS: Record<FinancialTransactionType, string> = {
  PARTNER_EARNING: "Gain partenaire",
  RETURN_COST: "Coût retour / refus",
  WITHDRAWAL: "Retrait",
  ADJUSTMENT: "Ajustement",
};

export const LEDGER_STATUS_LABELS: Record<FinancialTransactionStatus, string> = {
  PENDING: "En attente",
  AVAILABLE: "Disponible",
};

export const LEDGER_STATUS_VARIANTS: Record<
  FinancialTransactionStatus,
  "warning" | "success"
> = {
  PENDING: "warning",
  AVAILABLE: "success",
};
