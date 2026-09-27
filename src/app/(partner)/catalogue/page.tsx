import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { requireSession } from "@/lib/rbac";
import { listAssignedProducts } from "@/modules/products/partner-catalogue";
import { formatPrice } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Produits" };

export default async function CataloguePage() {
  const user = await requireSession(["PARTNER"]);
  const assignments = await listAssignedProducts(user.partnerId!);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Produits</h1>
        <p className="text-sm text-muted-foreground">
          {assignments.length} produit(s) vous sont assignés — avec leur kit marketing
          prêt à l&apos;emploi.
        </p>
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          title="Aucun produit assigné pour le moment"
          description="L'équipe vous assignera des produits prochainement. Vous pourrez alors les promouvoir sur vos réseaux."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map(({ product }) => {
            const cover = product.media.find((m) => m.type === "THUMBNAIL")
              ?? product.media.find((m) => m.type === "IMAGE");
            return (
              <Link key={product.id} href={`/catalogue/${product.id}`} className="group">
                <Card className="h-full transition-shadow group-hover:shadow-md">
                  <div className="relative h-40 overflow-hidden rounded-t-xl bg-muted">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover.url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        Aucune image
                      </div>
                    )}
                    {product.status === "OUT_OF_STOCK" && (
                      <Badge variant="warning" className="absolute left-2 top-2">
                        Rupture de stock
                      </Badge>
                    )}
                  </div>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-medium leading-tight">{product.name}</h2>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {product.description ?? ""}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-semibold">
                        {formatPrice(product.sellingPrice)} DT
                      </span>
                      <Badge variant="info">
                        {product.marketingAssets.length} élément(s) kit
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

