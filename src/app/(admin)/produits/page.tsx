import Link from "next/link";
import type { Metadata } from "next";
import { FolderTree, Plus, Search, Trash2 } from "lucide-react";
import { listProducts } from "@/modules/products/service";
import { listActiveCategories } from "@/modules/categories/service";
import { formatPrice } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import { Pagination } from "@/components/ui/pagination";
import { deleteProductAction } from "./actions";
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

export const metadata: Metadata = { title: "Produits" };

const STATUS_BADGE: Record<string, "success" | "secondary" | "warning" | "destructive"> = {
  ACTIVE: "success",
  INACTIVE: "secondary",
  OUT_OF_STOCK: "warning",
  ARCHIVED: "destructive",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.products;
  const c = dict.common;
  const currencySymbol = locale === "ar" ? "د.ت" : locale === "en" ? "TND" : "DT";

  const sp = await searchParams;
  const search = typeof sp.q === "string" ? sp.q : "";
  const categoryId = typeof sp.category === "string" && sp.category !== "" ? sp.category : undefined;
  const status =
    sp.status === "ACTIVE" ||
    sp.status === "INACTIVE" ||
    sp.status === "OUT_OF_STOCK" ||
    sp.status === "ARCHIVED"
      ? sp.status
      : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const [{ items, total, totalPages }, categories] = await Promise.all([
    listProducts({ search, status, categoryId, page }),
    listActiveCategories(),
  ]);

  const countSuffix = locale === "ar" ? "منتج" : locale === "en" ? "product(s)" : "produit(s)";
  const searchPlaceholder = locale === "ar" ? "البحث بالاسم..." : locale === "en" ? "Search by name..." : "Rechercher par nom…";
  const allStatusesLabel = locale === "ar" ? "جميع الحالات" : locale === "en" ? "All statuses" : "Tous les statuts";
  const costsHeader = locale === "ar" ? "التكاليف (شراء + تغليف + شحن)" : locale === "en" ? "Costs (purchase+pack+ship)" : "Coûts (achat+emball.+livr.)";
  const manageLabel = locale === "ar" ? "إدارة" : locale === "en" ? "Manage" : "Gérer";
  const lowBadge = locale === "ar" ? "منخفض" : locale === "en" ? "Low" : "Faible";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{total} {countSuffix}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/produits/categories">
              <FolderTree className="h-4 w-4 mr-1.5" /> {dict.nav.categories}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/produits/nouveau">
              <Plus className="h-4 w-4 mr-1.5" /> {t.addProduct}
            </Link>
          </Button>
        </div>
      </div>

      <form className="flex flex-wrap items-center gap-3" method="GET">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder={searchPlaceholder}
            className="flex h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <NativeSelect name="category" defaultValue={categoryId ?? ""} className="w-52">
          <option value="">{t.allCategories}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="status" defaultValue={status ?? ""} className="w-44">
          <option value="">{allStatusesLabel}</option>
          <option value="ACTIVE">{dict.statuses.product.ACTIVE}</option>
          <option value="INACTIVE">{dict.statuses.product.INACTIVE}</option>
          <option value="OUT_OF_STOCK">{dict.statuses.product.OUT_OF_STOCK}</option>
          <option value="ARCHIVED">{dict.statuses.product.ARCHIVED}</option>
        </NativeSelect>
        <Button type="submit" variant="outline" size="sm">
          {c.filter}
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title={t.noProductsFound}
          description={t.noProductsDesc}
          action={
            <Button asChild variant="outline">
              <Link href="/produits/nouveau">{t.addProduct}</Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.productName}</TableHead>
                <TableHead>{t.category}</TableHead>
                <TableHead>{t.sellingPrice}</TableHead>
                <TableHead>{costsHeader}</TableHead>
                <TableHead>{t.stock}</TableHead>
                <TableHead>{dict.nav.partnerList}</TableHead>
                <TableHead>{c.status}</TableHead>
                <TableHead className="w-[100px] text-right">{c.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((prod) => {
                const costs =
                  Number(prod.purchaseCost) + Number(prod.packagingCost) + Number(prod.deliveryCost);
                const lowStock = prod.stockQuantity <= prod.lowStockThreshold;
                const statusText = dict.statuses.product[prod.status as keyof typeof dict.statuses.product] ?? prod.status;
                return (
                  <TableRow key={prod.id}>
                    <TableCell>
                      <div className="font-medium flex items-center gap-1.5 flex-wrap">
                        <span>{prod.name}</span>
                        {prod.isWinning && (
                          <span
                            className="inline-flex items-center text-[11px] font-semibold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded"
                            title={t.isWinning}
                          >
                            ⭐ {locale === "ar" ? "رابح" : locale === "en" ? "Winner" : "Gagnant"}
                          </span>
                        )}
                        {prod.isNew && (
                          <span
                            className="inline-flex items-center text-[11px] font-semibold text-sky-600 bg-sky-500/10 px-1.5 py-0.5 rounded"
                            title={t.isNew}
                          >
                            🆕 {locale === "ar" ? "جديد" : locale === "en" ? "New" : "Nouveau"}
                          </span>
                        )}
                        {prod.isRecommended && (
                          <span
                            className="inline-flex items-center text-[11px] font-semibold text-rose-600 bg-rose-500/10 px-1.5 py-0.5 rounded"
                            title={t.isRecommended}
                          >
                            🔥 {locale === "ar" ? "موصى به" : locale === "en" ? "Recommended" : "Recommandé"}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">/{prod.slug}</div>
                    </TableCell>
                    <TableCell>
                      {prod.categoryRef ? (
                        <Badge variant="outline" className="text-xs">
                          {prod.categoryRef.name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{formatPrice(prod.sellingPrice)} {currencySymbol}</TableCell>
                    <TableCell className="text-muted-foreground">{formatPrice(costs)} {currencySymbol}</TableCell>
                    <TableCell>
                      <span className={lowStock ? "font-semibold text-amber-600" : ""}>
                        {prod.stockQuantity}
                      </span>
                      {lowStock && (
                        <Badge variant="warning" className="ml-2">
                          {lowBadge}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{prod._count.partnerAssignations}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[prod.status] ?? "secondary"}>
                        {statusText}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/produits/${prod.id}`}>{manageLabel}</Link>
                        </Button>
                        <form action={deleteProductAction}>
                          <input type="hidden" name="productId" value={prod.id} />
                          <ConfirmSubmit
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-8 w-8 p-0"
                            confirmMessage={locale === "ar" ? `حذف المنتج "${prod.name}" نهائياً؟` : locale === "en" ? `Permanently delete product "${prod.name}"?` : `Supprimer définitivement le produit "${prod.name}" ?`}
                            title={locale === "ar" ? "حذف هذا المنتج" : locale === "en" ? "Delete this product" : "Supprimer ce produit"}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">{c.delete}</span>
                          </ConfirmSubmit>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="p-4 border-t">
            <Pagination page={page} totalPages={totalPages} searchParams={sp} />
          </div>
        </div>
      )}
    </div>
  );
}
