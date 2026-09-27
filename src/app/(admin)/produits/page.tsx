import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Search } from "lucide-react";
import { listProducts } from "@/modules/products/service";
import { formatPrice } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Produits" };

const STATUS_BADGE: Record<string, "success" | "secondary" | "warning" | "destructive"> = {
  ACTIVE: "success",
  INACTIVE: "secondary",
  OUT_OF_STOCK: "warning",
  ARCHIVED: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  OUT_OF_STOCK: "Rupture",
  ARCHIVED: "Archivé",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const search = typeof sp.q === "string" ? sp.q : "";
  const status =
    sp.status === "ACTIVE" ||
    sp.status === "INACTIVE" ||
    sp.status === "OUT_OF_STOCK" ||
    sp.status === "ARCHIVED"
      ? sp.status
      : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const { items, total, totalPages } = await listProducts({ search, status, page });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produits</h1>
          <p className="text-sm text-muted-foreground">{total} produit(s)</p>
        </div>
        <Button asChild>
          <Link href="/produits/nouveau">
            <Plus className="h-4 w-4" /> Ajouter un produit
          </Link>
        </Button>
      </div>

      <form className="flex flex-wrap items-center gap-3" method="GET">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Rechercher par nom…"
            className="flex h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <NativeSelect name="status" defaultValue={status ?? ""} className="w-44">
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actif</option>
          <option value="INACTIVE">Inactif</option>
          <option value="OUT_OF_STOCK">Rupture de stock</option>
          <option value="ARCHIVED">Archivé</option>
        </NativeSelect>
        <Button type="submit" variant="outline" size="sm">
          Filtrer
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="Aucun produit trouvé"
          description="Modifiez vos filtres ou ajoutez votre premier produit."
          action={
            <Button asChild variant="outline">
              <Link href="/produits/nouveau">Ajouter un produit</Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead>Prix vente</TableHead>
                <TableHead>Coûts (achat+emball.+livr.)</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Partenaires</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => {
                const costs =
                  Number(p.purchaseCost) + Number(p.packagingCost) + Number(p.deliveryCost);
                const lowStock = p.stockQuantity <= p.lowStockThreshold;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">/{p.slug}</div>
                    </TableCell>
                    <TableCell className="font-medium">{formatPrice(p.sellingPrice)} DT</TableCell>
                    <TableCell className="text-muted-foreground">{formatPrice(costs)} DT</TableCell>
                    <TableCell>
                      <span className={lowStock ? "font-semibold text-amber-600" : ""}>
                        {p.stockQuantity}
                      </span>
                      {lowStock && (
                        <Badge variant="warning" className="ml-2">
                          Faible
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{p._count.partnerAssignations}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[p.status] ?? "secondary"}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/produits/${p.id}`}>Gérer</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} searchParams={sp} />
    </div>
  );
}

