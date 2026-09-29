"use server";

import { revalidatePath } from "next/cache";
import { formatPrice } from "@/lib/money";
import { requireSession } from "@/lib/rbac";
import { withdrawalRequestSchema } from "@/modules/finance/schemas";
import {
  requestWithdrawal,
  WithdrawalError,
} from "@/modules/finance/withdrawals";
import { checkRateLimit, rateLimitMessage } from "@/lib/rate-limit";

export type WalletActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

/**
 * Partner withdrawal request. All checks (minimum, available balance, one
 * active request) are re-validated server-side against the ledger — the client
 * form is a convenience only.
 */
export async function submitWithdrawalRequest(
  _prev: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> {
  const user = await requireSession(["PARTNER"]);
  if (!user.partnerId) {
    return { ok: false, error: "Compte partenaire introuvable." };
  }

  // Per-partner brake (spec §46): the ledger already blocks overdrafts, this
  // stops a client spamming the endpoint.
  const limit = await checkRateLimit("WITHDRAWAL_REQUEST", user.partnerId);
  if (!limit.allowed) {
    return { ok: false, error: rateLimitMessage(limit) };
  }

  const parsed = withdrawalRequestSchema.safeParse({
    amount: str(formData.get("amount")),
    paymentMethod: str(formData.get("paymentMethod")),
    paymentAccount: str(formData.get("paymentAccount")),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }

  try {
    const withdrawal = await requestWithdrawal({
      partnerId: user.partnerId,
      amount: parsed.data.amount,
      paymentMethod: parsed.data.paymentMethod,
      paymentAccount: parsed.data.paymentAccount,
      actorId: user.id,
    });
    revalidatePath("/portefeuille");
    return {
      ok: true,
      message: `Demande de retrait de ${formatPrice(withdrawal.amount)} DT envoyée à l'opérateur.`,
    };
  } catch (e) {
    if (e instanceof WithdrawalError) return { ok: false, error: e.message };
    return { ok: false, error: "Demande de retrait impossible." };
  }
}
