import Link from "next/link";
import type { Metadata } from "next";
import { Truck } from "lucide-react";
import { LANES, getLane, getLaneCounts, getLaneOrders } from "@/modules/logistics/queries";
import { listPartnerOptions } from "@/modules/partners/service";
import { ORDER_STATUS_LABELS } from "@/modules/orders/labels";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/native-select";
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
import { BulkLaneForm, SelectAllCheckbox } from "./lane-actions";
import { ResumeButton } from "./resume-button";

export const metadata: Metadata = { title: "Logistique" };
export const dynamic = "force-dynamic";

const TONE_CLASS: Record<string, string> = {
  info: "bg-blue-50 border-blue-200 text-blue-900",
  warning: "bg-amber-50 border-amber-300 text-amber-900",
  success: "bg-emerald-50 border-emerald-200 text-emerald-900",
  destructive: "bg-red-50 border-red-200 text-red-900",
  muted: "bg-muted border-border text-foreground",
};

export default async function LogisticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const lane = getLane(typeof sp.lane === "string" ? sp.lane : "");
  const q = typeof sp.q === "string" ? sp.q : "";
  const partnerId = typeof sp.partnerId === "string" ? sp.partnerId : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const [counts, partners, data] = await Promise.all([
    getLaneCounts(),
    listPartnerOptions(),
    getLaneOrders(lane, { q: q || undefined, partnerId: partnerId || undefined, page }),
  ]);

  const isBulkLane = lane.next !== null;

  const table = (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {isBulkLane && (
              <TableHead className="w-10">
                <SelectAllCheckbox />
              </TableHead>
            )}
            <TableHead>N°</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Localité</TableHead>
            <TableHead>Produit</TableHead>
            <TableHead>Partenaire</TableHead>
            {lane.key === "SHIPPED" || lane.key === "IN_DELIVERY" ? (
              <TableHead>Suivi</TableHead>
            ) : null}
            {lane.key === "RETURNS" ? <TableHead>Motif</TableHead> : null}
            {lane.key === "DELIVERED" ? <TableHead>Settlement</TableHead> : null}
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((o) => (
            <TableRow key={o.id}>
              {isBulkLane && (
                <TableCell>
                  <input
                    type="checkbox"
                    name="orderIds"
                    value={o.id}
                    className="h-4 w-4 rounded border-input accent-primary"
                    aria-label={`Sélectionner la commande ${o.orderNumber}`}
                  />
                </TableCell>
              )}
              <TableCell className="font-medium">#{o.orderNumber}</TableCell>
              <TableCell>
                <div>{o.customer.fullName}</div>
                <div className="text-xs text-muted-foreground">{o.customer.phone}</div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {o.customer.city}, {o.customer.governorate}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {o.items[0]?.productName}
                {o.quantity > 1 ? ` ×${o.quantity}` : ""}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {o.partner.displayName}
              </TableCell>
              {lane.key === "SHIPPED" || lane.key === "IN_DELIVERY" ? (
                <TableCell className="text-xs text-muted-foreground">
                  {o.shipment?.trackingNumber
                    ? `${o.shipment.carrier ?? ""} ${o.shipment.trackingNumber}`
                    : "—"}
                </TableCell>
              ) : null}
              {lane.key === "RETURNS" ? (
                <TableCell className="max-w-52">
                  <OrderStatusBadge status={o.status} />
                  <div className="mt-1 text-xs text-muted-foreground">
                    {o.returnRecord?.reason ?? "—"}
                  </div>
                </TableCell>
              ) : null}
              {lane.key === "DELIVERED" ? (
                <TableCell className="text-xs text-muted-foreground">
                  {o.deliveredAt
                    ? `Livrée ${o.deliveredAt.toLocaleDateString("fr-FR")}`
                    : ""}
                  {o.settlementDueAt
                    ? ` · dispo. ${o.settlementDueAt.toLocaleDateString("fr-FR")}`
                    : ""}
                </TableCell>
              ) : null}
              <TableCell className="text-right">
                {lane.key === "ON_HOLD" ? (
                  <ResumeButton orderId={o.id} />
                ) : (
                  <Link
                    href={`/commandes/${o.id}`}
                    className="rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-accent"
                  >
                    Ouvrir
                  </Link>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Logistique</h1>
        <p className="text-sm text-muted-foreground">
          Opérations quotidiennes — avancez les commandes directement depuis les
          files, sans ouvrir chaque fiche.
        </p>
      </div>

      {/* Lane pills with live counts */}
      <nav className="flex flex-wrap gap-2" aria-label="Files logistiques">
        {LANES.map((l) => {
          const active = l.key === lane.key;
          return (
            <Link
              key={l.key}
              href={`/logistique?lane=${l.key}`}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? TONE_CLASS[l.tone]
                  : "bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {l.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-xs font-semibold",
                  active ? "bg-white/70" : "bg-muted",
                )}
              >
                {counts[l.key]}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Filters */}
      <form className="flex flex-wrap items-center gap-3" method="GET">
        <input type="hidden" name="lane" value={lane.key} />
        <div className="relative min-w-52 flex-1">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="N° de commande ou téléphone…"
            className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <NativeSelect name="partnerId" defaultValue={partnerId} className="w-48">
          <option value="">Tous les partenaires</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </NativeSelect>
        <button
          type="submit"
          className="inline-flex h-9 rounded-md border border-input bg-card px-3 text-sm font-medium shadow-sm hover:bg-accent"
        >
          Filtrer
        </button>
      </form>

      {data.items.length === 0 ? (
        <EmptyState
          title={`Aucune commande dans « ${lane.label} »`}
          description="File vide — les commandes apparaîtront ici automatiquement."
        />
      ) : isBulkLane ? (
        <BulkLaneForm
          to={lane.next!}
          toLabel={`Marquer « ${ORDER_STATUS_LABELS[lane.next!]} »`}
        >
          {table}
        </BulkLaneForm>
      ) : (
        table
      )}

      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        searchParams={sp}
      />

      <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
        <Truck className="h-4 w-4 shrink-0 text-primary" />
        Les refus et retours exigent un motif individuel (pas de lot) — ouvrez la
        commande pour l&apos;enregistrer. Le volet financier des retours arrive en
        Phase 5.
      </div>
    </div>
  );
}


