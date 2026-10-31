"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  runSettlement,
  runSettlementAll,
  runSettleSingle,
  type FinanceActionState,
} from "./actions";

const initialState: FinanceActionState = { ok: false };

/**
 * Manual settlement buttons for the Admin Finance dashboard.
 * Replaces the automated cron job with 1-click manual controls.
 */
export function SettleNowButton({
  dueNowCount,
  scheduledCount = 0,
}: {
  dueNowCount: number;
  scheduledCount?: number;
}) {
  const [dueState, dueFormAction, duePending] = useActionState(
    runSettlement,
    initialState,
  );
  const [allState, allFormAction, allPending] = useActionState(
    runSettlementAll,
    initialState,
  );

  useEffect(() => {
    if (dueState.ok && dueState.message) toast.success(dueState.message);
    if (!dueState.ok && dueState.error) toast.error(dueState.error);
  }, [dueState]);

  useEffect(() => {
    if (allState.ok && allState.message) toast.success(allState.message);
    if (!allState.ok && allState.error) toast.error(allState.error);
  }, [allState]);

  const totalPending = dueNowCount + scheduledCount;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Primary: Settle due earnings (settlement date elapsed) */}
      <form action={dueFormAction}>
        <Button
          type="submit"
          size="sm"
          variant={dueNowCount > 0 ? "default" : "outline"}
          className={
            dueNowCount > 0
              ? "bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              : ""
          }
          disabled={duePending || allPending}
        >
          {duePending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
          )}
          Débloquer les gains échus ({dueNowCount})
        </Button>
      </form>

      {/* Secondary: Force release all pending without waiting */}
      {totalPending > 0 && (
        <form action={allFormAction}>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="text-xs"
            disabled={duePending || allPending}
            title="Débloque immédiatement tous les gains en attente pour tous les partenaires"
          >
            {allPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Zap className="h-3.5 w-3.5 mr-1 text-amber-500" />
            )}
            Tout débloquer immédiatement ({totalPending})
          </Button>
        </form>
      )}
    </div>
  );
}

/**
 * 1-click button to manually release a single pending transaction directly from the ledger row.
 */
export function SettleSingleTransactionButton({
  transactionId,
}: {
  transactionId: string;
}) {
  const [state, formAction, pending] = useActionState(
    runSettleSingle,
    initialState,
  );

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="inline-block">
      <input type="hidden" name="transactionId" value={transactionId} />
      <Button
        type="submit"
        size="sm"
        variant="ghost"
        disabled={pending}
        className="h-7 px-2 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
        ) : (
          <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
        )}
        Débloquer
      </Button>
    </form>
  );
}
