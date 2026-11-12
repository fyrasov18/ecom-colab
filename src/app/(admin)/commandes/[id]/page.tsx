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
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = { title: "Détail commande" };
export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const order = await getOrderDetail(id);
  if (!order) notFound();

  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.orders;
  const c = dict.common;
  const p = dict.products;
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

  const revenue = Number(order.unitSellingPrice) * order.quantity;

  const sourceLabels: Record<string, string> = {
    PARTNER_PRODUCT: locale === "ar" ? "تعيين مخصص" : locale === "en" ? "custom assignment" : "assignment (personnalisée)",
    PARTNER: locale === "ar" ? "شريك" : locale === "en" ? "partner" : "partenaire",
    PRODUCT: locale === "ar" ? "منتج" : locale === "en" ? "product" : "produit",
    GLOBAL: locale === "ar" ? "عامة" : locale === "en" ? "global" : "globale",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link href="/commandes">
              <ArrowLeft className="h-4 w-4" /> {t.title}
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {locale === "ar" ? `طلب #${order.orderNumber}` : locale === "en" ? `Order #${order.orderNumber}` : `Commande #${order.orderNumber}`}
            </h1>
            <OrderStatusBadge status={order.status} />
            {order.partnerConfirmedAt && (
              <Badge variant="success">
                <ShieldCheck className="mr-1 h-3 w-3" /> {locale === "ar" ? "تم التأكيد من قبل الشريك" : locale === "en" ? "Confirmed by partner" : "Confirmée par le partenaire"}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {locale === "ar"
              ? `تم الإنشاء في ${formatDate(order.createdAt)} بواسطة ${order.partner.displayName} (${order.partner.code}) · آخر تحديث ${formatDate(order.updatedAt)}`
              : locale === "en"
              ? `Created on ${formatDate(order.createdAt)} by ${order.partner.displayName} (${order.partner.code}) · last update ${formatDate(order.updatedAt)}`
              : `Créée le ${formatDate(order.createdAt)} par ${order.partner.displayName} (${order.partner.code}) · dernière mise à jour ${formatDate(order.updatedAt)}`}
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
            <CardTitle className="text-base">{t.customer}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{order.customer.fullName}</p>
            <p className="text-muted-foreground">{order.customer.phone}</p>
            <p className="text-muted-foreground">
              {order.customer.address}, {order.customer.city},{" "}
              {order.customer.governorate}
            </p>
            <p className="text-xs text-muted-foreground">
              {locale === "ar" ? `عميل ${order.partner.displayName}` : locale === "en" ? `Customer of ${order.partner.displayName}` : `Client de ${order.partner.displayName}`} —{" "}
              <Link
                href={`/clients/${order.customer.id}`}
                className="text-primary underline-offset-2 hover:underline"
              >
                {locale === "ar" ? "ملف العميل" : locale === "en" ? "customer file" : "fiche client"}
              </Link>
            </p>
            {order.notes ? (
              <p className="pt-2 text-xs">Note : {order.notes}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{p.title}</CardTitle>
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
                × {i.quantity} — {formatPrice(Number(i.unitPrice) * i.quantity)} {currencySymbol}
              </div>
            ))}
            <p className="pt-2 text-muted-foreground">
              {locale === "ar"
                ? `تم خصم المخزون عند الإنشاء: ${order.quantity} قطعة.`
                : locale === "en"
                ? `Stock decremented on creation: ${order.quantity} unit(s).`
                : `Stock décrémenté à la création : ${order.quantity} unité(s).`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t.partner}</CardTitle>
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
              {locale === "ar" ? "الربح :" : locale === "en" ? "Earning:" : "Gain :"} <strong>{formatPrice(order.partnerEarning)} {currencySymbol}</strong>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Frozen financial snapshot */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {locale === "ar" ? "التفاصيل المالية (لقطة مجمدة)" : locale === "en" ? "Financial breakdown (frozen snapshot)" : "Décomposition financière (snapshot figé)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <FinRow label={`${t.catalogPrice} (${order.quantity} × ${formatPrice(order.unitSellingPrice)} ${currencySymbol})`} value={`${formatPrice(revenue)} ${currencySymbol}`} />
            <FinRow label={t.productCost} value={`− ${formatPrice(order.productCost)} ${currencySymbol}`} />
            <FinRow label={t.packagingCost} value={`− ${formatPrice(order.packagingCost)} ${currencySymbol}`} />
            <FinRow label={t.deliveryCost} value={`− ${formatPrice(order.deliveryCost)} ${currencySymbol}`} />
            <div className="border-t pt-2" />
            <FinRow label={t.contribution} value={`${formatPrice(order.contribution)} ${currencySymbol}`} bold />
            <FinRow
              label={`${t.partnerEarning} (${formatPrice(order.commissionValue)}${order.commissionType === "PERCENTAGE" ? " %" : ` ${currencySymbol}`} — ${sourceLabels[order.commissionSource] ?? order.commissionSource})`}
              value={`− ${formatPrice(order.partnerEarning)} ${currencySymbol}`}
              highlight
            />
            <FinRow
              label={t.platformShare}
              value={`${formatPrice(order.platformShare)} ${currencySymbol}`}
              bold
            />
            <div className="border-t pt-2 text-xs text-muted-foreground">
              {locale === "ar"
                ? `التعديلات: ${formatPrice(order.adjustmentsTotal)} ${currencySymbol} — التغييرات اللاحقة في أسعار المنتجات لا تؤثر أبداً على هذه اللقطة.`
                : locale === "en"
                ? `Adjustments: ${formatPrice(order.adjustmentsTotal)} ${currencySymbol} — subsequent product price changes never alter this snapshot.`
                : `Ajustements : ${formatPrice(order.adjustmentsTotal)} ${currencySymbol} — les modifications de prix produit ultérieures ne changent jamais cette snapshot.`}
            </div>
            {order.status === "DELIVERED" && (
              <div className="rounded-lg bg-success-50 p-3 text-xs text-success-700">
                {locale === "ar"
                  ? `تم التسليم في ${formatDate(order.deliveredAt)} · الربح متاح في ${formatDate(order.settlementDueAt)} (مجمد عند التسليم).`
                  : locale === "en"
                  ? `Delivered on ${formatDate(order.deliveredAt)} · earning available on ${formatDate(order.settlementDueAt)} (frozen at delivery).`
                  : `Livrée le ${formatDate(order.deliveredAt)} · gain disponible le ${formatDate(order.settlementDueAt)} (figé à la livraison).`}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t.timeline}</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline
              entries={[...order.statusHistory]
                .sort(
                  (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
                )
                .map((h) => ({
                  id: h.id,
                  title: dict.statuses?.order?.[h.newStatus] ?? ORDER_STATUS_LABELS[h.newStatus] ?? h.newStatus,
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
              emptyLabel={locale === "ar" ? "لم يتم تسجيل أي تغيير في الحالة." : locale === "en" ? "No status changes recorded." : "Aucun changement de statut enregistré."}
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
