"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { saveSettlementSettings, type SettlementSettingsState } from "./actions";

type SettingDTO = {
  key: string;
  description: string;
  value: unknown;
};

const initialState: SettlementSettingsState = { ok: false };

export function SettlementRulesForm({
  settings,
  canEdit,
}: {
  settings: SettingDTO[];
  canEdit: boolean;
}) {
  const { dict, locale } = useI18n();
  const getValue = (key: string) => settings.find((s) => s.key === key)?.value;

  const [state, formAction, pending] = useActionState(
    saveSettlementSettings,
    initialState,
  );

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {dict.settingsHub.settlementRulesTitle}
          </CardTitle>
          <CardDescription>
            {dict.settingsHub.settlementRulesDesc}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Settlement Period Hours */}
          <div className="space-y-2">
            <Label htmlFor="settlementPeriodHours">
              {locale === "ar"
                ? "مدة التسوية (ساعات)"
                : locale === "en"
                  ? "Settlement Period (hours)"
                  : "Période de settlement (heures)"}
            </Label>
            <Input
              id="settlementPeriodHours"
              name="settlementPeriodHours"
              type="number"
              min={1}
              max={720}
              defaultValue={Number(getValue("finance.settlement_period_hours") ?? 48)}
              disabled={!canEdit}
            />
            <p className="text-xs text-muted-foreground">
              {locale === "ar"
                ? "تطبق عند التسليم. لا تتأثر الطلبيات المسلمة مسبقاً."
                : locale === "en"
                  ? "Applied upon delivery. Delivered orders remain unaffected."
                  : "Appliquée à la livraison. Les commandes déjà livrées ne sont pas affectées."}
            </p>
          </div>

          {/* Minimum Withdrawal Amount */}
          <div className="space-y-2">
            <Label htmlFor="minWithdrawalAmount">
              {locale === "ar"
                ? "الحد الأدنى للسحب (د.ت)"
                : locale === "en"
                  ? "Minimum Withdrawal (TND)"
                  : "Retrait minimum (DT)"}
            </Label>
            <Input
              id="minWithdrawalAmount"
              name="minWithdrawalAmount"
              type="number"
              min={1}
              step="0.001"
              defaultValue={Number(getValue("finance.min_withdrawal_amount") ?? 100)}
              disabled={!canEdit}
            />
            <p className="text-xs text-muted-foreground">
              {locale === "ar"
                ? "لا يمكن طلب سحب لمبلغ أقل من هذا الحد."
                : locale === "en"
                  ? "Withdrawal requests below this amount are not permitted."
                  : "En dessous de ce montant, aucun retrait ne peut être demandé."}
            </p>
          </div>

          {/* Minimum Order Contribution */}
          <div className="space-y-2">
            <Label htmlFor="minOrderContribution">
              {locale === "ar"
                ? "المساهمة الدنيا للطلب (د.ت)"
                : locale === "en"
                  ? "Minimum Order Contribution (TND)"
                  : "Contribution minimale (DT)"}
            </Label>
            <Input
              id="minOrderContribution"
              name="minOrderContribution"
              type="number"
              min={0}
              step="0.001"
              defaultValue={Number(getValue("finance.min_order_contribution") ?? 7.0)}
              disabled={!canEdit}
            />
            <p className="text-xs text-muted-foreground">
              {locale === "ar"
                ? "الحد الأدنى الإجمالي للموافقة على تسجيل طلبية."
                : locale === "en"
                  ? "Minimum gross threshold required to place an order."
                  : "Seuil brut minimum requis pour autoriser la création de commande."}
            </p>
          </div>

          {/* Reason */}
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="reason">
              {locale === "ar"
                ? "سبب التعديل"
                : locale === "en"
                  ? "Reason for modification"
                  : "Motif de la modification"}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="reason"
              name="reason"
              placeholder={
                locale === "ar"
                  ? "مثال: مراجعة دورية لشروط التسوية"
                  : locale === "en"
                    ? "e.g. Quarterly settlement terms review"
                    : "Ex : Révision trimestrielle des conditions de settlement"
              }
              minLength={5}
              required={canEdit}
              disabled={!canEdit}
            />
            <p className="text-xs text-muted-foreground">
              {locale === "ar"
                ? "إلزامي لكل تعديل — يسجل بشكل غير قابل للتعديل في سجل التدقيق."
                : locale === "en"
                  ? "Mandatory for any update — permanently saved in audit logs."
                  : "Obligatoire pour toute modification — enregistré de manière immuable dans le journal d'audit."}
            </p>
          </div>

          {/* Submit */}
          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={pending || !canEdit}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {dict.common.save}
            </Button>
            {!canEdit && (
              <p className="mt-2 text-xs text-muted-foreground">
                {locale === "ar"
                  ? "التعديل متاح فقط للمشرفين المصرح لهم."
                  : locale === "en"
                    ? "Modification restricted to authorized administrators."
                    : "Modification réservée aux utilisateurs habilités."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
