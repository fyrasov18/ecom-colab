import Link from "next/link";
import type { Metadata } from "next";
import { Search, Trash2, X } from "lucide-react";
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
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { PageHeader } from "@/components/ui/page-header";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { deleteOrderAction } from "./actions";
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

export const metadata: Metadata = { title: "Commandes" };
export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.orders;
  const c = dict.common;
  const currencySymbol = locale === "ar" ? "د.ت" : locale === "en" ? "TND" : "DT";
  const intlLocale = locale === "ar" ? "ar-TN" : locale === "en" ? "en-US" : "fr-FR";

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

  const countSuffix = locale === "ar" ? "طلب" : locale === "en" ? "order(s)" : "commande(s)";
  const fromLabel = locale === "ar" ? "من" : locale === "en" ? "From" : "Du";
  const toLabel = locale === "ar" ? "إلى" : locale === "en" ? "To" : "Au";
  const resetFiltersLabel = locale === "ar" ? "إعادة ضبط الفلاتر" : locale === "en" ? "Reset filters" : "Réinitialiser les filtres";

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.title}
        description={`${total} ${countSuffix}`}
      />

      {/* Filters */}
      <form
        className="flex flex-wrap items-end gap-3"
        method="GET"
        role="search"
        aria-label={t.title}
      >
        <div className="min-w-56 flex-1 space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">
            {t.searchPlaceholder}
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
              placeholder="1250, 22333444…"
              className="pl-8"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">
            {t.filterStatus}
          </Label>
          <NativeSelect
            name="status"
            defaultValue={status ?? ""}
            className="w-44"
          >
            <option value="">{c.all}</option>
            {ORDER_FILTER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {dict.statuses?.order?.[s] ?? ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">
            {t.partner}
          </Label>
          <NativeSelect
            name="partnerId"
            defaultValue={partnerId}
            className="w-48"
          >
            <option value="">{c.all}</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">
            {t.governorate.replace("*", "").trim()}
          </Label>
          <NativeSelect
            name="gouvernorat"
            defaultValue={governorate}
            className="w-40"
          >
            <option value="">{c.all}</option>
            {GOVERNORATES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1">
          <Label htmlFor="from-date" className="text-xs font-medium text-muted-foreground">
            {fromLabel}
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
            {toLabel}
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
            {c.filter}
          </Button>
          {hasFilters && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/commandes">
                <X className="h-4 w-4 mr-1" aria-hidden="true" />
                {resetFiltersLabel}
              </Link>
            </Button>
          )}
        </div>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title={t.noOrders}
          description={
            hasFilters
              ? t.noOrdersDesc
              : (locale === "ar" ? "تظهر الطلبات هنا بمجرد إنشائها من قبل الشركاء." : locale === "en" ? "Orders will appear here as soon as partners create them." : "Les commandes apparaissent ici dès qu'un partenaire en crée une.")
          }
          action={
            hasFilters ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/commandes">{resetFiltersLabel}</Link>
              </Button>
            ) : undefined
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
                <TableHead className="hidden lg:table-cell">{t.partner}</TableHead>
                <TableHead>{t.totalAmount}</TableHead>
                <TableHead>{c.status}</TableHead>
                <TableHead className="hidden xl:table-cell">{t.orderDate}</TableHead>
                <TableHead className="hidden xl:table-cell">{c.date}</TableHead>
                <TableHead className="w-[100px] text-right">{c.actions}</TableHead>
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
                    {formatPrice(Number(o.unitSellingPrice) * o.quantity)} {currencySymbol}
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                    {o.createdAt.toLocaleDateString(intlLocale, {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                    {o.updatedAt.toLocaleDateString(intlLocale, {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/commandes/${o.id}`}>{c.view}</Link>
                      </Button>
                      <form action={deleteOrderAction}>
                        <input type="hidden" name="orderId" value={o.id} />
                        <ConfirmSubmit
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-8 w-8 p-0"
                          confirmMessage={locale === "ar" ? `حذف الطلب #${o.orderNumber} نهائياً؟` : locale === "en" ? `Permanently delete order #${o.orderNumber}?` : `Supprimer définitivement la commande #${o.orderNumber} ?`}
                          title={locale === "ar" ? "حذف هذا الطلب" : locale === "en" ? "Delete this order" : "Supprimer cette commande"}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">{c.delete}</span>
                        </ConfirmSubmit>
                      </form>
                    </div>
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
