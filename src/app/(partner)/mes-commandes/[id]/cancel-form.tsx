"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelOwnOrder, type OrderActionState } from "../../actions";

const initialState: OrderActionState = { ok: false };

/** Partner can cancel only a CONFIRMED order — reason required, enforced server-side. */
export function CancelOrderForm({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState(cancelOwnOrder, initialState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <div className="space-y-1.5">
        <label htmlFor="cancel-reason" className="text-sm font-medium">
          Annuler la commande (motif obligatoire)
        </label>
        <textarea
          id="cancel-reason"
          name="reason"
          required
          rows={2}
          maxLength={1000}
          placeholder="Ex : le client a finalement renoncé…"
          className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <Button
        type="submit"
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={(e) => {
          if (!window.confirm("Annuler définitivement cette commande ?")) {
            e.preventDefault();
          }
        }}
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Annuler la commande
      </Button>
      <p className="text-xs text-muted-foreground">
        Seules les commandes encore « Confirmée » peuvent être annulées par le
        partenaire — ensuite, seules les opérations gèrent le cycle de vie.
      </p>
    </form>
  );
}
