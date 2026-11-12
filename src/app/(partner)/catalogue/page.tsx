import Link from "next/link";
import type { Metadata } from "next";
import {
  ChevronRight,
  Flame,
  Package,
  RotateCcw,
  Search,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { requireSession } from "@/lib/rbac";
import {
  getPartnerCatalogueStats,
  listAssignedProducts,
} from "@/modules/products/partner-catalogue";
import { formatPrice } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { PartnerProductCard } from "@/components/catalogue/partner-product-card";
import { CategoryFilterBar } from "@/components/catalogue/category-filter-bar";

export const metadata: Metadata = { title: "Catalogue Produits" };

type SearchParams = Promise<{
  category?: string;
  badge?: "WINNING" | "NEW" | "RECOMMENDED";
  q?: string;
}>;

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireSession(["PARTNER"]);
  const params = await searchParams;

  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.partnerPortal.catalogue;
  const c = dict.common;
  const currencySymbol = locale === "ar" ? "د.ت" : locale === "en" ? "TND" : "DT";

  const categoryId = params.category?.trim();
  const badge = params.badge;
  const search = params.q?.trim();

  const [stats, assignments] = await Promise.all([
    getPartnerCatalogueStats(user.partnerId!),
    listAssignedProducts(user.partnerId!, {
      categoryId: categoryId || undefined,
      badge: badge || undefined,
      search: search || undefined,
    }),
  ]);

  const hasActiveFilters = Boolean(categoryId || badge || search);

  const buildFilterUrl = (overrides: {
    category?: string | null;
    badge?: string | null;
    q?: string | null;
  }) => {
    const sp = new URLSearchParams();
    const finalCat = overrides.category !== undefined ? overrides.category : categoryId;
    const finalBadge = overrides.badge !== undefined ? overrides.badge : badge;
    const finalQ = overrides.q !== undefined ? overrides.q : search;

    if (finalCat) sp.set("category", finalCat);
    if (finalBadge) sp.set("badge", finalBadge);
    if (finalQ) sp.set("q", finalQ);

    const query = sp.toString();
    return query ? `/catalogue?${query}` : "/catalogue";
  };

  const resetFiltersLabel = locale === "ar" ? "إعادة ضبط الفلاتر" : locale === "en" ? "Reset filters" : "Réinitialiser les filtres";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        {hasActiveFilters && (
          <Button asChild variant="outline" size="sm" className="gap-1.5 self-start sm:self-auto">
            <Link href="/catalogue">
              <RotateCcw className="h-3.5 w-3.5" />
              {resetFiltersLabel}
            </Link>
          </Button>
        )}
      </div>

      {/* Search and Badge discovery pills */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form method="GET" className="relative flex-1 max-w-md">
          {categoryId && <input type="hidden" name="category" value={categoryId} />}
          {badge && <input type="hidden" name="badge" value={badge} />}
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            name="q"
            placeholder={t.searchPlaceholder}
            defaultValue={search ?? ""}
            className="pl-9 pr-9 bg-card"
          />
          {search && (
            <Link
              href={buildFilterUrl({ q: null })}
              className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              title="Effacer la recherche"
            >
              <X className="h-4 w-4" />
            </Link>
          )}
        </form>

        {/* Badges quick filter pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <Link
            href={buildFilterUrl({ badge: null })}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
              !badge
                ? "bg-foreground text-background border-foreground font-semibold"
                : "border-border hover:bg-muted text-muted-foreground"
            }`}
          >
            {t.allProducts} ({stats.totalAssigned})
          </Link>

          <Link
            href={buildFilterUrl({ badge: badge === "WINNING" ? null : "WINNING" })}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              badge === "WINNING"
                ? "bg-amber-500 text-white border-amber-500 font-semibold shadow-xs"
                : "border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/5 hover:bg-amber-500/10"
            }`}
          >
            <Trophy className="h-3.5 w-3.5" />
            <span>{t.winningProducts}</span>
            <span className="opacity-80">({stats.winningCount})</span>
          </Link>

          <Link
            href={buildFilterUrl({ badge: badge === "RECOMMENDED" ? null : "RECOMMENDED" })}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              badge === "RECOMMENDED"
                ? "bg-rose-500 text-white border-rose-500 font-semibold shadow-xs"
                : "border-rose-500/30 text-rose-700 dark:text-rose-400 bg-rose-500/5 hover:bg-rose-500/10"
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            <span>{t.recommended}</span>
            <span className="opacity-80">({stats.recommendedCount})</span>
          </Link>

          <Link
            href={buildFilterUrl({ badge: badge === "NEW" ? null : "NEW" })}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              badge === "NEW"
                ? "bg-sky-500 text-white border-sky-500 font-semibold shadow-xs"
                : "border-sky-500/30 text-sky-700 dark:text-sky-400 bg-sky-500/5 hover:bg-sky-500/10"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{dict.products.isNew}</span>
            <span className="opacity-80">({stats.newCount})</span>
          </Link>
        </div>
      </div>

      {/* Category Tabs / Bar */}
      <CategoryFilterBar
        categories={stats.categories}
        selectedCategoryId={categoryId}
        totalAssigned={stats.totalAssigned}
        activeBadge={badge}
        searchQuery={search}
      />

      {/* Product Grid or Empty State */}
      {assignments.length === 0 ? (
        stats.totalAssigned === 0 ? (
          <EmptyState
            title={locale === "ar" ? "لا توجد منتجات مخصصة حالياً" : locale === "en" ? "No products assigned yet" : "Aucun produit assigné pour le moment"}
            description={locale === "ar" ? "سيقوم فريق العمل بتعيين منتجات لك قريباً لتتمكن من الترويج لها." : locale === "en" ? "The team will assign you products soon so you can promote them." : "L'équipe vous assignera des produits prochainement. Vous pourrez alors les promouvoir sur vos réseaux."}
          />
        ) : categoryId ? (
          <EmptyState
            title={
              locale === "ar"
                ? "لا توجد منتجات في هذا التصنيف حالياً"
                : locale === "en"
                ? "No products in this category yet"
                : "Aucun produit dans cette catégorie pour le moment"
            }
            description={
              locale === "ar"
                ? "لم يتم تعيين منتجات لك في هذا التصنيف بعد. يمكنك استكشاف باقي التصنيفات أو إعادة ضبط الفلاتر."
                : locale === "en"
                ? "No products have been assigned to you in this category yet. You can explore other categories or reset filters."
                : "Aucun produit ne vous est encore assigné dans cette catégorie. Vous pouvez explorer les autres catégories ou réinitialiser vos filtres."
            }
            action={
              <Button asChild variant="outline">
                <Link href="/catalogue">{resetFiltersLabel}</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={t.outOfStock}
            description={locale === "ar" ? "حاول تعديل بحثك أو إعادة ضبط عوامل التصفية." : locale === "en" ? "Try adjusting your search or resetting category filters." : "Essayez de modifier votre recherche ou de réinitialiser vos filtres de catégorie et de badge."}
            action={
              <Button asChild variant="outline">
                <Link href="/catalogue">{resetFiltersLabel}</Link>
              </Button>
            }
          />
        )
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map(({ product }) => (
            <PartnerProductCard
              key={product.id}
              product={{
                id: product.id,
                name: product.name,
                description: product.description,
                sellingPrice: product.sellingPrice.toString(),
                purchaseCost: product.purchaseCost ? product.purchaseCost.toString() : null,
                status: product.status,
                isWinning: product.isWinning,
                isRecommended: product.isRecommended,
                isNew: product.isNew,
                categoryRef: product.categoryRef,
                media: product.media.map((m) => ({
                  id: m.id,
                  type: m.type,
                  googleDriveUrl: m.googleDriveUrl,
                  title: m.title,
                  sortOrder: m.sortOrder,
                })),
                marketingAssets: product.marketingAssets.map((a) => ({
                  id: a.id,
                  kind: a.kind,
                  title: a.title,
                })),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
