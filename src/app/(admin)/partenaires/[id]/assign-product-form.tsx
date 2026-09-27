"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assignProduct, type ActionState } from "../actions";

type ProductOption = { id: string; name: string };

const initialState: ActionState = { ok: false };

export function AssignProductForm({
  partnerId,
  products,
  canEditCommission,
}: {
  partnerId: string;
  products: ProductOption[];
  canEditCommission: boolean;
}) {
  const [state, formAction] = useActionState(assignProduct, initialState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);

  if (products.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Tous les produits disponibles sont déjà assignés à ce partenaire.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <input type="hidden" name="partnerId" value={partnerId} />
      <div className="min-w-56 flex-1 space-y-1.5">
        <Label htmlFor="ap-product">Produit</Label>
        <NativeSelect id="ap-product" name="productId">
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ap-ctype">Commission</Label>
        <NativeSelect id="ap-ctype" name="commissionType" defaultValue="" className="w-44">
          <option value="">Règle par défaut</option>
          <option value="PERCENTAGE">Pourcentage (%)</option>
          <option value="FIXED">Fixe (DT)</option>
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ap-cvalue">Valeur</Label>
        <Input id="ap-cvalue" name="commissionValue" type="number" step="0.001" min="0" className="w-32" placeholder="—" />
      </div>
      <Button type="submit" variant="outline">
        <UserPlus className="h-4 w-4" /> Assigner
      </Button>
      {!canEditCommission && (
        <p className="w-full text-xs text-muted-foreground">
          La surcharge de commission nécessite un Super Admin.
        </p>
      )}
    </form>
  );
}
