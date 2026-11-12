import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { listCustomers } from "@/modules/customers/queries";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
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

export const metadata: Metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total, totalPages } = await listCustomers({ search: q, page });

  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.clients;
  const o = dict.orders;
  const c = dict.common;
  const intlLocale = locale === "ar" ? "ar-TN" : locale === "en" ? "en-US" : "fr-FR";

  const countSuffix = locale === "ar" ? "عميل" : locale === "en" ? "client(s)" : "client(s)";
  const searchPlaceholder = locale === "ar" ? "الاسم، الهاتف أو المدينة..." : locale === "en" ? "Name, phone or city..." : "Nom, téléphone ou ville…";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">
          {total} {countSuffix} — {locale === "ar" ? "كل عميل ينتمي للشريك الذي سجله (الهاتف = معرف فريد لكل شريك)." : locale === "en" ? "each client belongs to the partner who registered them (phone = unique identifier per partner)." : "chaque client appartient au partenaire qui l'a saisi (téléphone = identifiant par partenaire)."}
        </p>
      </div>

      <form className="flex flex-wrap items-center gap-3" method="GET">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={searchPlaceholder}
            className="flex h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          {c.search}
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title={locale === "ar" ? "لا يوجد عملاء" : locale === "en" ? "No clients" : "Aucun client"}
          description={locale === "ar" ? "يتم إنشاء العملاء تلقائياً عند تسجيل طلب جديد." : locale === "en" ? "Clients are automatically created when partners place orders." : "Les clients sont créés automatiquement lorsqu'un partenaire saisit une commande."}
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.customerName}</TableHead>
                <TableHead>{t.phone}</TableHead>
                <TableHead>{locale === "ar" ? "الموقع" : locale === "en" ? "Location" : "Localisation"}</TableHead>
                <TableHead>{o.partner}</TableHead>
                <TableHead>{t.totalOrders}</TableHead>
                <TableHead>{locale === "ar" ? "آخر تحديث" : locale === "en" ? "Last update" : "Dernière MAJ"}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((cust) => (
                <TableRow key={cust.id}>
                  <TableCell className="font-medium">{cust.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">{cust.phone}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {cust.city}, {cust.governorate}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <Link
                      href={`/partenaires/${cust.ownerPartnerId}`}
                      className="hover:underline text-primary"
                    >
                      {cust.ownerPartner.displayName}
                    </Link>
                  </TableCell>
                  <TableCell>{cust._count.orders}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {cust.updatedAt.toLocaleDateString(intlLocale)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/clients/${cust.id}`}>{c.view}</Link>
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
