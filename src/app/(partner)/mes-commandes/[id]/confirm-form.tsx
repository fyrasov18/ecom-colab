"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CONFIRMATION_TEXT } from "@/modules/orders/schemas";
import { confirmPartnerOrder, type OrderActionState } from "../../actions";

const initialState: OrderActionState = { ok: false };

export function ConfirmOrderForm({
  orderId,
  previewSnapshot,
}: {
  orderId: string;
  previewSnapshot?: string;
}) {
  const [state, formAction, pending] = useActionState(confirmPartnerOrder, initialState);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="confirmed" value={confirmed ? "on" : ""} />
      {previewSnapshot && (
        <input type="hidden" name="previewSnapshot" value={previewSnapshot} />
      )}

      <div>
        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          En attente de confirmation client
        </h3>
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          Cette commande ne pourra pas être préparée ni expédiée tant qu&apos;elle n&apos;est pas
          confirmée avec le client.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-primary/40 bg-background p-3">
        <Checkbox
          checked={confirmed}
          onCheckedChange={(v) => setConfirmed(v === true)}
          className="mt-0.5"
          aria-label={CONFIRMATION_TEXT}
        />
        <span className="text-xs leading-relaxed">
          <strong>{CONFIRMATION_TEXT}</strong>
        </span>
      </label>

      <Button
        type="submit"
        size="sm"
        disabled={pending || !confirmed}
        className="w-full sm:w-auto"
      >
        {pending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="mr-2 h-4 w-4" />
        )}
        Confirmer la commande
      </Button>
    </form>
  );
}
