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
import { useI18n } from "@/lib/i18n";

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
  const { dict, locale } = useI18n();
  const t = dict.partnerPortal.wallet;
  const currencySymbol = locale === "ar" ? "د.ت" : locale === "en" ? "TND" : "DT";

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
        {locale === "ar"
          ? "طلب سحب قيد المعالجة حالياً. يمكنك تقديم طلب جديد فور معالجة طلبك السابق."
          : locale === "en"
          ? "A withdrawal request is already pending. You can submit a new one once it is processed."
          : "Une demande de retrait est déjà en cours de traitement. Vous pourrez en créer une nouvelle dès qu'elle sera payée ou rejetée."}
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
        <h2 className="font-semibold">{t.requestWithdrawal}</h2>
        <p className="text-sm text-muted-foreground">
          {locale === "ar" ? "قابل للسحب الآن: " : locale === "en" ? "Withdrawable now: " : "Retirable maintenant : "}
          <strong>{drawable} {currencySymbol}</strong> — {locale === "ar" ? "الحد الأدنى " : locale === "en" ? "minimum " : "minimum "}
          {minAmount} {currencySymbol}. {locale === "ar" ? "الأرباح المعلقة لا يمكن سحبها حالياً." : locale === "en" ? "Pending earnings cannot be withdrawn yet." : "Les gains en attente ne sont pas retirables."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="amount">{t.amountToWithdraw}</Label>
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
          <Label htmlFor="paymentMethod">{t.payoutMethod}</Label>
          <NativeSelect id="paymentMethod" name="paymentMethod" required>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="paymentAccount">{t.enterRib}</Label>
          <Input
            id="paymentAccount"
            name="paymentAccount"
            required
            maxLength={120}
            placeholder="RIB / D17"
          />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {t.submitRequest}
      </Button>
    </form>
  );
}
