"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { ClipboardCheck, Loader2, Send } from "lucide-react";
import type { WithdrawalStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  approveWithdrawalRequest,
  payWithdrawalRequest,
  rejectWithdrawalRequest,
  startWithdrawalReview,
  type FinanceActionState,
} from "./actions";

const initialState: FinanceActionState = { ok: false };

function useActionToast(state: FinanceActionState) {
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);
}

/**
 * Review actions for one withdrawal row. Every action is re-validated
 * server-side (status machine + operator role + audit), so the buttons shown
 * here are convenience, never authority.
 */
export function WithdrawalActions({
  withdrawalId,
  status,
}: {
  withdrawalId: string;
  status: WithdrawalStatus;
}) {
  const [reviewState, reviewAction, reviewPending] = useActionState(
    startWithdrawalReview,
    initialState,
  );
  const [approveState, approveAction, approvePending] = useActionState(
    approveWithdrawalRequest,
    initialState,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectWithdrawalRequest,
    initialState,
  );
  const [payState, payAction, payPending] = useActionState(
    payWithdrawalRequest,
    initialState,
  );

  useActionToast(reviewState);
  useActionToast(approveState);
  useActionToast(rejectState);
  useActionToast(payState);

  if (status === "PAID" || status === "REJECTED") {
    return <span className="text-xs text-muted-foreground">Traité</span>;
  }

  const busy = reviewPending || approvePending || rejectPending || payPending;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {status === "REQUESTED" ? (
          <form action={reviewAction}>
            <input type="hidden" name="withdrawalId" value={withdrawalId} />
            <Button type="submit" size="sm" variant="outline" disabled={busy}>
              {reviewPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ClipboardCheck />
              )}
              Vérifier
            </Button>
          </form>
        ) : null}

        {status === "REQUESTED" || status === "UNDER_REVIEW" ? (
          <form action={approveAction}>
            <input type="hidden" name="withdrawalId" value={withdrawalId} />
            <Button type="submit" size="sm" disabled={busy}>
              {approvePending ? <Loader2 className="animate-spin" /> : null}
              Approuver
            </Button>
          </form>
        ) : null}

        {status === "APPROVED" ? (
          <form action={payAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="withdrawalId" value={withdrawalId} />
            <Input
              name="transactionReference"
              required
              maxLength={80}
              placeholder="Référence du paiement"
              className="h-8 w-48 text-xs"
            />
            <Button type="submit" size="sm" disabled={busy}>
              {payPending ? <Loader2 className="animate-spin" /> : <Send />}
              Marquer payé
            </Button>
          </form>
        ) : null}
      </div>

      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          Rejeter…
        </summary>
        <form action={rejectAction} className="mt-2 space-y-2">
          <input type="hidden" name="withdrawalId" value={withdrawalId} />
          <textarea
            name="rejectionReason"
            required
            minLength={5}
            maxLength={500}
            rows={2}
            placeholder="Motif du rejet (obligatoire)"
            className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" size="sm" variant="destructive" disabled={busy}>
            {rejectPending ? <Loader2 className="animate-spin" /> : null}
            Confirmer le rejet
          </Button>
          <p className="text-xs text-muted-foreground">
            Aucun mouvement de ledger : les fonds n&apos;étaient pas bloqués à la
            demande.
          </p>
        </form>
      </details>
    </div>
  );
}
