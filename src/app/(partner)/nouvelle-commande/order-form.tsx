"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import { computePartnerEarning } from "@/modules/finance/commission";
import { d } from "@/lib/money";
import { GOVERNORATES, CONFIRMATION_TEXT } from "@/modules/orders/schemas";
import { submitOrder, type OrderActionState } from "../actions";

type ProductOption = {
  id: string;
  name: string;
  description: string | null;
  sellingPrice: number;
  purchaseCost: number;
  packagingCost: number;
  deliveryCost: number;
  stockQuantity: number;
  commissionType: "PERCENTAGE" | "FIXED";
  commissionValue: number;
  commissionSource: string;
};

const initialState: OrderActionState = { ok: false };

export function OrderForm({ products }: { products: ProductOption[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitOrder, initialState);

  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(products[0]?.sellingPrice ?? 0);
  const [confirmed, setConfirmed] = useState(false);

  const product = products.find((p) => p.id === productId);

  useEffect(() => {
    if (product) setPrice(product.sellingPrice);
  }, [product]);

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Commande enregistrée.");
      router.push("/mes-commandes");
      router.refresh();
    }
    if (!state.ok && state.error) toast.error(state.error);
  }, [state, router]);

  // Same pure math as the server — single source of truth (commission.ts).
  const estimate = useMemo(() => {
    if (!product || quantity < 1 || price <= 0) return null;
    const revenue = d(price).times(quantity);
    const productCost = d(product.purchaseCost).times(quantity);
    const packaging = d(product.packagingCost).times(quantity);
    const delivery = d(product.deliveryCost);
    const contribution = revenue.minus(productCost).minus(packaging).minus(delivery);
    if (contribution.lte(0)) return { invalid: true as const, min: productCost.plus(packaging).plus(delivery) };
    const { earning, platformShare } = computePartnerEarning(contribution, {
      type: product.commissionType,
      value: d(product.commissionValue),
      source: product.commissionSource as never,
    });
    return { invalid: false as const, revenue, productCost, packaging, delivery, contribution, earning, platformShare };
  }, [product, quantity, price]);

  return (
    <form action={formAction} className="grid gap-5 lg:grid-cols-5">
      {/* ── Fields ── */}
      <div className="space-y-4 lg:col-span-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Produit &amp; prix</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="productId">Produit *</Label>
              <NativeSelect
                id="productId"
                name="productId"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — stock {p.stockQuantity}
                  </option>
                ))}
              </NativeSelect>
              {product?.description && (
                <p className="text-xs text-muted-foreground">{product.description}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantité *</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min={1}
                max={99}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                required
              />
              {product && quantity > product.stockQuantity && (
                <p className="text-xs text-destructive">
                  Stock disponible : {product.stockQuantity}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellingPrice">Prix de vente unitaire (DT) *</Label>
              <Input
                id="sellingPrice"
                name="sellingPrice"
                type="number"
                step="0.001"
                min="0.001"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value) || 0)}
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Client</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customerFullName">Nom complet *</Label>
              <Input id="customerFullName" name="customerFullName" required maxLength={160} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone (8 chiffres) *</Label>
              <Input id="phone" name="phone" required placeholder="22333444" maxLength={20} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="governorate">Gouvernorat *</Label>
              <NativeSelect id="governorate" name="governorate" defaultValue="">
                <option value="" disabled>
                  Choisir…
                </option>
                {GOVERNORATES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Ville *</Label>
              <Input id="city" name="city" required maxLength={80} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Adresse complète *</Label>
              <Input id="address" name="address" required maxLength={400} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Notes (optionnel)</Label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                maxLength={2000}
                className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Recap ── */}
      <div className="space-y-4 lg:col-span-2">
        <Card className="sticky top-20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" /> Récapitulatif
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Produit" value={product?.name ?? "—"} />
            <Row label="Quantité" value={String(quantity)} />
            <Row label="Prix de vente" value={`${formatPrice(price)} DT × ${quantity}`} />
            <div className="my-2 border-t" />
            {estimate && !estimate.invalid && (
              <>
                <Row label="Chiffre d'affaires" value={`${formatPrice(estimate.revenue)} DT`} />
                <Row label="Coût produit" value={`− ${formatPrice(estimate.productCost)} DT`} />
                <Row label="Emballage" value={`− ${formatPrice(estimate.packaging)} DT`} />
                <Row label="Livraison" value={`− ${formatPrice(estimate.delivery)} DT`} />
                <Row label="Contribution" value={`${formatPrice(estimate.contribution)} DT`} bold />
                <div className="my-2 border-t" />
                <Row
                  label="Votre gain estimé"
                  value={`${formatPrice(estimate.earning)} DT`}
                  bold
                  highlight
                />
                <p className="text-xs text-muted-foreground">
                  {product?.commissionType === "PERCENTAGE"
                    ? `${product.commissionValue} % de la contribution`
                    : `Forfait ${product?.commissionValue} DT`}
                </p>
              </>
            )}
            {estimate?.invalid && (
              <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                Prix de vente trop bas : minimum {formatPrice(estimate.min)} DT pour
                couvrir les coûts.
              </p>
            )}
            <div className="my-3 border-t" />
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
              <Checkbox
                checked={confirmed}
                onCheckedChange={(v) => setConfirmed(v === true)}
                className="mt-0.5"
                aria-label={CONFIRMATION_TEXT}
              />
              <span className="text-xs leading-relaxed">
                <strong>{CONFIRMATION_TEXT}</strong>
              </span>
            </label>
            <input type="hidden" name="confirmed" value={confirmed ? "on" : ""} />
            <Button
              type="submit"
              className="w-full"
              disabled={pending || !confirmed || !estimate || estimate.invalid}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmer et enregistrer la commande
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Statut initial : <strong>Confirmée</strong> — puis gérée par les
              opérations.
            </p>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

function Row({
  label,
  value,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(bold && "font-semibold", highlight && "font-semibold text-primary")}>
        {value}
      </span>
    </div>
  );
}


