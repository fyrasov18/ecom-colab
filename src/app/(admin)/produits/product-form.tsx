"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { saveProduct, type ActionState } from "./actions";

type ProductLike = {
  id: string;
  name: string;
  description: string | null;
  purchaseCost: unknown;
  packagingCost: unknown;
  deliveryCost: unknown;
  sellingPrice: unknown;
  stockQuantity: number;
  lowStockThreshold: number;
  status: string;
  commissionType: string | null;
  commissionValue: unknown;
};

const initialState: ActionState = { ok: false };

export function ProductForm({ product }: { product?: ProductLike }) {
  const [state, formAction] = useActionState(saveProduct, initialState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);

  const val = (v: unknown) => (v == null ? "" : String(v));

  return (
    <form action={formAction} className="space-y-4">
      {product && <input type="hidden" name="id" value={product.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Nom du produit *</Label>
          <Input id="name" name="name" required defaultValue={product?.name ?? ""} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={product?.description ?? ""}
            className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchaseCost">Prix d&apos;achat (DT) *</Label>
          <Input id="purchaseCost" name="purchaseCost" type="number" step="0.001" min="0" required defaultValue={val(product?.purchaseCost)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="packagingCost">Emballage (DT) *</Label>
          <Input id="packagingCost" name="packagingCost" type="number" step="0.001" min="0" required defaultValue={val(product?.packagingCost)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deliveryCost">Livraison (DT) *</Label>
          <Input id="deliveryCost" name="deliveryCost" type="number" step="0.001" min="0" required defaultValue={val(product?.deliveryCost)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sellingPrice">Prix de vente conseillé (DT) *</Label>
          <Input id="sellingPrice" name="sellingPrice" type="number" step="0.001" min="0.001" required defaultValue={val(product?.sellingPrice)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stockQuantity">Stock *</Label>
          <Input id="stockQuantity" name="stockQuantity" type="number" step="1" min="0" required defaultValue={product?.stockQuantity ?? 0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lowStockThreshold">Seuil stock faible *</Label>
          <Input id="lowStockThreshold" name="lowStockThreshold" type="number" step="1" min="0" required defaultValue={product?.lowStockThreshold ?? 5} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Statut</Label>
          <NativeSelect id="status" name="status" defaultValue={product?.status ?? "ACTIVE"}>
            <option value="ACTIVE">Actif</option>
            <option value="INACTIVE">Inactif</option>
            <option value="OUT_OF_STOCK">Rupture de stock</option>
            <option value="ARCHIVED">Archivé</option>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="commissionType">Commission produit (optionnel)</Label>
          <NativeSelect id="commissionType" name="commissionType" defaultValue={product?.commissionType ?? ""}>
            <option value="">— Règle globale / partenaire —</option>
            <option value="PERCENTAGE">Pourcentage (%)</option>
            <option value="FIXED">Montant fixe (DT)</option>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="commissionValue">Valeur de la commission</Label>
          <Input id="commissionValue" name="commissionValue" type="number" step="0.001" min="0" defaultValue={val(product?.commissionValue)} placeholder="vide = règle globale" />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit">
          {product ? "Enregistrer les modifications" : "Créer le produit"}
        </Button>
      </div>
    </form>
  );
}
