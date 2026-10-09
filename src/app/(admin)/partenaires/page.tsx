import Link from "next/link";
import type { Metadata } from "next";
import { Search, Clock, CheckCircle2, XCircle, Ban, Archive, UserCheck } from "lucide-react";
import { listPartners } from "@/modules/partners/service";
import { formatPrice } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import { Pagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Partenaires" };

type PartnerStatus = "ACTIVE" | "PENDING" | "SUSPENDED" | "REJECTED" | "CLOSED";

const STATUS_BADGE: Record<
  PartnerStatus,
  "success" | "warning" | "destructive" | "secondary" | "info"
> = {
  ACTIVE: "success",
  PENDING: "warning",
  SUSPENDED: "info",
  REJECTED: "destructive",
  CLOSED: "secondary",
};

const STATUS_LABEL: Record<PartnerStatus, string> = {
  ACTIVE: "Actif",
  PENDING: "En attente",
  SUSPENDED: "Suspendu",
  REJECTED: "Rejeté",
  CLOSED: "Fermé",
};

const STATUS_ICON: Record<PartnerStatus, React.ComponentType<{ className?: string }>> = {
  ACTIVE: CheckCircle2,
  PENDING: Clock,
  SUSPENDED: Ban,
  REJECTED: XCircle,
  CLOSED: Archive,
};

function PartnerStatusBadge({ status }: { status: string }) {
  const s = status as PartnerStatus;
  const Icon = STATUS_ICON[s];
  return (
    <Badge variant={STATUS_BADGE[s] ?? "secondary"} className="gap-1.5">
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {STATUS_LABEL[s] ?? status}
    </Badge>
  );
}

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

  // Count all pending across pages (not just current page) — use total context
  const pendingOnPage = items.filter((p) => p.status === "PENDING").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Partenaires"
        description={`${total} partenaire(s) au total`}
      />

      {/* Pending alert — only when not already filtering by PENDING */}
      {!status && pendingOnPage > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 shrink-0 text-warning-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-warning-700">
                {pendingOnPage} partenaire{pendingOnPage > 1 ? "s" : ""} en attente
                {pendingOnPage > 1 ? " sur cette page" : ""}
              </p>
              <p className="text-xs text-warning-600 mt-0.5">
                Approuvez ou rejetez les demandes en attente.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href="?status=PENDING">
              <UserCheck className="h-4 w-4 mr-1.5" />
              Afficher les demandes
            </Link>
          </Button>
        </div>
      )}

      {/* Filters */}
      <form className="flex flex-wrap items-end gap-3" method="GET" role="search">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Nom, code ou e-mail…"
            className="pl-8"
            aria-label="Rechercher des partenaires"
          />
        </div>
        <NativeSelect
          name="status"
          defaultValue={status ?? ""}
          className="w-44"
          aria-label="Filtrer par statut"
        >
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
        {(search || status) && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/partenaires">Réinitialiser</Link>
          </Button>
        )}
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="Aucun partenaire trouvé"
          description={
            search || status
              ? "Aucun résultat pour ces filtres. Modifiez votre recherche."
              : "Les partenaires inscrits apparaîtront ici."
          }
          action={
            (search || status) ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/partenaires">Réinitialiser les filtres</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partenaire</TableHead>
                <TableHead className="hidden md:table-cell">E-mail</TableHead>
                <TableHead className="hidden lg:table-cell">Produits</TableHead>
                <TableHead className="hidden lg:table-cell">Commandes</TableHead>
                <TableHead className="hidden xl:table-cell">Solde disponible</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow
                  key={p.id}
                  className={cn(
                    p.status === "PENDING" && "border-l-4 border-l-warning bg-warning/5",
                  )}
                >
                  <TableCell>
                    <div className="font-medium">{p.displayName}</div>
                    <div className="text-xs text-muted-foreground">{p.code}</div>
                    <div className="text-xs text-muted-foreground md:hidden">
                      {p.user.email}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {p.user.email}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {p._count.assignedProducts}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {p._count.orders}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {p.wallet
                      ? `${formatPrice(p.wallet.availableBalance)} DT`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <PartnerStatusBadge status={p.status} />
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
