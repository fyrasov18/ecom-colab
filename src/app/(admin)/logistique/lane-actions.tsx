"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bulkAdvance, type LogisticsState } from "./actions";

const initialState: LogisticsState = { ok: false };

/**
 * Wraps a lane table: checkboxes named `orderIds` are collected and
 * advanced in one server call (per-order validation happens server-side).
 * Server-rendered table children pass through untouched.
 */
export function BulkLaneForm({
  to,
  toLabel,
  children,
}: {
  to: string;
  toLabel: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(bulkAdvance, initialState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="to" value={to} />
      {children}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Sélectionnez les commandes à faire avancer — chaque commande est
          revalidée individuellement côté serveur.
        </p>
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          onClick={(e) => {
            if (
              !window.confirm(
                `Appliquer « ${toLabel} » aux commandes sélectionnées ?`,
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {toLabel}
        </Button>
      </div>
    </form>
  );
}

/** Master checkbox toggling all row checkboxes inside the lane form. */
export function SelectAllCheckbox() {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 rounded border-input accent-primary"
      aria-label="Tout sélectionner"
      onClick={(e) => {
        const checked = (e.target as HTMLInputElement).checked;
        const form = (e.target as HTMLInputElement).form;
        if (!form) return;
        form
          .querySelectorAll<HTMLInputElement>('input[name="orderIds"]')
          .forEach((cb) => {
            cb.checked = checked;
          });
      }}
    />
  );
}

