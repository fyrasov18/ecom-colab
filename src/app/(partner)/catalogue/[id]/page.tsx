import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Download, Megaphone } from "lucide-react";
import { requireSession } from "@/lib/rbac";
import { getAssignedProduct } from "@/modules/products/partner-catalogue";
import { formatPrice } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CopyButton } from "./copy-button";

export const metadata: Metadata = { title: "Produit" };

const KIND_LABELS: Record<string, string> = {
  AD_COPY: "Argumentaire de vente",
  HOOK: "Hook d'accroche",
  CAPTION: "Caption à publier",
  DESCRIPTION: "Description produit",
  SCRIPT: "Script de vente",
  FAQ: "Questions fréquentes",
  CREATIVE: "Créa / visuel",
};

export default async function PartnerProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSession(["PARTNER"]);
  const assignment = await getAssignedProduct(user.partnerId!, id);
  const product = assignment.product;

  const images = product.media.filter((m) => m.type !== "VIDEO");
  const videos = product.media.filter((m) => m.type === "VIDEO");

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/catalogue">
            <ArrowLeft className="h-4 w-4" /> Retour au catalogue
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          {product.status === "OUT_OF_STOCK" && (
            <Badge variant="warning">Rupture de stock</Badge>
          )}
        </div>
        <p className="text-lg font-semibold text-primary">
          {formatPrice(product.sellingPrice)} DT
        </p>
      </div>

      {product.description && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {product.description}
        </p>
      )}

      {/* Media gallery */}
      {(images.length > 0 || videos.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Visuels &amp; vidéos</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {images.map((m) => (
              <a
                key={m.id}
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className="group relative overflow-hidden rounded-lg border"
                title="Ouvrir en plein écran"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" className="h-32 w-full object-cover transition group-hover:scale-105" />
              </a>
            ))}
            {videos.map((m) => (
              <video key={m.id} src={m.url} className="h-32 w-full rounded-lg border object-cover" controls muted />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {images.map((m) => (
              <a
                key={`dl-${m.id}`}
                href={m.url}
                download
                className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
              >
                <Download className="h-3 w-3" /> Télécharger
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Marketing kit */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Kit marketing</h2>
        </div>

        {product.marketingAssets.length === 0 ? (
          <EmptyState
            title="Kit marketing en préparation"
            description="L'équipe prépare des visuels et scripts de vente pour ce produit."
          />
        ) : (
          <div className="space-y-4">
            {product.marketingAssets.map((a) => (
              <Card key={a.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-sm">
                      <Badge variant="info" className="mr-2">
                        {KIND_LABELS[a.kind] ?? a.kind}
                      </Badge>
                      {a.title}
                    </CardTitle>
                    {a.content && <CopyButton text={a.content} />}
                  </div>
                </CardHeader>
                {a.content && (
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {a.content}
                    </p>
                  </CardContent>
                )}
                {a.mediaUrl && (
                  <CardContent className="pt-0">
                    <a
                      href={a.mediaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
                    >
                      <Download className="h-4 w-4" /> Ouvrir / télécharger le visuel
                    </a>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
