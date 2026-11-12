import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCustomerDetail } from "@/modules/customers/queries";
import { formatPrice } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = { title: "Fiche client" };
export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomerDetail(id);
  if (!customer) notFound();

  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.clients;
  const o = dict.orders;
  const c = dict.common;
  const currencySymbol = locale === "ar" ? "د.ت" : locale === "en" ? "TND" : "DT";
  const intlLocale = locale === "ar" ? "ar-TN" : locale === "en" ? "en-US" : "fr-FR";

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2">
          <Link
            href="/clients"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> {t.title}
          </Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{customer.fullName}</h1>
        <p className="text-sm text-muted-foreground">
          {customer.phone} · {customer.address}, {customer.city},{" "}
          {customer.governorate}
        </p>
        <p className="text-xs text-muted-foreground">
          {locale === "ar" ? "الشريك المالك: " : locale === "en" ? "Owner Partner: " : "Propriétaire : "}
          <Link
            href={`/partenaires/${customer.ownerPartner.id}`}
            className="text-primary underline-offset-2 hover:underline"
          >
            {customer.ownerPartner.displayName} ({customer.ownerPartner.code})
          </Link>
        </p>
        {customer.notes ? <p className="mt-2 text-sm">Note : {customer.notes}</p> : null}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {o.title} ({customer.orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customer.orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">{locale === "ar" ? "لا توجد طلبات." : locale === "en" ? "No orders." : "Aucune commande."}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{o.orderNumber}</TableHead>
                  <TableHead>{dict.products.productName}</TableHead>
                  <TableHead>{c.total}</TableHead>
                  <TableHead>{c.status}</TableHead>
                  <TableHead>{c.date}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.orders.map((orderItem) => (
                  <TableRow key={orderItem.id}>
                    <TableCell className="font-medium">#{orderItem.orderNumber}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {orderItem.items[0]?.productName}
                      {orderItem.quantity > 1 ? ` ×${orderItem.quantity}` : ""}
                    </TableCell>
                    <TableCell>
                      {formatPrice(Number(orderItem.unitSellingPrice) * orderItem.quantity)} {currencySymbol}
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={orderItem.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {orderItem.createdAt.toLocaleDateString(intlLocale)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/commandes/${orderItem.id}`}
                        className="text-sm text-primary underline-offset-2 hover:underline"
                      >
                        {c.view}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
