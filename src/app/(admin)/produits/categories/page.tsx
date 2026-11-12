import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  FolderTree,
  Package,
  Search,
} from "lucide-react";
import { requireSession } from "@/lib/rbac";
import { listCategoriesAdmin } from "@/modules/categories/service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CategoryModal, CATEGORY_ICONS } from "./category-modal";
import { DeleteCategoryDialog } from "./delete-category-dialog";
import { ToggleCategoryStatusButton } from "./toggle-status-button";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = { title: "Gestion des catégories" };

type SearchParams = Promise<{
  search?: string;
  status?: "ACTIVE" | "INACTIVE";
}>;

export default async function CategoriesAdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.products;
  const c = dict.common;

  const params = await searchParams;
  const search = params.search?.trim();
  const status = params.status;

  const categories = await listCategoriesAdmin({
    search: search || undefined,
    status: status || undefined,
  });

  const totalCategories = categories.length;
  const activeCount = categories.filter((cat) => cat.isActive).length;
  const inactiveCount = totalCategories - activeCount;
  const totalProducts = categories.reduce((sum, cat) => sum + cat._count.products, 0);

  const availableCategoriesList = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
  }));

  const backLabel = locale === "ar" ? "العودة إلى المنتجات" : locale === "en" ? "Back to products" : "Retour aux produits";
  const totalCatLabel = locale === "ar" ? "إجمالي الفئات" : locale === "en" ? "Total categories" : "Total catégories";
  const activeCatLabel = locale === "ar" ? "فئات نشطة" : locale === "en" ? "Active categories" : "Catégories actives";
  const inactiveCatLabel = locale === "ar" ? "فئات غير نشطة" : locale === "en" ? "Inactive categories" : "Catégories inactives";
  const classifiedProdLabel = locale === "ar" ? "المنتجات المصنفة" : locale === "en" ? "Classified products" : "Produits classés";
  const searchCatPlaceholder = locale === "ar" ? "البحث عن فئة..." : locale === "en" ? "Search category..." : "Rechercher une catégorie...";
  const orderLabel = locale === "ar" ? "الترتيب" : locale === "en" ? "Order" : "Ordre";
  const noCatTitle = locale === "ar" ? "لم يتم العثور على فئات" : locale === "en" ? "No categories found" : "Aucune catégorie trouvée";
  const noCatDesc = search
    ? (locale === "ar" ? "لا توجد فئات تطابق بحثك." : locale === "en" ? "No category matches your search." : "Aucune catégorie ne correspond à votre recherche.")
    : (locale === "ar" ? "أنشئ فئتك الأولى لتنظيم المنتجات." : locale === "en" ? "Create your first category to organize products." : "Créez votre première catégorie pour organiser les produits.");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/produits"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> {backLabel}
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderTree className="h-6 w-6 text-primary" />
            {t.categoriesTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.categoriesSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <CategoryModal />
        </div>
      </div>

      {/* KPI Stats cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs font-medium text-muted-foreground">{totalCatLabel}</div>
          <div className="text-2xl font-bold mt-1">{totalCategories}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs font-medium text-muted-foreground">{activeCatLabel}</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">{activeCount}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs font-medium text-muted-foreground">{inactiveCatLabel}</div>
          <div className="text-2xl font-bold mt-1 text-muted-foreground">{inactiveCount}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs font-medium text-muted-foreground">{classifiedProdLabel}</div>
          <div className="text-2xl font-bold mt-1 text-primary">{totalProducts}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <form method="GET" className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            name="search"
            placeholder={searchCatPlaceholder}
            defaultValue={search ?? ""}
            className="pl-9"
          />
        </form>

        <div className="flex items-center gap-2">
          <Link
            href="/produits/categories"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              !status
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted text-muted-foreground"
            }`}
          >
            {c.all} ({totalCategories})
          </Link>
          <Link
            href="/produits/categories?status=ACTIVE"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              status === "ACTIVE"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted text-muted-foreground"
            }`}
          >
            {c.active} ({activeCount})
          </Link>
          <Link
            href="/produits/categories?status=INACTIVE"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              status === "INACTIVE"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted text-muted-foreground"
            }`}
          >
            {c.inactive} ({inactiveCount})
          </Link>
        </div>
      </div>

      {/* Table */}
      {categories.length === 0 ? (
        <EmptyState
          title={noCatTitle}
          description={noCatDesc}
          action={<CategoryModal />}
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">{orderLabel}</TableHead>
                <TableHead>{t.category}</TableHead>
                <TableHead>{t.categorySlug}</TableHead>
                <TableHead className="text-center">{t.productsCount}</TableHead>
                <TableHead className="text-center">{c.status}</TableHead>
                <TableHead className="text-right">{c.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => {
                const IconComponent =
                  (category.icon && CATEGORY_ICONS[category.icon]) || Package;

                return (
                  <TableRow key={category.id} className="hover:bg-muted/30">
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">
                      #{category.displayOrder}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {category.name}
                            </span>
                            {category.nameAr && (
                              <span
                                dir="rtl"
                                className="text-xs text-muted-foreground font-arabic"
                              >
                                ({category.nameAr})
                              </span>
                            )}
                          </div>
                          {category.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 max-w-md">
                              {category.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {category.slug}
                    </TableCell>

                    <TableCell className="text-center">
                      <Link
                        href={`/produits?category=${category.id}`}
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        <Badge variant={category._count.products > 0 ? "secondary" : "outline"}>
                          <Package className="h-3 w-3 mr-1" />
                          {category._count.products}
                        </Badge>
                      </Link>
                    </TableCell>

                    <TableCell className="text-center">
                      <ToggleCategoryStatusButton
                        id={category.id}
                        isActive={category.isActive}
                      />
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <CategoryModal
                          category={category}
                          trigger={
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                              {c.edit}
                            </Button>
                          }
                        />

                        <DeleteCategoryDialog
                          category={{
                            id: category.id,
                            name: category.name,
                            productCount: category._count.products,
                          }}
                          availableCategories={availableCategoriesList}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
