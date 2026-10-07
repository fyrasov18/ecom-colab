import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { listPartners } from "@/modules/partners/service";
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

export const metadata: Metadata = { title: "Partenaires" };

const STATUS_BADGE: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  ACTIVE: "success",
  PENDING: "warning",
  SUSPENDED: "warning",
  REJECTED: "destructive",
  CLOSED: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Actif",
  PENDING: "En attente",
  SUSPENDED: "Suspendu",
  REJECTED: "Rejeté",
  CLOSED: "Fermé",
};

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const search = typeof sp.q === "string" ? sp.q : "";
  const status =
    sp.status === "ACTIVE" ||
    sp.status === "PENDING" ||
    sp.status === "SUSPENDED" ||
    sp.status === "REJECTED" ||
    sp.status === "CLOSED"
      ? sp.status
      : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const { items, total, totalPages } = await listPartners({ search, status, page });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Partenaires</h1>
        <p className="text-sm text-muted-foreground">{total} partenaire(s)</p>
      </div>

      <form className="flex flex-wrap items-center gap-3" method="GET">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Nom, code ou e-mail…"
            className="flex h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <NativeSelect name="status" defaultValue={status ?? ""} className="w-44">
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actif</option>
          <option value="PENDING">En attente</option>
          <option value="SUSPENDED">Suspendu</option>
          <option value="REJECTED">Rejeté</option>
          <option value="CLOSED">Fermé</option>
        </NativeSelect>
        <Button type="submit" variant="outline" size="sm">
          Filtrer
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState title="Aucun partenaire trouvé" description="Modifiez vos filtres." />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partenaire</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Produits</TableHead>
                <TableHead>Commandes</TableHead>
                <TableHead>Solde disponible</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.displayName}</div>
                    <div className="text-xs text-muted-foreground">{p.code}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.user.email}</TableCell>
                  <TableCell>{p._count.assignedProducts}</TableCell>
                  <TableCell>{p._count.orders}</TableCell>
                  <TableCell>
                    {p.wallet ? `${formatPrice(p.wallet.availableBalance)} DT` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[p.status] ?? "secondary"}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/partenaires/${p.id}`}>Voir</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} searchParams={sp} />
    </div>
  );
}

