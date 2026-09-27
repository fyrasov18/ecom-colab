"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { settleDueEarnings } from "@/modules/finance/ledger";
import {
  withdrawalPaymentSchema,
  withdrawalRejectionSchema,
  withdrawalIdSchema,
} from "@/modules/finance/schemas";
import {
  approveWithdrawal,
  markWithdrawalUnderReview,
  payWithdrawal,
  rejectWithdrawal,
  WithdrawalError,
} from "@/modules/finance/withdrawals";

export type FinanceActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

function revalidateFinance() {
  revalidatePath("/finance");
  revalidatePath("/portefeuille");
  revalidatePath("/dashboard");
  revalidatePath("/partenaires");
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Données invalides.";
}

/** OPERATOR: REQUESTED → UNDER_REVIEW. */
export async function startWithdrawalReview(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const parsed = withdrawalIdSchema.safeParse({
    withdrawalId: str(formData.get("withdrawalId")),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    await markWithdrawalUnderReview({
      withdrawalId: parsed.data.withdrawalId,
      actorId: user.id,
      role: user.role,
    });
    revalidateFinance();
    return { ok: true, message: "Demande placée en vérification." };
  } catch (e) {
    if (e instanceof WithdrawalError) return { ok: false, error: e.message };
    return { ok: false, error: "Mise à jour impossible." };
  }
}

/** OPERATOR: REQUESTED|UNDER_REVIEW → APPROVED (still no money movement). */
export async function approveWithdrawalRequest(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const parsed = withdrawalIdSchema.safeParse({
    withdrawalId: str(formData.get("withdrawalId")),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    await approveWithdrawal({
      withdrawalId: parsed.data.withdrawalId,
      actorId: user.id,
      role: user.role,
    });
    revalidateFinance();
    return { ok: true, message: "Demande approuvée — prête à être payée." };
  } catch (e) {
    if (e instanceof WithdrawalError) return { ok: false, error: e.message };
    return { ok: false, error: "Approbation impossible." };
  }
}

/** OPERATOR: → REJECTED, motivated (no ledger movement). */
export async function rejectWithdrawalRequest(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const parsed = withdrawalRejectionSchema.safeParse({
    withdrawalId: str(formData.get("withdrawalId")),
    rejectionReason: str(formData.get("rejectionReason")),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    await rejectWithdrawal({
      withdrawalId: parsed.data.withdrawalId,
      actorId: user.id,
      role: user.role,
      reason: parsed.data.rejectionReason,
    });
    revalidateFinance();
    return { ok: true, message: "Demande rejetée (motif enregistré)." };
  } catch (e) {
    if (e instanceof WithdrawalError) return { ok: false, error: e.message };
    return { ok: false, error: "Rejet impossible." };
  }
}

/** OPERATOR: APPROVED → PAID — the only step that moves the ledger. */
export async function payWithdrawalRequest(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const parsed = withdrawalPaymentSchema.safeParse({
    withdrawalId: str(formData.get("withdrawalId")),
    transactionReference: str(formData.get("transactionReference")),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    await payWithdrawal({
      withdrawalId: parsed.data.withdrawalId,
      actorId: user.id,
      role: user.role,
      transactionReference: parsed.data.transactionReference,
    });
    revalidateFinance();
    return { ok: true, message: "Retrait marqué payé — ledger débité." };
  } catch (e) {
    if (e instanceof WithdrawalError) return { ok: false, error: e.message };
    return { ok: false, error: "Paiement impossible." };
  }
}

/**
 * Manual settlement run (same engine as GET /api/cron/settle). Idempotent, so
 * pressing it twice is harmless.
 */
export async function runSettlement(
  _prev: FinanceActionState,
  _formData: FormData,
): Promise<FinanceActionState> {
  await requireSession(["SUPER_ADMIN", "ADMIN"]);
  try {
    const result = await settleDueEarnings();
    revalidateFinance();
    if (result.settled === 0) {
      return { ok: true, message: "Aucun gain à débloquer pour le moment." };
    }
    return {
      ok: true,
      message: `${result.settled} gain(s) débloqué(s) pour ${result.partners.length} partenaire(s).`,
    };
  } catch {
    return { ok: false, error: "Settlement impossible." };
  }
}
