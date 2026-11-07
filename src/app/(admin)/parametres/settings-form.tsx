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
            Période de settlement, retraits, contribution minimale par commande et règles de partage.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
            <Label htmlFor="minOrderContribution">
              Contribution minimale (DT)
            </Label>
            <Input
              id="minOrderContribution"
              name="minOrderContribution"
              type="number"
              min={0}
              step="0.001"
              defaultValue={Number(getValue("finance.min_order_contribution") ?? 7.00)}
              disabled={!canEdit}
            />
            <p className="text-xs text-muted-foreground">
              Seuil brut minimum requis pour autoriser la création de commande (défaut : 7.00 DT).
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

          <div className="space-y-2 sm:col-span-2 lg:col-span-4">
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
                  )?.commissionValue ?? 30,
                )}
                disabled={!canEdit}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Niveau 4 de la hiérarchie : appliquée uniquement si ni assignation produit, ni admin partenaire, ni niveau de performance n&apos;est défini (défaut : 30%).
            </p>
          </div>

          <div className="space-y-2 sm:col-span-2 lg:col-span-4">
            <Label htmlFor="reason">
              Motif de la modification <span className="text-destructive">*</span>
            </Label>
            <Input
              id="reason"
              name="reason"
              placeholder="Ex : Révision trimestrielle des seuils financiers (min 5 caractères)"
              minLength={5}
              required={canEdit}
              disabled={!canEdit}
            />
            <p className="text-xs text-muted-foreground">
              Obligatoire pour toute modification — enregistré de manière immuable dans le journal d&apos;audit.
            </p>
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
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
                Modification réservée aux utilisateurs disposant de la permission MANAGE_CONTRIBUTION_SETTINGS.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
