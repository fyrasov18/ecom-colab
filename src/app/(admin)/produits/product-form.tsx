"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { saveProduct, type ActionState } from "./actions";

export type ProductLike = {
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
  categoryId?: string | null;
  isWinning?: boolean;
  isNew?: boolean;
  isRecommended?: boolean;
};

export type CategoryOption = {
  id: string;
  name: string;
  nameAr?: string | null;
};

type Props = {
  product?: ProductLike;
  categories?: CategoryOption[];
};

const initialState: ActionState = { ok: false };

export function ProductForm({ product, categories = [] }: Props) {
  const { dict, locale } = useI18n();
  const [state, formAction] = useActionState(saveProduct, initialState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);

  const val = (v: unknown) => (v == null ? "" : String(v));

  return (
    <form action={formAction} className="space-y-6">
      {product && <input type="hidden" name="id" value={product.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">{dict.products.productName} *</Label>
          <Input id="name" name="name" required defaultValue={product?.name ?? ""} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="categoryId">{dict.products.category} *</Label>
          <NativeSelect
            id="categoryId"
            name="categoryId"
            required
            defaultValue={product?.categoryId ?? ""}
          >
            <option value="">— {dict.products.allCategories} —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {locale === "ar" && c.nameAr ? c.nameAr : c.name}
              </option>
            ))}
          </NativeSelect>
          <p className="text-[11px] text-muted-foreground">
            {dict.products.subtitle}
          </p>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">{dict.products.description}</Label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={product?.description ?? ""}
            className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchaseCost">{dict.products.purchaseCost} *</Label>
          <Input id="purchaseCost" name="purchaseCost" type="number" step="0.001" min="0" required defaultValue={val(product?.purchaseCost)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="packagingCost">{dict.products.packagingCost} *</Label>
          <Input id="packagingCost" name="packagingCost" type="number" step="0.001" min="0" required defaultValue={val(product?.packagingCost)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deliveryCost">{dict.products.deliveryCost} *</Label>
          <Input id="deliveryCost" name="deliveryCost" type="number" step="0.001" min="0" required defaultValue={val(product?.deliveryCost)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sellingPrice">{dict.products.sellingPrice} *</Label>
          <Input id="sellingPrice" name="sellingPrice" type="number" step="0.001" min="0.001" required defaultValue={val(product?.sellingPrice)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stockQuantity">{dict.products.stock} *</Label>
          <Input id="stockQuantity" name="stockQuantity" type="number" step="1" min="0" required defaultValue={product?.stockQuantity ?? 0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lowStockThreshold">{dict.products.lowStockThreshold} *</Label>
          <Input id="lowStockThreshold" name="lowStockThreshold" type="number" step="1" min="0" required defaultValue={product?.lowStockThreshold ?? 5} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">{dict.products.status}</Label>
          <NativeSelect id="status" name="status" defaultValue={product?.status ?? "ACTIVE"}>
            <option value="ACTIVE">{dict.statuses.product.ACTIVE}</option>
            <option value="INACTIVE">{dict.statuses.product.INACTIVE}</option>
            <option value="OUT_OF_STOCK">{dict.statuses.product.OUT_OF_STOCK}</option>
            <option value="ARCHIVED">{dict.statuses.product.ARCHIVED}</option>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="commissionType">{dict.partners.commissionType}</Label>
          <NativeSelect id="commissionType" name="commissionType" defaultValue={product?.commissionType ?? ""}>
            <option value="">— {dict.nav.commissionRules} —</option>
            <option value="PERCENTAGE">{dict.partners.percentage}</option>
            <option value="FIXED">{dict.partners.fixed}</option>
          </NativeSelect>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="commissionValue">{dict.partners.commissionValue}</Label>
          <Input id="commissionValue" name="commissionValue" type="number" step="0.001" min="0" defaultValue={val(product?.commissionValue)} placeholder="—" />
        </div>

        {/* Discovery & Promotion Flags */}
        <div className="space-y-3 sm:col-span-2 pt-4 border-t">
          <div>
            <Label className="text-sm font-semibold text-foreground">
              {dict.products.title}
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dict.products.subtitle}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-start gap-3 rounded-lg border bg-card p-3.5 hover:bg-muted/40 cursor-pointer transition-colors shadow-2xs">
              <input
                type="checkbox"
                name="isWinning"
                value="true"
                defaultChecked={Boolean(product?.isWinning)}
                className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-primary"
              />
              <div className="space-y-0.5">
                <div className="text-sm font-medium flex items-center gap-1.5 text-foreground">
                  <span>⭐</span> {dict.products.isWinning}
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border bg-card p-3.5 hover:bg-muted/40 cursor-pointer transition-colors shadow-2xs">
              <input
                type="checkbox"
                name="isNew"
                value="true"
                defaultChecked={Boolean(product?.isNew)}
                className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-primary"
              />
              <div className="space-y-0.5">
                <div className="text-sm font-medium flex items-center gap-1.5 text-foreground">
                  <span>🆕</span> {dict.products.isNew}
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border bg-card p-3.5 hover:bg-muted/40 cursor-pointer transition-colors shadow-2xs">
              <input
                type="checkbox"
                name="isRecommended"
                value="true"
                defaultChecked={Boolean(product?.isRecommended)}
                className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-primary"
              />
              <div className="space-y-0.5">
                <div className="text-sm font-medium flex items-center gap-1.5 text-foreground">
                  <span>🔥</span> {dict.products.isRecommended}
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit">
          {product ? dict.common.save : dict.common.create}
        </Button>
      </div>
    </form>
  );
}
