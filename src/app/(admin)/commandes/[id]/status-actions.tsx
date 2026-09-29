"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { OrderStatus, Role } from "@prisma/client";
import { availableTransitions } from "@/modules/orders/transitions";
import { ORDER_STATUS_LABELS } from "@/modules/orders/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyOrderStatus, type OrderAdminState } from "../actions";

const initialState: OrderAdminState = { ok: false };

const DANGEROUS: OrderStatus[] = ["REFUSED", "RETURNED", "CANCELLED"];

export function OrderStatusActions({
  orderId,
  status,
  statusBeforeHold,
  role,
}: {
  orderId: string;
  status: OrderStatus;
  statusBeforeHold: OrderStatus | null;
  role: Role;
}) {
  const [state, formAction, pending] = useActionState(
    applyOrderStatus,
    initialState,
  );
  const [openTo, setOpenTo] = useState<OrderStatus | null>(null);
  const [ackedMessage, setAckedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);

  /**
   * A successful action closes the reason panel. That is *derived* from the
   * action state rather than written back from an effect (React 19 flags
   * setState-in-effect as a cascading render). Clicking a status button
   * acknowledges the last success and opens the requested panel again.
   */
  const successToken = state.ok ? (state.message ?? "ok") : null;
  const panelTarget =
    successToken !== null && ackedMessage !== successToken ? null : openTo;

  const options = availableTransitions(status, role, statusBeforeHold);
  if (options.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const needsReason = o.reason === "REQUIRED";
          const dangerous = DANGEROUS.includes(o.to);
          return (
            <Button
              key={o.to}
              size="sm"
              variant={dangerous ? "destructive" : o.to === statusBeforeHold && status === "ON_HOLD" ? "outline" : "default"}
              onClick={() => {
                setAckedMessage(successToken);
                setOpenTo(openTo === o.to ? null : o.to);
              }}
            >
              {o.to === statusBeforeHold && status === "ON_HOLD"
                ? `Reprendre (${ORDER_STATUS_LABELS[o.to]})`
                : ORDER_STATUS_LABELS[o.to]}
              {needsReason ? "…" : ""}
            </Button>
          );
        })}
      </div>

      {panelTarget && (
        <form
          action={formAction}
          className="flex flex-wrap items-end gap-2 rounded-lg border p-3"
        >
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="to" value={panelTarget} />
          <div className="min-w-64 flex-1 space-y-1.5">
            <label htmlFor="status-reason" className="text-xs font-medium">
              {availableTransitions(status, role, statusBeforeHold).find(
                (t) => t.to === panelTarget,
              )?.reason === "REQUIRED"
                ? "Motif (obligatoire)"
                : "Motif (optionnel)"}
            </label>
            <Input
              id="status-reason"
              name="reason"
              maxLength={1000}
              placeholder="Ex : adresse incorrecte, client injoignable…"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            variant={DANGEROUS.includes(panelTarget) ? "destructive" : "default"}
            disabled={pending}
            onClick={(e) => {
              if (
                DANGEROUS.includes(panelTarget) &&
                !window.confirm(`Confirmer : ${ORDER_STATUS_LABELS[panelTarget]} ?`)
              ) {
                e.preventDefault();
              }
            }}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Appliquer
          </Button>
        </form>
      )}
    </div>
  );
}
