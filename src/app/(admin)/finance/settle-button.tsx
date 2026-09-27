"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runSettlement, type FinanceActionState } from "./actions";

const initialState: FinanceActionState = { ok: false };

/**
 * Manual settlement trigger — identical engine to GET /api/cron/settle.
 * Idempotent: only PENDING entries whose frozen date has passed are released.
 */
export function SettleNowButton({ dueNowCount }: { dueNowCount: number }) {
  const [state, formAction, pending] = useActionState(
    runSettlement,
    initialState,
  );

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        Lancer le settlement ({dueNowCount})
      </Button>
    </form>
  );
}
