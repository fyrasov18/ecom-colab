import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PackageCheck } from "lucide-react";
import { getProductAdmin } from "@/modules/products/service";
import { listPartnerOptions } from "@/modules/partners/service";
import { listActiveCategories } from "@/modules/categories/service";
import { listPerformanceLevels } from "@/modules/finance/performance-service";
import { requireSession } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductForm } from "../product-form";
import { changeProductStatus } from "../actions";
import { MediaSection } from "./media-section";
import { MarketingSection } from "./marketing-section";
import { AssignmentsSection } from "./assignments-section";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = { title: "Produit" };

const STATUS_BADGE: Record<string, "success" | "secondary" | "warning" | "destructive"> = {
  ACTIVE: "success",
  INACTIVE: "secondary",
  OUT_OF_STOCK: "warning",
  ARCHIVED: "destructive",
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const [product, partnerRows, categories, levelRows] = await Promise.all([
    getProductAdmin(id),
    listPartnerOptions(),
    listActiveCategories(),
    listPerformanceLevels({ includeInactive: false }),
  ]);
  if (!product) notFound();

  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.products;
  const c = dict.common;

  const partners = partnerRows.map((p) => ({
    id: p.id,
    displayName: `${p.displayName} (${p.code})`,
    performanceLevelId: p.performanceLevelId ?? null,
  }));

  const levels = levelRows.map((l) => ({
    id: l.id,
    name: l.name,
    sharePercentage: l.sharePercentage.toString(),
  }));

  const statusLabel = dict.statuses?.product?.[product.status as keyof typeof dict.statuses.product] ?? product.status;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
            <Badge variant={STATUS_BADGE[product.status] ?? "secondary"}>
              {statusLabel}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            /{product.slug} · {product._count.orderItems} {locale === "ar" ? "طلب يستخدم هذا المنتج" : locale === "en" ? "order(s) using this product" : "commande(s) utilisant ce produit"}
          </p>
        </div>
        <form action={changeProductStatus} className="flex items-center gap-2">
          <input type="hidden" name="id" value={product.id} />
          <select
            name="status"
            defaultValue={product.status}
            className="flex h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="ACTIVE">{dict.statuses.product.ACTIVE}</option>
            <option value="INACTIVE">{dict.statuses.product.INACTIVE}</option>
            <option value="OUT_OF_STOCK">{dict.statuses.product.OUT_OF_STOCK}</option>
            <option value="ARCHIVED">{dict.statuses.product.ARCHIVED}</option>
          </select>
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md border border-input bg-card px-3 text-sm font-medium shadow-sm hover:bg-accent"
          >
            {c.apply}
          </button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.pricingDetails}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm product={product} categories={categories} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6 p-6">
          <MediaSection
            productId={product.id}
            media={product.media.map((m) => ({
              id: m.id,
              type: m.type,
              googleDriveUrl: m.googleDriveUrl,
              title: m.title,
              sortOrder: m.sortOrder,
            }))}
          />
          <MarketingSection
            productId={product.id}
            assets={product.marketingAssets.map((a) => ({
              id: a.id,
              kind: a.kind,
              title: a.title,
              content: a.content,
              mediaUrl: a.mediaUrl,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6 p-6">
          <AssignmentsSection
            productId={product.id}
            partners={partners}
            levels={levels}
            canEditCommission={user.role === "SUPER_ADMIN"}
            assigned={product.partnerAssignations
              .filter((a) => a.status === "ACTIVE")
              .map((a) => ({
                partnerId: a.partnerId,
                commissionType: a.commissionType,
                commissionValue: a.commissionValue,
                partner: { displayName: `${a.partner.displayName} (${a.partner.code})` },
              }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
