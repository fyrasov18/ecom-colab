"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { saveCommissionSettings, type CommissionSettingsState } from "./actions";

type SettingDTO = {
  key: string;
  description: string;
  value: unknown;
};

const initialState: CommissionSettingsState = { ok: false };

export function CommissionRulesForm({
  settings,
  canEdit,
}: {
  settings: SettingDTO[];
  canEdit: boolean;
}) {
  const { dict, locale } = useI18n();
  const getValue = (key: string) => settings.find((s) => s.key === key)?.value;

  const [state, formAction, pending] = useActionState(
    saveCommissionSettings,
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
            {dict.settingsHub.commissionRulesTitle}
          </CardTitle>
          <CardDescription>
            {dict.settingsHub.commissionRulesDesc}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          {/* Global Commission */}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="globalCommissionType">
              {locale === "ar"
                ? "العمولة العامة الافتراضية"
                : locale === "en"
                  ? "Default Global Commission"
                  : "Commission globale par défaut"}
            </Label>
            <div className="grid gap-3 sm:grid-cols-3">
              <NativeSelect
                id="globalCommissionType"
                name="globalCommissionType"
                defaultValue={String(
                  (
                    getValue("finance.global_commission") as
                      | { commissionType?: string }
                      | undefined
                  )?.commissionType ?? "PERCENTAGE",
                )}
                disabled={!canEdit}
              >
                <option value="PERCENTAGE">{dict.partners.percentage}</option>
                <option value="FIXED">{dict.partners.fixed}</option>
              </NativeSelect>
              <Input
                id="globalCommissionValue"
                name="globalCommissionValue"
                type="number"
                min={0}
                step="0.001"
                defaultValue={Number(
                  (
                    getValue("finance.global_commission") as
                      | { commissionValue?: number }
                      | undefined
                  )?.commissionValue ?? 30,
                )}
                disabled={!canEdit}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {locale === "ar"
                ? "المستوى الرابع في التسلسل: تطبق في حال عدم وجود تعيين مباشر."
                : locale === "en"
                  ? "Hierarchy Level 4: Applied only when no direct assignment or tier is set."
                  : "Niveau 4 de la hiérarchie : appliquée uniquement si ni assignation produit, ni admin partenaire n'est défini."}
            </p>
          </div>

          {/* Return Cost Rule */}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="returnCostRule">
              {locale === "ar"
                ? "قاعدة تكلفة الإرجاع / الرفض"
                : locale === "en"
                  ? "Return / Refusal Cost Rule"
                  : "Règle de coût retour/refus"}
            </Label>
            <NativeSelect
              id="returnCostRule"
              name="returnCostRule"
              defaultValue={String(
                getValue("finance.return_cost_rule") ?? "REVERSE_PENDING_EARNING",
              )}
              disabled={!canEdit}
            >
              <option value="REVERSE_PENDING_EARNING">
                {locale === "ar"
                  ? "إلغاء الربح المعلق (تتحمل المنصة الشحن)"
                  : locale === "en"
                    ? "Reverse pending earning (platform covers delivery)"
                    : "Réverser le gain en attente (défaut, livraison à la plateforme)"}
              </option>
              <option value="REVERSE_PLUS_DELIVERY">
                {locale === "ar"
                  ? "إلغاء الربح + احتساب الشحن على الشريك"
                  : locale === "en"
                    ? "Reverse earning + charge delivery to partner"
                    : "Réverser le gain + facturer la livraison au partenaire"}
              </option>
              <option value="NO_COST">
                {locale === "ar"
                  ? "لا توجد تكلفة على الشريك"
                  : locale === "en"
                    ? "No cost to partner"
                    : "Aucun coût partenaire"}
              </option>
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              {locale === "ar"
                ? "تطبق عند رفض أو إرجاع الشحنة."
                : locale === "en"
                  ? "Applied during parcel returns and refusals."
                  : "Appliquée lors des retours et refus."}
            </p>
          </div>

          {/* Reason */}
          <div className="space-y-2 sm:col-span-2">
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
                  ? "مثال: مراجعة دورية لقواعد العمولة"
                  : locale === "en"
                    ? "e.g. Quarterly commission rules review"
                    : "Ex : Révision trimestrielle des règles de commission"
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
          <div className="sm:col-span-2">
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
