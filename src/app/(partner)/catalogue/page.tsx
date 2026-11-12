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
import { deriveGoogleDriveUrls } from "@/lib/google-drive";
import { CATEGORY_ICONS } from "@/app/(admin)/produits/categories/category-modal";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

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
      <div className="border-b pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <Link
            href={buildFilterUrl({ category: null })}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all shrink-0 ${
              !categoryId
                ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary shadow-xs"
                : "border-border hover:bg-muted text-muted-foreground"
            }`}
          >
            <Package className="h-4 w-4" />
            <span>{dict.products.allCategories}</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-foreground">
              {stats.totalAssigned}
            </span>
          </Link>

          {stats.categories.map((category) => {
            const isSelected = categoryId === category.id;
            const IconComponent =
              (category.icon && CATEGORY_ICONS[category.icon]) || Package;

            return (
              <Link
                key={category.id}
                href={buildFilterUrl({
                  category: isSelected ? null : category.id,
                })}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all shrink-0 ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary shadow-xs"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                <IconComponent className="h-4 w-4" />
                <span>{category.name}</span>
                {category.nameAr && (
                  <span dir="rtl" className="text-[11px] opacity-75 font-arabic">
                    ({category.nameAr})
                  </span>
                )}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {category.productCount}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Product Grid or Empty State */}
      {assignments.length === 0 ? (
        stats.totalAssigned === 0 ? (
          <EmptyState
            title={locale === "ar" ? "لا توجد منتجات مخصصة حالياً" : locale === "en" ? "No products assigned yet" : "Aucun produit assigné pour le moment"}
            description={locale === "ar" ? "سيقوم فريق العمل بتعيين منتجات لك قريباً لتتمكن من الترويج لها." : locale === "en" ? "The team will assign you products soon so you can promote them." : "L'équipe vous assignera des produits prochainement. Vous pourrez alors les promouvoir sur vos réseaux."}
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map(({ product }) => {
            const cover =
              product.media.find((m) => m.type === "THUMBNAIL") ??
              product.media.find((m) => m.type === "IMAGE");
            const coverDrive = cover ? deriveGoogleDriveUrls(cover.googleDriveUrl) : null;

            return (
              <Link key={product.id} href={`/catalogue/${product.id}`} className="group">
                <Card className="h-full flex flex-col justify-between transition-all duration-200 group-hover:shadow-md group-hover:border-primary/40 overflow-hidden">
                  <div>
                    {/* Image & Top Badges */}
                    <div className="relative h-44 overflow-hidden rounded-t-xl bg-muted">
                      {coverDrive ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={coverDrive.previewUrl}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          {locale === "ar" ? "لا توجد صورة" : locale === "en" ? "No image" : "Aucune image"}
                        </div>
                      )}

                      {/* Status Badges Overlay */}
                      <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5 max-w-[85%]">
                        {product.status === "OUT_OF_STOCK" && (
                          <Badge variant="warning" className="shadow-xs text-[11px]">
                            {t.outOfStock}
                          </Badge>
                        )}
                        {product.isWinning && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500 text-white font-semibold px-2 py-0.5 text-[11px] shadow-xs">
                            ⭐ {locale === "ar" ? "منتج رابح" : locale === "en" ? "Winner" : "Produit gagnant"}
                          </span>
                        )}
                        {product.isRecommended && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-500 text-white font-semibold px-2 py-0.5 text-[11px] shadow-xs">
                            🔥 {t.recommended}
                          </span>
                        )}
                        {product.isNew && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-sky-500 text-white font-semibold px-2 py-0.5 text-[11px] shadow-xs">
                            🆕 {dict.products.isNew}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <CardContent className="space-y-2.5 p-4">
                      {/* Category tag */}
                      {product.categoryRef && (
                        <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          <span>{product.categoryRef.name}</span>
                          {product.categoryRef.nameAr && (
                            <span dir="rtl" className="text-[11px] text-muted-foreground font-arabic">
                              ({product.categoryRef.nameAr})
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-semibold text-base leading-snug group-hover:text-primary transition-colors">
                          {product.name}
                        </h2>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                      </div>

                      {product.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                      )}
                    </CardContent>
                  </div>

                  {/* Bottom details */}
                  <div className="px-4 pb-4 pt-1 flex items-center justify-between border-t mt-2">
                    <div>
                      <span className="text-xs text-muted-foreground block">{t.catalogPrice}</span>
                      <span className="text-base font-bold text-foreground">
                        {formatPrice(product.sellingPrice)} {currencySymbol}
                      </span>
                    </div>

                    <Badge variant="info" className="text-xs">
                      {product.marketingAssets.length} {locale === "ar" ? "ملفات تسويقية" : locale === "en" ? "marketing kit(s)" : "kit(s) média"}
                    </Badge>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
