import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { requireSession } from "@/lib/rbac";
import { getPartnerOrder } from "@/modules/orders/queries";
import { PIPELINE, ORDER_STEP_LABELS } from "@/modules/orders/transitions";
import { ORDER_STATUS_LABELS } from "@/modules/orders/labels";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { CancelOrderForm } from "./cancel-form";

export const metadata: Metadata = { title: "Suivi de commande" };

function fr(date: Date | null, withTime = true): string {
  if (!date) return "—";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export default async function PartnerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSession(["PARTNER"]);
  // Ownership enforced in the query — null unless this IS their order.
  const order = await getPartnerOrder(user.partnerId!, id);
  if (!order) notFound();

  const reached = new Set(order.statusHistory.map((h) => h.newStatus));
  const offPipeline =
    order.status === "CANCELLED" ||
    order.status === "REFUSED" ||
    order.status === "RETURNED";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/mes-commandes">
            <ArrowLeft className="h-4 w-4" /> Mes commandes
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Commande #{order.orderNumber}
          </h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          Créée le {fr(order.createdAt)}
          {order.partnerConfirmedAt
            ? " · Confirmation client enregistrée à la création"
            : ""}
        </p>
      </div>

      {!offPipeline && (
        <Card>
          <CardContent className="p-5">
            <ol className="flex flex-wrap items-center gap-2">
              {PIPELINE.map((s) => {
                const done = reached.has(s);
                const current = order.status === s;
                return (
                  <li key={s} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                        current
                          ? "bg-primary text-primary-foreground"
                          : done
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {done && !current ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Circle className="h-3.5 w-3.5" />
                      )}
                      {ORDER_STEP_LABELS[s]}
                    </span>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
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
            {order.notes ? <p className="pt-2 text-xs">Note : {order.notes}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Détail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {order.items.map((i) => (
              <p key={i.id}>
                {i.productName} × {i.quantity} —{" "}
                {formatPrice(Number(i.unitPrice) * i.quantity)} DT
              </p>
            ))}
            <p className="pt-2 text-muted-foreground">
              Montant total :{" "}
              <strong>
                {formatPrice(Number(order.unitSellingPrice) * order.quantity)} DT
              </strong>
            </p>
            <p className="font-medium text-primary">
              Votre gain : {formatPrice(order.partnerEarning)} DT
            </p>
            {order.status === "DELIVERED" && order.settlementDueAt ? (
              <p className="text-xs text-muted-foreground">
                Disponible le {fr(order.settlementDueAt, false)}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Historique</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {order.statusHistory.map((h) => (
              <li key={h.id} className="flex items-start gap-3 text-sm">
                <Badge variant="outline" className="mt-0.5 shrink-0">
                  {ORDER_STATUS_LABELS[h.newStatus]}
                </Badge>
                <div>
                  <div className="text-muted-foreground">{fr(h.createdAt)}</div>
                  {h.reason ? <div className="text-xs">{h.reason}</div> : null}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {order.status === "CONFIRMED" && <CancelOrderForm orderId={order.id} />}
    </div>
  );
}

