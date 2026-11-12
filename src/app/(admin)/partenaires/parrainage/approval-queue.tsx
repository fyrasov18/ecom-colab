"use client";

import type { Prisma } from "@prisma/client";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { useI18n } from "@/lib/i18n";
import {
  approveCommissionAction,
  rejectCommissionAction,
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

export type QueueCommissionItem = {
  id: string;
  orderId?: string | null;
  amount: string | number;
  currency: string;
  status: string;
  createdAt: string | Date;
  calculationDetails?: Prisma.JsonValue | null;
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
    email?: string;
  };
};

function ApprovalRow({ item }: { item: QueueCommissionItem }) {
  const { dict, formatDate } = useI18n();
  const [approveState, approveAction, approvePending] = useActionState<
    AdminCommissionActionState,
    FormData
  >(
    approveCommissionAction,
    initialState,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState<
    AdminCommissionActionState,
    FormData
  >(
    rejectCommissionAction,
    initialState,
  );
  const [showRejectForm, setShowRejectForm] = useState(false);

  useActionToast(approveState);
  useActionToast(rejectState);

  const busy = approvePending || rejectPending;
  const isPendingVerification = item.status === "PENDING_VERIFICATION";

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

      <td className="p-3 font-mono">
        {item.orderId ? (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{item.orderId}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      <td className="p-3 font-mono font-bold text-foreground">
        {formatMoney(item.amount, { currency: item.currency })}
      </td>

      <td className="p-3">
        <Badge
          variant={isPendingVerification ? "warning" : "info"}
          className="text-[11px] gap-1 font-normal"
        >
          <Clock className="h-3 w-3" />
          {isPendingVerification ? dict.common.pending : dict.common.validated}
        </Badge>
      </td>

      <td className="p-3 text-muted-foreground">
        {formatDate(item.createdAt)}
      </td>

      <td className="p-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
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

            {/* Approve Button */}
            <form action={approveAction}>
              <input type="hidden" name="commissionId" value={item.id} />
              <Button
                type="submit"
                size="sm"
                variant="default"
                disabled={busy}
                className="gap-1 text-xs bg-success-600 hover:bg-success-700 text-white"
              >
                {approvePending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                {dict.finance.approveWithdrawal}
              </Button>
            </form>

            {/* Toggle Reject Form */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setShowRejectForm(!showRejectForm)}
              className="text-danger-600 hover:text-danger-700 hover:bg-danger-50 border-danger/20 text-xs"
            >
              <XCircle className="h-3 w-3" />
              {dict.finance.rejectWithdrawal}
            </Button>
          </div>

          {/* Expandable Rejection Form with mandatory reason */}
          {showRejectForm && (
            <form
              action={(formData) => {
                rejectAction(formData);
                setShowRejectForm(false);
              }}
              className="mt-1 space-y-2 rounded-lg border border-danger/30 bg-danger-50/50 p-2.5"
            >
              <input type="hidden" name="commissionId" value={item.id} />
              <label className="block text-[11px] font-semibold text-danger-800">
                {dict.finance.rejectionReason} :
              </label>
              <textarea
                name="reason"
                required
                minLength={3}
                maxLength={500}
                rows={2}
                placeholder={dict.finance.rejectionReason}
                className="w-full rounded border border-danger/30 bg-white p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-danger-500"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRejectForm(false)}
                  className="text-xs"
                >
                  {dict.common.cancel}
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  className="text-xs"
                >
                  {rejectPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {dict.finance.rejectWithdrawal}
                </Button>
              </div>
            </form>
          )}
        </div>
      </td>
    </tr>
  );
}

export function ApprovalQueueTable({ items }: { items: QueueCommissionItem[] }) {
  const { dict, locale } = useI18n();

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
        <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
        <p className="text-sm font-medium">
          {locale === "ar" ? "لا توجد عمولات قيد انتظار الموافقة" : locale === "en" ? "No commissions pending approval" : "Aucune commission en attente d'approbation"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {locale === "ar" ? "تمت معالجة كافة العمولات المؤهلة." : locale === "en" ? "All eligible commissions have been processed." : "Toutes les commissions éligibles ont été traitées."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-soft">
      <table className="w-full text-left">
        <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground">
          <tr>
            <th className="p-3">{dict.nav.referrals}</th>
            <th className="p-3">{dict.partnerPortal.referrals.activeReferrals}</th>
            <th className="p-3">{dict.orders.title}</th>
            <th className="p-3">{dict.common.total}</th>
            <th className="p-3">{dict.common.status}</th>
            <th className="p-3">{dict.common.date}</th>
            <th className="p-3 min-w-[280px]">{dict.common.actions}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <ApprovalRow key={item.id} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
