"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
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
import { saveFinanceSettings, type SettingsState } from "./actions";

type SettingDTO = {
  key: string;
  description: string;
  value: unknown;
};

const initialState: SettingsState = { ok: false };

export function FinanceSettingsForm({
  settings,
  canEdit,
}: {
  settings: SettingDTO[];
  canEdit: boolean;
}) {
  const getValue = (key: string) =>
    settings.find((s) => s.key === key)?.value;

  const [state, formAction, pending] = useActionState(
    saveFinanceSettings,
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
          <CardTitle className="text-base">Finance</CardTitle>
          <CardDescription>
            Période de settlement des gains, montant minimum de retrait et
            règle de coût de retour.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="settlementPeriodHours">
              Période de settlement (heures)
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
              Appliquée à la livraison. Les commandes déjà livrées ne sont pas
              affectées.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="minWithdrawalAmount">
              Retrait minimum (DT)
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
              En dessous de ce montant, aucun retrait ne peut être demandé.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="returnCostRule">Règle de coût retour/refus</Label>
            <NativeSelect
              id="returnCostRule"
              name="returnCostRule"
              defaultValue={String(
                getValue("finance.return_cost_rule") ??
                  "REVERSE_PENDING_EARNING",
              )}
              disabled={!canEdit}
            >
              <option value="REVERSE_PENDING_EARNING">
                Réverser le gain en attente (défaut, livraison à la plateforme)
              </option>
              <option value="REVERSE_PLUS_DELIVERY">
                Réverser le gain + facturer la livraison au partenaire
              </option>
              <option value="NO_COST">Aucun coût partenaire</option>
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              Appliquée lors des retours et refus.
            </p>
          </div>

          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="globalCommissionType">
              Commission globale par défaut
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
                <option value="PERCENTAGE">Pourcentage (%)</option>
                <option value="FIXED">Montant fixe (DT)</option>
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
                  )?.commissionValue ?? 60,
                )}
                disabled={!canEdit}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Utilisée uniquement si aucune règle plus précise (assignment →
              partenaire → produit) ne s&apos;applique. Les commandes existantes
              conservent la commission figée à leur création.
            </p>
          </div>

          <div className="sm:col-span-3">
            <Button type="submit" disabled={pending || !canEdit}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Enregistrer les paramètres
            </Button>
            {!canEdit && (
              <p className="mt-2 text-xs text-muted-foreground">
                Modification réservée au Super Admin.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
