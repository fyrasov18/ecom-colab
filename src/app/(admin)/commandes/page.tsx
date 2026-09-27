import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { listOrders } from "@/modules/orders/queries";
import { listPartnerOptions } from "@/modules/partners/service";
import { formatPrice } from "@/lib/money";
import { GOVERNORATES, ORDER_FILTER_STATUSES, ORDER_STATUS_LABELS } from "@/modules/orders/labels";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Commandes</h1>
        <p className="text-sm text-muted-foreground">{total} commande(s)</p>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="GET">
        <div className="min-w-56 flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Recherche (n°, téléphone, client, partenaire)
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="1250 ou 22333444…"
              className="flex h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Statut</label>
          <NativeSelect name="status" defaultValue={status ?? ""} className="w-44">
            <option value="">Tous</option>
            {ORDER_FILTER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Partenaire</label>
          <NativeSelect name="partnerId" defaultValue={partnerId} className="w-48">
            <option value="">Tous</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Gouvernorat</label>
          <NativeSelect name="gouvernorat" defaultValue={governorate} className="w-40">
            <option value="">Tous</option>
            {GOVERNORATES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Du</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="flex h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Au</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="flex h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Filtrer
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="Aucune commande trouvée"
          description="Les commandes apparaissent ici dès qu'un partenaire en crée une (après confirmation client)."
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Partenaire</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créée le</TableHead>
                <TableHead>Mise à jour</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">#{o.orderNumber}</TableCell>
                  <TableCell>
                    <div>{o.customer.fullName}</div>
                    <div className="text-xs text-muted-foreground">
                      {o.customer.phone} · {o.customer.governorate}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {o.items[0]?.productName}
                    {o.quantity > 1 ? ` ×${o.quantity}` : ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {o.partner.displayName}
                  </TableCell>
                  <TableCell>
                    {formatPrice(Number(o.unitSellingPrice) * o.quantity)} DT
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {o.createdAt.toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
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


