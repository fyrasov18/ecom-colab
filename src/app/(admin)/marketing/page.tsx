import Link from "next/link";
import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { listProductsWithMarketing } from "@/modules/marketing/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Marketing" };

const KIND_LABELS: Record<string, string> = {
  AD_COPY: "Argumentaire",
  HOOK: "Hook",
  CAPTION: "Caption",
  DESCRIPTION: "Description",
  SCRIPT: "Script",
  FAQ: "FAQ",
  CREATIVE: "Créa",
};

export default async function MarketingPage() {
  const products = await listProductsWithMarketing();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Marketing</h1>
        <p className="text-sm text-muted-foreground">
          Kit marketing par produit : visuels, argumentaires, hooks, scripts, FAQ —
          accessibles par les partenaires assignés.
        </p>
      </div>

      {products.length === 0 ? (
        <EmptyState title="Aucun produit" description="Ajoutez d'abord des produits." />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead>Médias</TableHead>
                <TableHead>Éléments kit</TableHead>
                <TableHead>Types présents</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.mediaCount}</TableCell>
                  <TableCell>
                    {p.assetCount === 0 ? (
                      <Badge variant="warning">Kit vide</Badge>
                    ) : (
                      <Badge variant="success">{p.assetCount}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.kinds.map((k) => (
                        <Badge key={k} variant="info" className="text-[10px]">
                          {KIND_LABELS[k] ?? k}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/produits/${p.id}#marketing`}>Gérer le kit</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
        <Megaphone className="h-4 w-4 shrink-0 text-primary" />
        Les éléments ajoutés ici apparaissent immédiatement dans le catalogue du
        partenaire assigné.
      </div>
    </div>
  );
}

