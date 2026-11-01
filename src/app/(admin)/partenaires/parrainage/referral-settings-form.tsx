"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
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
          Configuration dynamique des 5 Niveaux & Qualification
        </CardTitle>
        <CardDescription>
          Ajustez les seuils de progression et le nombre de commandes nécessaires pour qualifier un filleul sans modifier le code.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="requiredOrdersToQualify" className="text-xs">
                Commandes / qualification
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
              <p className="text-[10px] text-muted-foreground">Ex: 3 commandes livrées</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="level2Threshold" className="text-xs">
                Seuil Niveau 2 (7%)
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
              <p className="text-[10px] text-muted-foreground">Filleuls qualifiés (défaut : 10)</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="level3Threshold" className="text-xs">
                Seuil Niveau 3 (15%)
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
              <p className="text-[10px] text-muted-foreground">Filleuls qualifiés (défaut : 100)</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="level4Threshold" className="text-xs">
                Seuil Niveau 4 (20%)
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
              <p className="text-[10px] text-muted-foreground">Filleuls qualifiés (défaut : 300)</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="level5Threshold" className="text-xs">
                Seuil Niveau 5 (30%)
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
              <p className="text-[10px] text-muted-foreground">Filleuls qualifiés (défaut : 900)</p>
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
              Enregistrer les paramètres
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
