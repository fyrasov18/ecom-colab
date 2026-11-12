import Link from "next/link";
import type { Metadata } from "next";
import { Search, Clock, CheckCircle2, XCircle, Ban, Archive, UserCheck, Trash2 } from "lucide-react";
import { listPartners } from "@/modules/partners/service";
import { formatPrice } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import { Pagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { deletePartnerAction } from "./actions";
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

export const metadata: Metadata = { title: "Partenaires" };

type PartnerStatus = "ACTIVE" | "PENDING" | "SUSPENDED" | "REJECTED" | "CLOSED";

const STATUS_BADGE: Record<
  PartnerStatus,
  "success" | "warning" | "destructive" | "secondary" | "info"
> = {
  ACTIVE: "success",
  PENDING: "warning",
  SUSPENDED: "info",
  REJECTED: "destructive",
  CLOSED: "secondary",
};

const STATUS_ICON: Record<PartnerStatus, React.ComponentType<{ className?: string }>> = {
  ACTIVE: CheckCircle2,
  PENDING: Clock,
  SUSPENDED: Ban,
  REJECTED: XCircle,
  CLOSED: Archive,
};

function PartnerStatusBadge({ status, label }: { status: string; label: string }) {
  const s = status as PartnerStatus;
  const Icon = STATUS_ICON[s];
  return (
    <Badge variant={STATUS_BADGE[s] ?? "secondary"} className="gap-1.5">
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {label}
    </Badge>
  );
}

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.partners;
  const c = dict.common;
  const currencySymbol = locale === "ar" ? "د.ت" : locale === "en" ? "TND" : "DT";

  const sp = await searchParams;
  const search = typeof sp.q === "string" ? sp.q : "";
  const status =
    sp.status === "ACTIVE" ||
    sp.status === "PENDING" ||
    sp.status === "SUSPENDED" ||
    sp.status === "REJECTED" ||
    sp.status === "CLOSED"
      ? sp.status
      : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const { items, total, totalPages } = await listPartners({ search, status, page });
  const pendingOnPage = items.filter((p) => p.status === "PENDING").length;

  const countSuffix = locale === "ar" ? "شريك إجمالاً" : locale === "en" ? "partner(s) total" : "partenaire(s) au total";
  const searchPlaceholder = locale === "ar" ? "الاسم، الرمز أو البريد..." : locale === "en" ? "Name, code or email..." : "Nom, code ou e-mail…";
  const resetFiltersLabel = locale === "ar" ? "إعادة ضبط الفلاتر" : locale === "en" ? "Reset filters" : "Réinitialiser les filtres";

  const getPartnerStatusLabel = (s: string) => {
    if (s === "CLOSED") return locale === "ar" ? "مغلق" : locale === "en" ? "Closed" : "Fermé";
    return dict.statuses.partner[s as keyof typeof dict.statuses.partner] ?? s;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.title}
        description={`${total} ${countSuffix}`}
      />

      {/* Pending alert — only when not already filtering by PENDING */}
      {!status && pendingOnPage > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 shrink-0 text-warning-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-warning-700">
                {pendingOnPage} {locale === "ar" ? "شركاء في انتظار التحقق" : locale === "en" ? "partner(s) pending approval" : "partenaire(s) en attente"}
              </p>
              <p className="text-xs text-warning-600 mt-0.5">
                {locale === "ar" ? "الموافقة على الطلبات أو رفضها." : locale === "en" ? "Approve or reject pending requests." : "Approuvez ou rejetez les demandes en attente."}
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href="?status=PENDING">
              <UserCheck className="h-4 w-4 mr-1.5" />
              {locale === "ar" ? "عرض الطلبات" : locale === "en" ? "View requests" : "Afficher les demandes"}
            </Link>
          </Button>
        </div>
      )}

      {/* Filters */}
      <form className="flex flex-wrap items-end gap-3" method="GET" role="search">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            name="q"
            defaultValue={search}
            placeholder={searchPlaceholder}
            className="pl-8"
            aria-label={t.title}
          />
        </div>
        <NativeSelect
          name="status"
          defaultValue={status ?? ""}
          className="w-44"
          aria-label={t.status}
        >
          <option value="">{t.allStatuses}</option>
          <option value="ACTIVE">{dict.statuses.partner.ACTIVE}</option>
          <option value="PENDING">{dict.statuses.partner.PENDING}</option>
          <option value="SUSPENDED">{dict.statuses.partner.SUSPENDED}</option>
          <option value="REJECTED">{dict.statuses.partner.REJECTED}</option>
          <option value="CLOSED">{locale === "ar" ? "مغلق" : locale === "en" ? "Closed" : "Fermé"}</option>
        </NativeSelect>
        <Button type="submit" variant="outline" size="sm">
          {c.filter}
        </Button>
        {(search || status) && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/partenaires">{locale === "ar" ? "إعادة ضبط" : locale === "en" ? "Reset" : "Réinitialiser"}</Link>
          </Button>
        )}
      </form>

      {items.length === 0 ? (
        <EmptyState
          title={locale === "ar" ? "لم يتم العثور على شركاء" : locale === "en" ? "No partners found" : "Aucun partenaire trouvé"}
          description={
            search || status
              ? (locale === "ar" ? "لا توجد نتائج لهذه الفلاتر." : locale === "en" ? "No results for these filters." : "Aucun résultat pour ces filtres. Modifiez votre recherche.")
              : (locale === "ar" ? "سيظهر الشركاء المسجلون هنا." : locale === "en" ? "Registered partners will appear here." : "Les partenaires inscrits apparaîtront ici.")
          }
          action={
            (search || status) ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/partenaires">{resetFiltersLabel}</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.name}</TableHead>
                <TableHead className="hidden md:table-cell">{locale === "ar" ? "البريد الإلكتروني" : locale === "en" ? "Email" : "E-mail"}</TableHead>
                <TableHead className="hidden lg:table-cell">{dict.products.title}</TableHead>
                <TableHead className="hidden lg:table-cell">{t.totalOrders}</TableHead>
                <TableHead className="hidden xl:table-cell">{t.balance}</TableHead>
                <TableHead>{t.status}</TableHead>
                <TableHead className="w-[100px] text-right">{c.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow
                  key={p.id}
                  className={cn(
                    p.status === "PENDING" && "border-l-4 border-l-warning bg-warning/5",
                  )}
                >
                  <TableCell>
                    <div className="font-medium">{p.displayName}</div>
                    <div className="text-xs text-muted-foreground">{p.code}</div>
                    <div className="text-xs text-muted-foreground md:hidden">
                      {p.user.email}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {p.user.email}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {p._count.assignedProducts}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {p._count.orders}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {p.wallet
                      ? `${formatPrice(p.wallet.availableBalance)} ${currencySymbol}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <PartnerStatusBadge status={p.status} label={getPartnerStatusLabel(p.status)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/partenaires/${p.id}`}>{c.view}</Link>
                      </Button>
                      <form action={deletePartnerAction}>
                        <input type="hidden" name="partnerId" value={p.id} />
                        <ConfirmSubmit
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-8 w-8 p-0"
                          confirmMessage={locale === "ar" ? `حذف الشريك "${p.displayName}" (${p.code}) وجميع بياناته نهائياً؟` : locale === "en" ? `Permanently delete partner "${p.displayName}" (${p.code}) and all associated data?` : `Supprimer définitivement le partenaire "${p.displayName}" (${p.code}) et toutes ses données associées ?`}
                          title={locale === "ar" ? "حذف هذا الشريك" : locale === "en" ? "Delete this partner" : "Supprimer ce partenaire"}
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
