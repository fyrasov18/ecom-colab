import Link from "next/link";
import type { Metadata } from "next";
import { Search, X } from "lucide-react";
import { listOrders } from "@/modules/orders/queries";
import { listPartnerOptions } from "@/modules/partners/service";
import { formatPrice } from "@/lib/money";
import {
  GOVERNORATES,
  ORDER_FILTER_STATUSES,
  ORDER_STATUS_LABELS,
} from "@/modules/orders/labels";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { PageHeader } from "@/components/ui/page-header";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Commandes" };
export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = ORDER_FILTER_STATUSES.find((s) => s === sp.status);
  const partnerId = typeof sp.partnerId === "string" ? sp.partnerId : "";
  const governorate = typeof sp.gouvernorat === "string" ? sp.gouvernorat : "";
  const from = typeof sp.from === "string" ? sp.from : "";
  const to = typeof sp.to === "string" ? sp.to : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const hasFilters = !!(q || status || partnerId || governorate || from || to);

  const [{ items, total, totalPages }, partners] = await Promise.all([
    listOrders({
      q: q || undefined,
      status,
      partnerId: partnerId || undefined,
      governorate: governorate || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
    }),
    listPartnerOptions(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Commandes"
        description={`${total} commande(s)`}
      />

      {/* Filters */}
      <form
        className="flex flex-wrap items-end gap-3"
        method="GET"
        role="search"
        aria-label="Filtrer les commandes"
      >
        <div className="min-w-56 flex-1 space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">
            Recherche (n°, téléphone, client, partenaire)
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="1250 ou 22333444…"
              className="pl-8"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">
            Statut
          </Label>
          <NativeSelect
            name="status"
            defaultValue={status ?? ""}
            className="w-44"
          >
            <option value="">Tous</option>
            {ORDER_FILTER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">
            Partenaire
          </Label>
          <NativeSelect
            name="partnerId"
            defaultValue={partnerId}
            className="w-48"
          >
            <option value="">Tous</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">
            Gouvernorat
          </Label>
          <NativeSelect
            name="gouvernorat"
            defaultValue={governorate}
            className="w-40"
          >
            <option value="">Tous</option>
            {GOVERNORATES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1">
          <Label htmlFor="from-date" className="text-xs font-medium text-muted-foreground">
            Du
          </Label>
          <Input
            id="from-date"
            type="date"
            name="from"
            defaultValue={from}
            className="w-36"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="to-date" className="text-xs font-medium text-muted-foreground">
            Au
          </Label>
          <Input
            id="to-date"
            type="date"
            name="to"
            defaultValue={to}
            className="w-36"
          />
        </div>

        <div className="flex items-end gap-2">
          <Button type="submit" variant="outline" size="sm">
            Filtrer
          </Button>
          {hasFilters && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/commandes">
                <X className="h-4 w-4 mr-1" aria-hidden="true" />
                Réinitialiser
              </Link>
            </Button>
          )}
        </div>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="Aucune commande trouvée"
          description={
            hasFilters
              ? "Aucun résultat pour ces filtres. Modifiez votre recherche."
              : "Les commandes apparaissent ici dès qu'un partenaire en crée une."
          }
          action={
            hasFilters ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/commandes">Réinitialiser les filtres</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="hidden md:table-cell">Produit</TableHead>
                <TableHead className="hidden lg:table-cell">Partenaire</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden xl:table-cell">Créée le</TableHead>
                <TableHead className="hidden xl:table-cell">Mise à jour</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">
                    #{o.orderNumber}
                  </TableCell>
                  <TableCell>
                    <div>{o.customer.fullName}</div>
                    <div className="text-xs text-muted-foreground">
                      {o.customer.phone} · {o.customer.governorate}
                    </div>
                    <div className="text-xs text-muted-foreground lg:hidden">
                      {o.partner.displayName}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {o.items[0]?.productName}
                    {o.quantity > 1 ? ` ×${o.quantity}` : ""}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {o.partner.displayName}
                  </TableCell>
                  <TableCell>
                    {formatPrice(Number(o.unitSellingPrice) * o.quantity)} DT
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                    {o.createdAt.toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                    {o.updatedAt.toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/commandes/${o.id}`}>Ouvrir</Link>
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
