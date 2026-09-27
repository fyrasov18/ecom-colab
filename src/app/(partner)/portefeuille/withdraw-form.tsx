"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
} from "@/modules/finance/schemas";
import { submitWithdrawalRequest, type WalletActionState } from "./actions";

const initialState: WalletActionState = { ok: false };

/**
 * Withdrawal request form. The amounts shown come from the ledger; the server
 * re-validates them, so a tampered form can never over-request.
 */
export function WithdrawForm({
  drawable,
  minAmount,
  hasActiveRequest,
}: {
  drawable: string;
  minAmount: string;
  hasActiveRequest: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    submitWithdrawalRequest,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      formRef.current?.reset();
    }
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);

  if (hasActiveRequest) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Une demande de retrait est déjà en cours de traitement. Vous pourrez en
        créer une nouvelle dès qu&apos;elle sera payée ou rejetée.
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-xl border bg-card p-4"
    >
      <div>
        <h2 className="font-semibold">Demander un retrait</h2>
        <p className="text-sm text-muted-foreground">
          Retirable maintenant : <strong>{drawable} DT</strong> — minimum{" "}
          {minAmount} DT. Les gains en attente ne sont pas retirables.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Montant (DT)</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            min={0.001}
            step="0.001"
            max={drawable}
            required
            placeholder={drawable}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="paymentMethod">Moyen de paiement</Label>
          <NativeSelect id="paymentMethod" name="paymentMethod" required>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="paymentAccount">Coordonnées de paiement</Label>
          <Input
            id="paymentAccount"
            name="paymentAccount"
            required
            maxLength={120}
            placeholder="RIB / n° de téléphone"
          />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Envoyer la demande
      </Button>
    </form>
  );
}
