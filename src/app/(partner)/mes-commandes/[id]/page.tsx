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
import { ConfirmOrderForm } from "./confirm-form";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = { title: "Suivi de commande" };

export default async function PartnerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSession(["PARTNER"]);
  const order = await getPartnerOrder(user.partnerId!, id);
  if (!order) notFound();

  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.orders;
  const c = dict.common;
  const currencySymbol = locale === "ar" ? "د.ت" : locale === "en" ? "TND" : "DT";
  const intlLocale = locale === "ar" ? "ar-TN" : locale === "en" ? "en-US" : "fr-FR";

  const formatDate = (date: Date | null, withTime = true): string => {
    if (!date) return "—";
    return date.toLocaleDateString(intlLocale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    });
  };

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
            <ArrowLeft className="h-4 w-4" /> {t.partnerOrdersTitle}
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {locale === "ar" ? `طلب #${order.orderNumber}` : locale === "en" ? `Order #${order.orderNumber}` : `Commande #${order.orderNumber}`}
          </h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {locale === "ar" ? "تم الإنشاء في " : locale === "en" ? "Created on " : "Créée le "}{formatDate(order.createdAt)}
          {order.partnerConfirmedAt
            ? (locale === "ar" ? " · تم تأكيد العميل" : locale === "en" ? " · Customer confirmation recorded" : " · Confirmation client enregistrée")
            : (locale === "ar" ? " · في انتظار تأكيد العميل" : locale === "en" ? " · Awaiting customer confirmation" : " · En attente de confirmation client")}
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
                      {dict.statuses?.order?.[s] ?? ORDER_STEP_LABELS[s]}
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
            <CardTitle className="text-base">{t.customer}</CardTitle>
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
            <CardTitle className="text-base">{c.details}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {order.items.map((i) => (
              <p key={i.id}>
                {i.productName} × {i.quantity} —{" "}
                {formatPrice(Number(i.unitPrice) * i.quantity)} {currencySymbol}
              </p>
            ))}
            <p className="pt-2 text-muted-foreground">
              {t.totalAmount} :{" "}
              <strong>
                {formatPrice(Number(order.unitSellingPrice) * order.quantity)} {currencySymbol}
              </strong>
            </p>
            <p className="font-medium text-primary">
              {t.partnerEarning} : {formatPrice(order.partnerEarning)} {currencySymbol}
            </p>
            {order.status === "DELIVERED" && order.settlementDueAt ? (
              <p className="text-xs text-muted-foreground">
                {locale === "ar" ? "متاح في " : locale === "en" ? "Available on " : "Disponible le "}{formatDate(order.settlementDueAt, false)}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.timeline}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {order.statusHistory.map((h) => (
              <li key={h.id} className="flex items-start gap-3 text-sm">
                <Badge variant="outline" className="mt-0.5 shrink-0">
                  {dict.statuses?.order?.[h.newStatus] ?? ORDER_STATUS_LABELS[h.newStatus]}
                </Badge>
                <div>
                  <div className="text-muted-foreground">{formatDate(h.createdAt)}</div>
                  {h.reason ? <div className="text-xs">{h.reason}</div> : null}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {order.status === "CONFIRMED" && !order.partnerConfirmedAt && (
        <ConfirmOrderForm
          orderId={order.id}
          previewSnapshot={order.initialSnapshot ? JSON.stringify(order.initialSnapshot) : undefined}
        />
      )}
      {order.status === "CONFIRMED" && <CancelOrderForm orderId={order.id} />}
    </div>
  );
}
