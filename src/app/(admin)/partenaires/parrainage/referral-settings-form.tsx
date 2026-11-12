"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Sliders, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  saveReferralSettingsAction,
  type AdminCommissionActionState,
} from "./actions";

const initialState: AdminCommissionActionState = { ok: false };

export function ReferralSettingsForm({
  initialSettings,
}: {
  initialSettings: {
    level2Threshold: number;
    level3Threshold: number;
    level4Threshold: number;
    level5Threshold: number;
    requiredOrdersToQualify: number;
  };
}) {
  const { dict, locale } = useI18n();
  const [state, formAction, pending] = useActionState(
    saveReferralSettingsAction,
    initialState,
  );

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-foreground">
          <Sliders className="h-4 w-4 text-primary" />
          {locale === "ar" ? "الإعدادات الديناميكية للمستويات الخمسة والتأهيل" : locale === "en" ? "Dynamic 5-Tier & Qualification Configuration" : "Configuration dynamique des 5 Niveaux & Qualification"}
        </CardTitle>
        <CardDescription>
          {locale === "ar" ? "تعديل عتبات التقدم وعدد الطلبيات اللازمة لتأهيل الفيلول." : locale === "en" ? "Adjust tier thresholds and the required number of orders to qualify referrals." : "Ajustez les seuils de progression et le nombre de commandes nécessaires pour qualifier un filleul."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="requiredOrdersToQualify" className="text-xs">
                {locale === "ar" ? "طلبيات التأهيل" : locale === "en" ? "Orders to Qualify" : "Commandes / qualification"}
              </Label>
              <Input
                id="requiredOrdersToQualify"
                name="requiredOrdersToQualify"
                type="number"
                min={1}
                max={50}
                defaultValue={initialSettings.requiredOrdersToQualify}
                className="h-8 text-xs font-mono"
                required
              />
              <p className="text-[10px] text-muted-foreground">{locale === "ar" ? "مثال: 3 طلبيات مسلّمة" : locale === "en" ? "e.g. 3 delivered orders" : "Ex: 3 commandes livrées"}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="level2Threshold" className="text-xs">
                {locale === "ar" ? "عتبة المستوى 2 (7%)" : locale === "en" ? "Tier 2 Threshold (7%)" : "Seuil Niveau 2 (7%)"}
              </Label>
              <Input
                id="level2Threshold"
                name="level2Threshold"
                type="number"
                min={1}
                defaultValue={initialSettings.level2Threshold}
                className="h-8 text-xs font-mono"
                required
              />
              <p className="text-[10px] text-muted-foreground">{locale === "ar" ? "شريك مؤهل (الافتراضي: 10)" : locale === "en" ? "Qualified referrals (default: 10)" : "Filleuls qualifiés (défaut : 10)"}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="level3Threshold" className="text-xs">
                {locale === "ar" ? "عتبة المستوى 3 (15%)" : locale === "en" ? "Tier 3 Threshold (15%)" : "Seuil Niveau 3 (15%)"}
              </Label>
              <Input
                id="level3Threshold"
                name="level3Threshold"
                type="number"
                min={1}
                defaultValue={initialSettings.level3Threshold}
                className="h-8 text-xs font-mono"
                required
              />
              <p className="text-[10px] text-muted-foreground">{locale === "ar" ? "شريك مؤهل (الافتراضي: 100)" : locale === "en" ? "Qualified referrals (default: 100)" : "Filleuls qualifiés (défaut : 100)"}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="level4Threshold" className="text-xs">
                {locale === "ar" ? "عتبة المستوى 4 (20%)" : locale === "en" ? "Tier 4 Threshold (20%)" : "Seuil Niveau 4 (20%)"}
              </Label>
              <Input
                id="level4Threshold"
                name="level4Threshold"
                type="number"
                min={1}
                defaultValue={initialSettings.level4Threshold}
                className="h-8 text-xs font-mono"
                required
              />
              <p className="text-[10px] text-muted-foreground">{locale === "ar" ? "شريك مؤهل (الافتراضي: 300)" : locale === "en" ? "Qualified referrals (default: 300)" : "Filleuls qualifiés (défaut : 300)"}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="level5Threshold" className="text-xs">
                {locale === "ar" ? "عتبة المستوى 5 (30%)" : locale === "en" ? "Tier 5 Threshold (30%)" : "Seuil Niveau 5 (30%)"}
              </Label>
              <Input
                id="level5Threshold"
                name="level5Threshold"
                type="number"
                min={1}
                defaultValue={initialSettings.level5Threshold}
                className="h-8 text-xs font-mono"
                required
              />
              <p className="text-[10px] text-muted-foreground">{locale === "ar" ? "شريك مؤهل (الافتراضي: 900)" : locale === "en" ? "Qualified referrals (default: 900)" : "Filleuls qualifiés (défaut : 900)"}</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              size="sm"
              disabled={pending}
              className="gap-1.5 text-xs bg-primary"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {dict.common.save}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
