import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireSession } from "@/lib/rbac";
import { getOrderDetail } from "@/modules/orders/queries";
import { formatPrice } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timeline } from "@/components/ui/timeline";
import { ORDER_STATUS_LABELS } from "@/modules/orders/labels";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderStatusActions as StatusActions } from "./status-actions";
import { ShipmentCard } from "./shipment-card";

export const metadata: Metadata = { title: "Détail commande" };
export const dynamic = "force-dynamic";

function fr(date: Date | null, withTime = true): string {
  if (!date) return "—";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

const SOURCE_LABELS: Record<string, string> = {
  PARTNER_PRODUCT: "assignment (personnalisée)",
  PARTNER: "partenaire",
  PRODUCT: "produit",
  GLOBAL: "globale",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const order = await getOrderDetail(id);
  if (!order) notFound();

  const revenue = Number(order.unitSellingPrice) * order.quantity;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link href="/commandes">
              <ArrowLeft className="h-4 w-4" /> Commandes
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              Commande #{order.orderNumber}
            </h1>
            <OrderStatusBadge status={order.status} />
            {order.partnerConfirmedAt && (
              <Badge variant="success">
                <ShieldCheck className="mr-1 h-3 w-3" /> Confirmée par le partenaire
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Créée le {fr(order.createdAt)} par {order.partner.displayName} (
            {order.partner.code}) · dernière mise à jour {fr(order.updatedAt)}
          </p>
        </div>
      </div>

      <StatusActions
        orderId={order.id}
        status={order.status}
        statusBeforeHold={order.statusBeforeHold}
        role={user.role}
      />

      <ShipmentCard orderId={order.id} shipment={order.shipment} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{order.customer.fullName}</p>
            <p className="text-muted-foreground">{order.customer.phone}</p>
            <p className="text-muted-foreground">
              {order.customer.address}, {order.customer.city},{" "}
              {order.customer.governorate}
            </p>
            <p className="text-xs text-muted-foreground">
              Client de {order.partner.displayName} —{" "}
              <Link
                href={`/clients/${order.customer.id}`}
                className="text-primary underline-offset-2 hover:underline"
              >
                fiche client
              </Link>
            </p>
            {order.notes ? (
              <p className="pt-2 text-xs">Note : {order.notes}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Produit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {order.items.map((i) => (
              <div key={i.id}>
                <Link
                  href={`/produits/${i.productId}`}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  {i.productName}
                </Link>{" "}
                × {i.quantity} — {formatPrice(Number(i.unitPrice) * i.quantity)} DT
              </div>
            ))}
            <p className="pt-2 text-muted-foreground">
              Stock décrémenté à la création : {order.quantity} unité(s).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Partenaire</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Link
              href={`/partenaires/${order.partner.id}`}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              {order.partner.displayName}
            </Link>
            <p className="text-muted-foreground">{order.partner.code}</p>
            <p className="text-muted-foreground">
              Gain : <strong>{formatPrice(order.partnerEarning)} DT</strong>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Frozen financial snapshot */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Décomposition financière (snapshot figé)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <FinRow label={`Prix de vente (${order.quantity} × ${formatPrice(order.unitSellingPrice)} DT)`} value={`${formatPrice(revenue)} DT`} />
            <FinRow label="Coût produit" value={`− ${formatPrice(order.productCost)} DT`} />
            <FinRow label="Emballage" value={`− ${formatPrice(order.packagingCost)} DT`} />
            <FinRow label="Livraison" value={`− ${formatPrice(order.deliveryCost)} DT`} />
            <div className="border-t pt-2" />
            <FinRow label="Contribution" value={`${formatPrice(order.contribution)} DT`} bold />
            <FinRow
              label={`Commission partenaire (${formatPrice(order.commissionValue)}${order.commissionType === "PERCENTAGE" ? " %" : " DT"} — ${SOURCE_LABELS[order.commissionSource] ?? order.commissionSource})`}
              value={`− ${formatPrice(order.partnerEarning)} DT`}
              highlight
            />
            <FinRow
              label="Part plateforme"
              value={`${formatPrice(order.platformShare)} DT`}
              bold
            />
            <div className="border-t pt-2 text-xs text-muted-foreground">
              Ajustements : {formatPrice(order.adjustmentsTotal)} DT — les
              modifications de prix produit ultérieures ne changent jamais cette
              snapshot.
            </div>
            {order.status === "DELIVERED" && (
              <div className="rounded-lg bg-success-50 p-3 text-xs text-success-700">
                Livrée le {fr(order.deliveredAt)} · gain disponible le{" "}
                <strong>{fr(order.settlementDueAt)}</strong> (figé à la livraison).
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Timeline &amp; historique</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline
              entries={[...order.statusHistory]
                .sort(
                  (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
                )
                .map((h) => ({
                  id: h.id,
                  title: ORDER_STATUS_LABELS[h.newStatus] ?? h.newStatus,
                  at: h.createdAt,
                  actor: h.changedBy
                    ? `${h.changedBy.firstName} ${h.changedBy.lastName}`
                    : null,
                  detail: h.reason,
                  tone:
                    h.newStatus === "DELIVERED"
                      ? "success"
                      : h.newStatus === "REFUSED" || h.newStatus === "RETURNED"
                        ? "destructive"
                        : h.newStatus === "ON_HOLD"
                          ? "warning"
                          : "default",
                }))}
              emptyLabel="Aucun changement de statut enregistré."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FinRow({
  label,
  value,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          bold ? "font-semibold" : highlight ? "font-semibold text-primary" : ""
        }
      >
        {value}
      </span>
    </div>
  );
}

