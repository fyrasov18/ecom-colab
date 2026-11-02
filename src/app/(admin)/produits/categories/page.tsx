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
  const params = await searchParams;
  const search = params.search?.trim();
  const status = params.status;

  const categories = await listCategoriesAdmin({
    search: search || undefined,
    status: status || undefined,
  });

  const totalCategories = categories.length;
  const activeCount = categories.filter((c) => c.isActive).length;
  const inactiveCount = totalCategories - activeCount;
  const totalProducts = categories.reduce((sum, c) => sum + c._count.products, 0);

  const availableCategoriesList = categories.map((c) => ({
    id: c.id,
    name: c.name,
  }));

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
              <ArrowLeft className="h-3 w-3" /> Retour aux produits
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderTree className="h-6 w-6 text-primary" />
            Gestion des catégories
          </h1>
          <p className="text-sm text-muted-foreground">
            Créez, organisez et structurez les catégories de produits pour guider vos partenaires.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <CategoryModal />
        </div>
      </div>

      {/* KPI Stats cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs font-medium text-muted-foreground">Total catégories</div>
          <div className="text-2xl font-bold mt-1">{totalCategories}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs font-medium text-muted-foreground">Catégories actives</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">{activeCount}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs font-medium text-muted-foreground">Catégories inactives</div>
          <div className="text-2xl font-bold mt-1 text-muted-foreground">{inactiveCount}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs font-medium text-muted-foreground">Produits classés</div>
          <div className="text-2xl font-bold mt-1 text-primary">{totalProducts}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <form method="GET" className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            name="search"
            placeholder="Rechercher une catégorie..."
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
            Toutes ({totalCategories})
          </Link>
          <Link
            href="/produits/categories?status=ACTIVE"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              status === "ACTIVE"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted text-muted-foreground"
            }`}
          >
            Actives ({activeCount})
          </Link>
          <Link
            href="/produits/categories?status=INACTIVE"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              status === "INACTIVE"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted text-muted-foreground"
            }`}
          >
            Inactives ({inactiveCount})
          </Link>
        </div>
      </div>

      {/* Table */}
      {categories.length === 0 ? (
        <EmptyState
          title="Aucune catégorie trouvée"
          description={
            search
              ? "Aucune catégorie ne correspond à votre recherche. Essayez d'autres termes."
              : "Créez votre première catégorie pour organiser les produits."
          }
          action={<CategoryModal />}
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">Ordre</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-center">Produits</TableHead>
                <TableHead className="text-center">Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                              Modifier
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
