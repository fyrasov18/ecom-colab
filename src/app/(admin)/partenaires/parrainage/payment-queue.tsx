"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Send, Loader2, CheckCircle2, Wallet, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/money";
import {
  payCommissionAction,
  type AdminCommissionActionState,
} from "./actions";
import { CalculationBreakdownModal } from "./breakdown-modal";

const initialState: AdminCommissionActionState = { ok: false };

function useActionToast(state: AdminCommissionActionState) {
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);
}

export type PaymentQueueItem = {
  id: string;
  orderId?: string | null;
  amount: string | number;
  currency: string;
  status: string;
  approvedAt?: string | Date | null;
  approvedById?: string | null;
  calculationDetails?: any;
  referrer: {
    id: string;
    code: string;
    displayName: string;
    email?: string;
  };
  referred: {
    id: string;
    code: string;
    displayName: string;
  };
};

function PaymentRow({ item }: { item: PaymentQueueItem }) {
  const [payState, payAction, payPending] = useActionState(
    payCommissionAction,
    initialState,
  );

  useActionToast(payState);

  return (
    <tr className="hover:bg-muted/50 border-b transition-colors text-xs">
      <td className="p-3 font-medium">
        <div>
          <span className="font-semibold text-foreground">{item.referrer.displayName}</span>
          <span className="ml-1 text-[11px] font-mono text-muted-foreground">({item.referrer.code})</span>
        </div>
        {item.referrer.email && (
          <p className="text-[11px] text-muted-foreground">{item.referrer.email}</p>
        )}
      </td>

      <td className="p-3">
        <div>
          <span className="text-foreground">{item.referred.displayName}</span>
          <span className="ml-1 text-[11px] font-mono text-muted-foreground">({item.referred.code})</span>
        </div>
      </td>

      <td className="p-3 font-mono font-bold text-success-700 text-sm">
        {formatMoney(item.amount, { currency: item.currency })}
      </td>

      <td className="p-3">
        <Badge variant="outline" className="border-info-300 bg-info-50 text-info-700 text-[11px] font-normal">
          Approuvé pour paiement
        </Badge>
        {item.approvedAt && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            le {new Date(item.approvedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        )}
      </td>

      <td className="p-3">
        <CalculationBreakdownModal
          commissionId={item.id}
          orderId={item.orderId}
          amount={item.amount}
          currency={item.currency}
          calculationDetails={item.calculationDetails}
          referrerName={`${item.referrer.displayName} (${item.referrer.code})`}
          referredName={`${item.referred.displayName} (${item.referred.code})`}
          triggerSize="sm"
        />
      </td>

      <td className="p-3">
        <form action={payAction} className="flex items-center gap-2">
          <input type="hidden" name="commissionId" value={item.id} />
          <Input
            name="transactionReference"
            required
            maxLength={100}
            placeholder="Réf. virement / reçu (obligatoire)"
            className="h-8 w-52 text-xs"
          />
          <Button
            type="submit"
            size="sm"
            variant="default"
            disabled={payPending}
            className="gap-1 text-xs whitespace-nowrap bg-primary"
          >
            {payPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            Enregistrer le paiement
          </Button>
        </form>
      </td>
    </tr>
  );
}

export function PaymentQueueTable({ items }: { items: PaymentQueueItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
        <Wallet className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
        <p className="text-sm font-medium">Aucun paiement en attente</p>
        <p className="text-xs text-muted-foreground mt-1">
          Toutes les commissions approuvées ont été payées et enregistrées.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-soft">
      <table className="w-full text-left">
        <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground">
          <tr>
            <th className="p-3">Bénéficiaire</th>
            <th className="p-3">Filleul</th>
            <th className="p-3">Montant net</th>
            <th className="p-3">Statut & Date</th>
            <th className="p-3">Calcul</th>
            <th className="p-3 min-w-[340px]">Enregistrement du paiement</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <PaymentRow key={item.id} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
