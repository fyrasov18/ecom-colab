"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { d } from "@/lib/money";
import { useI18n } from "@/lib/i18n";
import type { CommissionSource } from "@prisma/client";
import {
  calculateOrderContribution,
  type ContributionCalculationResult,
} from "@/modules/finance/contribution-engine";
import { GOVERNORATES } from "@/modules/orders/schemas";
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
  performanceLevelName?: string | null;
};

const initialState: OrderActionState = { ok: false };

function getSourceLabel(source: string, levelName?: string | null) {
  switch (source) {
    case "PARTNER_PRODUCT":
      return "produit personnalisé";
    case "PARTNER":
      return "admin partenaire";
    case "PERFORMANCE_LEVEL":
      return levelName ? `niveau ${levelName}` : "niveau de performance";
    case "GLOBAL":
      return "défaut global";
    default:
      return source;
  }
}

export function OrderForm({
  products,
  minContribution = 7,
}: {
  products: ProductOption[];
  minContribution?: number;
}) {
  const { t, formatMoney } = useI18n();
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitOrder, initialState);

  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [confirmed, setConfirmed] = useState(false);

  const product = products.find((p) => p.id === productId);

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Commande enregistrée.");
      router.push("/mes-commandes");
      router.refresh();
    }
    if (!state.ok && state.error) toast.error(state.error);
  }, [state, router]);

  // Pure canonical contribution calculation
  const calculation: ContributionCalculationResult | null = useMemo(() => {
    if (!product || quantity < 1) return null;
    return calculateOrderContribution({
      sellingPrice: product.sellingPrice,
      quantity,
      purchaseCost: product.purchaseCost,
      packagingCost: product.packagingCost,
      deliveryCost: product.deliveryCost,
      discount: 0,
      minContributionThreshold: minContribution,
      rateRule: {
        type: product.commissionType,
        rate: d(product.commissionValue),
        source: product.commissionSource as CommissionSource,
        performanceLevelId: null,
        performanceLevelName: product.performanceLevelName ?? null,
      },
    });
  }, [product, quantity, minContribution]);

  return (
    <form action={formAction} className="grid gap-5 lg:grid-cols-5">
      {/* ── Fields ── */}
      <div className="space-y-4 lg:col-span-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("orders.productAndConditions")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="productId">{t("orders.productLabel")}</Label>
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
              <Label htmlFor="quantity">{t("orders.quantityLabel")}</Label>
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
                  {t("orders.stockAvailable", { stock: product.stockQuantity })}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t("orders.catalogPrice")}</Label>
              <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 py-1 text-sm font-semibold shadow-sm">
                {formatMoney(product?.sellingPrice ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("orders.fixedCatalogPriceNotice")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("orders.customerInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customerFullName">{t("orders.fullName")}</Label>
              <Input id="customerFullName" name="customerFullName" required maxLength={160} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t("orders.phoneLabel")}</Label>
              <Input id="phone" name="phone" required placeholder="22333444" maxLength={20} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="governorate">{t("orders.governorate")}</Label>
              <NativeSelect id="governorate" name="governorate" defaultValue="">
                <option value="" disabled>
                  {t("orders.chooseGovernorate")}
                </option>
                {GOVERNORATES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">{t("orders.city")}</Label>
              <Input id="city" name="city" required maxLength={80} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">{t("orders.fullAddress")}</Label>
              <Input id="address" name="address" required maxLength={400} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">{t("orders.notes")}</Label>
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
              <ShieldCheck className="h-4 w-4 text-primary" /> {t("orders.recap")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label={t("orders.productLabel").replace(" *", "")} value={product?.name ?? "—"} />
            <Row label={t("orders.quantityLabel").replace(" *", "")} value={String(quantity)} />
            <Row
              label={t("orders.catalogPrice")}
              value={`${formatMoney(product?.sellingPrice ?? 0)} × ${quantity}`}
            />
            <div className="my-2 border-t" />
            {calculation && (
              <>
                <Row label={t("orders.revenue")} value={formatMoney(calculation.revenue)} />
                <Row label={t("orders.productCost")} value={`− ${formatMoney(calculation.productCost)}`} />
                <Row
                  label={t("orders.packagingCost")}
                  value={`− ${formatMoney(calculation.packagingCostTotal)}`}
                />
                <Row
                  label={t("orders.deliveryCost")}
                  value={`− ${formatMoney(calculation.deliveryCostTotal)}`}
                />
                <Row
                  label={t("orders.contribution")}
                  value={formatMoney(calculation.contribution)}
                  bold
                />
                <Row
                  label={t("orders.minThresholdRequired")}
                  value={`> ${formatMoney(calculation.minContributionThreshold)}`}
                />
                <div className="my-2 border-t" />
                {calculation.isEligible ? (
                  <>
                    <Row
                      label={t("orders.partnerEarning")}
                      value={formatMoney(calculation.partnerEarning)}
                      bold
                      highlight
                    />
                    <Row
                      label={t("orders.platformShare")}
                      value={formatMoney(calculation.platformShare)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {product?.commissionType === "PERCENTAGE"
                        ? `${product.commissionValue} %`
                        : `Forfait ${formatMoney(product?.commissionValue ?? 0)}`}{" "}
                      ({getSourceLabel(product?.commissionSource ?? "", product?.performanceLevelName)})
                    </p>
                  </>
                ) : (
                  <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                    <div className="flex items-center gap-1.5 font-medium">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{t("orders.insufficientContributionTitle")}</span>
                    </div>
                    <p className="mt-1 leading-relaxed">
                      {t("orders.insufficientContributionDesc", {
                        contribution: formatMoney(calculation.contribution),
                        threshold: formatMoney(minContribution),
                      })}
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="my-3 border-t" />
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
              <Checkbox
                checked={confirmed}
                onCheckedChange={(v) => setConfirmed(v === true)}
                className="mt-0.5"
                aria-label={t("orders.confirmationCheckbox")}
              />
              <span className="text-xs leading-relaxed">
                <strong>{t("orders.confirmationCheckbox")}</strong>
              </span>
            </label>
            <input type="hidden" name="confirmed" value={confirmed ? "on" : ""} />
            <input
              type="hidden"
              name="previewSnapshot"
              value={calculation ? JSON.stringify(calculation.snapshot) : ""}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={pending || !confirmed || !calculation || !calculation.isEligible}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("orders.confirmSubmitButton")}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              {t("orders.initialStatusNotice")}
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
