import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, PlusCircle, X } from "lucide-react";
import { requireSession } from "@/lib/rbac";
import { listPartnerOrders } from "@/modules/orders/queries";
import { formatPrice } from "@/lib/money";
import {
  ORDER_FILTER_STATUSES,
  ORDER_STATUS_LABELS,
} from "@/modules/orders/labels";
import type { OrderStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
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
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = { title: "Mes commandes" };

export default async function MyOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const user = await requireSession(["PARTNER"]);
  const status =
    typeof sp.status === "string" &&
    (ORDER_FILTER_STATUSES as string[]).includes(sp.status)
      ? (sp.status as OrderStatus)
      : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.orders;
  const c = dict.common;
  const currencySymbol = locale === "ar" ? "د.ت" : locale === "en" ? "TND" : "DT";
  const intlLocale = locale === "ar" ? "ar-TN" : locale === "en" ? "en-US" : "fr-FR";

  const { items, total, totalPages } = await listPartnerOrders(
    user.partnerId!,
    { status, page },
  );

  const countSuffix = locale === "ar" ? "طلب" : locale === "en" ? "order(s)" : "commande(s)";
  const trackLabel = locale === "ar" ? "متابعة" : locale === "en" ? "Track" : "Suivre";
  const viewAllOrdersLabel = locale === "ar" ? "عرض جميع طلباتي" : locale === "en" ? "View all my orders" : "Voir toutes mes commandes";

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.partnerOrdersTitle}
        description={`${total} ${countSuffix}`}
        action={
          <Button asChild size="sm">
            <Link href="/nouvelle-commande">
              <PlusCircle className="h-4 w-4 mr-1.5" aria-hidden="true" />
              {t.newOrderTitle}
            </Link>
          </Button>
        }
      />

      {/* Status filter */}
      <form
        className="flex flex-wrap items-center gap-3"
        method="GET"
        role="search"
        aria-label={t.partnerOrdersTitle}
      >
        <NativeSelect
          name="status"
          defaultValue={status ?? ""}
          className="w-52"
          aria-label={t.filterStatus}
        >
          <option value="">{t.allStatuses}</option>
          {ORDER_FILTER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {dict.statuses.order[s] ?? ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline" size="sm">
          {c.filter}
        </Button>
        {status && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/mes-commandes">
              <X className="h-4 w-4 mr-1" aria-hidden="true" />
              {locale === "ar" ? "إعادة ضبط" : locale === "en" ? "Reset" : "Réinitialiser"}
            </Link>
          </Button>
        )}
      </form>

      {items.length === 0 ? (
        <EmptyState
          title={locale === "ar" ? "لا توجد طلبات" : locale === "en" ? "No orders" : "Aucune commande"}
          description={
            status
              ? (locale === "ar" ? "لا توجد طلبات بهذه الحالة." : locale === "en" ? "No orders with this status." : "Aucune commande avec ce statut.")
              : (locale === "ar" ? "أنشئ طلبك الأول بعد تأكيده هاتفياً مع عميلك." : locale === "en" ? "Create your first order after confirming with your customer." : "Créez votre première commande après l'avoir confirmée avec votre client.")
          }
          action={
            !status ? (
              <Button asChild size="sm">
                <Link href="/nouvelle-commande">
                  <PlusCircle className="h-4 w-4 mr-1.5" aria-hidden="true" />
                  {t.newOrderTitle}
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href="/mes-commandes">{viewAllOrdersLabel}</Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.orderNumber}</TableHead>
                <TableHead>{t.customer}</TableHead>
                <TableHead className="hidden md:table-cell">{dict.products.productName}</TableHead>
                <TableHead>{t.totalAmount}</TableHead>
                <TableHead className="hidden sm:table-cell">{t.partnerEarning}</TableHead>
                <TableHead>{c.status}</TableHead>
                <TableHead className="hidden lg:table-cell">{t.orderDate}</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">#{o.orderNumber}</TableCell>
                  <TableCell>
                    <div>{o.customer.fullName}</div>
                    <div className="text-xs text-muted-foreground">
                      {o.customer.phone}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {o.items[0]?.productName}
                    {o.quantity > 1 ? ` ×${o.quantity}` : ""}
                  </TableCell>
                  <TableCell>
                    {formatPrice(Number(o.unitSellingPrice) * o.quantity)} {currencySymbol}
                  </TableCell>
                  <TableCell className="hidden font-medium text-primary sm:table-cell">
                    {formatPrice(o.partnerEarning)} {currencySymbol}
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {o.createdAt.toLocaleDateString(intlLocale, {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/mes-commandes/${o.id}`}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
                      aria-label={`${trackLabel} #${o.orderNumber}`}
                    >
                      {trackLabel}{" "}
                      <ChevronRight
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                    </Link>
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
