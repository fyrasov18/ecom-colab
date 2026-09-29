import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PackageCheck } from "lucide-react";
import { getProductAdmin } from "@/modules/products/service";
import { listPartnerOptions } from "@/modules/partners/service";
import { requireSession } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductForm } from "../product-form";
import { changeProductStatus } from "../actions";
import { MediaSection } from "./media-section";
import { MarketingSection } from "./marketing-section";
import { AssignmentsSection } from "./assignments-section";

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
  const [product, partnerRows] = await Promise.all([
    getProductAdmin(id),
    listPartnerOptions(),
  ]);
  if (!product) notFound();

  const partners = partnerRows.map((p) => ({
    id: p.id,
    displayName: `${p.displayName} (${p.code})`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
            <Badge variant={STATUS_BADGE[product.status] ?? "secondary"}>
              {product.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            /{product.slug} · {product._count.orderItems} commande(s) utilisant ce produit
          </p>
        </div>
        <form action={changeProductStatus} className="flex items-center gap-2">
          <input type="hidden" name="id" value={product.id} />
          <select
            name="status"
            defaultValue={product.status}
            className="flex h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="ACTIVE">Actif</option>
            <option value="INACTIVE">Inactif</option>
            <option value="OUT_OF_STOCK">Rupture de stock</option>
            <option value="ARCHIVED">Archivé</option>
          </select>
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md border border-input bg-card px-3 text-sm font-medium shadow-sm hover:bg-accent"
          >
            Appliquer
          </button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations &amp; tarification</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm product={product} />
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

      <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
        <PackageCheck className="h-4 w-4 shrink-0 text-primary" />
        Analyse de rentabilité détaillée (marge, taux de retour, tendances) arrive en
        Phase 6 — les commandes existent réellement à partir de la Phase 3.
      </div>
    </div>
  );
}
