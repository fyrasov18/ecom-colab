import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  Lightbulb,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  PackageCheck,
  XCircle,
  TrendingUp,
  Award,
  Layers,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { requireSession } from "@/lib/rbac";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import {
  listAdminSuggestions,
  getPartnerContributionAnalytics,
} from "@/modules/suggestions/service";
import { SuggestionStatusBadge } from "@/components/suggestions/status-badge";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { ProductSuggestionStatus } from "@prisma/client";

export const metadata: Metadata = {
  title: "Suggestions & Contribution des Partenaires — Ecom Partner Admin",
};

export default async function AdminSuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const user = await requireSession(["ADMIN", "SUPER_ADMIN"]);
  const canView = await hasPermission(user, PERMISSIONS.VIEW_PRODUCT_SUGGESTIONS);
  const canManage = await hasPermission(user, PERMISSIONS.MANAGE_PRODUCT_SUGGESTIONS);

  if (!canView && !canManage) {
    redirect("/dashboard");
  }

  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.productSuggestions;

  const currentTab = (typeof sp.tab === "string" && sp.tab === "analytics") ? "analytics" : "suggestions";

  if (currentTab === "analytics") {
    const search = typeof sp.q === "string" ? sp.q : undefined;
    const sortBy = (typeof sp.sortBy === "string" ? sp.sortBy : "total") as "total" | "accepted" | "created" | "rate" | "name";
    const sortOrder = sp.sortOrder === "asc" ? "asc" : "desc";

    const analytics = await getPartnerContributionAnalytics({ search, sortBy, sortOrder });
    const { global, partners } = analytics;

    // Overall acceptance rate calculation
    const totalDecisions = global.accepted + global.rejected + global.productsCreated;
    const globalRate =
      totalDecisions > 0
        ? (((global.accepted + global.productsCreated) / totalDecisions) * 100).toFixed(1)
        : null;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {t.analyticsTitle}
              </h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.analyticsSubtitle}
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-muted border">
            <Link
              href="/produits/suggestions"
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              {t.suggestionsTab}
            </Link>
            <Link
              href="/produits/suggestions?tab=analytics"
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-background text-foreground shadow-sm transition-colors"
            >
              {t.contributionTab}
            </Link>
          </div>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-xl border bg-card shadow-sm">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">{t.kpiTotal}</span>
            <div className="mt-2 text-2xl font-bold text-foreground">{global.totalSuggestions}</div>
          </div>
          <div className="p-4 rounded-xl border bg-card shadow-sm">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">{t.kpiPending}</span>
            <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {global.pendingReview}
            </div>
          </div>
          <div className="p-4 rounded-xl border bg-card shadow-sm">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">{t.kpiUnderReview}</span>
            <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
              {global.underReview}
            </div>
          </div>
          <div className="p-4 rounded-xl border bg-card shadow-sm">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">{t.kpiAccepted}</span>
            <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {global.accepted}
            </div>
          </div>
          <div className="p-4 rounded-xl border bg-card shadow-sm">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">{t.kpiCreated}</span>
            <div className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-400">
              {global.productsCreated}
            </div>
          </div>
          <div className="p-4 rounded-xl border bg-card shadow-sm">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">{t.acceptanceRate}</span>
            <div className="mt-2 text-2xl font-bold text-primary">
              {globalRate ? `${globalRate}%` : "—"}
            </div>
          </div>
        </div>

        {/* Attribution & Separation Notice */}
        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-foreground">
              Traçabilité & Attribution garantie des Partenaires
            </p>
            <p className="text-muted-foreground mt-0.5">
              Chaque produit issu d&apos;une proposition conserve de façon permanente la référence de son partenaire initiateur (1-à-1 unique). Ces métriques évaluent l&apos;engagement et la force de sourcing de vos partenaires. Le suivi de contribution reste strictement distinct des calculs financiers et commissions.
            </p>
          </div>
        </div>

        {/* Filter & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl border bg-card shadow-sm">
          <form method="GET" action="/produits/suggestions" className="relative w-full sm:w-80">
            <input type="hidden" name="tab" value="analytics" />
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              name="q"
              defaultValue={search || ""}
              placeholder="Filtrer par partenaire ou code..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </form>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Trier par :</span>
            <Link
              href={`/produits/suggestions?tab=analytics&sortBy=total&sortOrder=${sortBy === "total" && sortOrder === "desc" ? "asc" : "desc"}`}
              className={`px-2.5 py-1 rounded-lg border font-medium ${sortBy === "total" ? "bg-primary/10 text-primary border-primary/30" : "bg-background"}`}
            >
              Total
            </Link>
            <Link
              href={`/produits/suggestions?tab=analytics&sortBy=created&sortOrder=${sortBy === "created" && sortOrder === "desc" ? "asc" : "desc"}`}
              className={`px-2.5 py-1 rounded-lg border font-medium ${sortBy === "created" ? "bg-primary/10 text-primary border-primary/30" : "bg-background"}`}
            >
              Produits créés
            </Link>
            <Link
              href={`/produits/suggestions?tab=analytics&sortBy=rate&sortOrder=${sortBy === "rate" && sortOrder === "desc" ? "asc" : "desc"}`}
              className={`px-2.5 py-1 rounded-lg border font-medium ${sortBy === "rate" ? "bg-primary/10 text-primary border-primary/30" : "bg-background"}`}
            >
              Taux
            </Link>
          </div>
        </div>

        {/* Partner Leaderboard Table */}
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b text-muted-foreground uppercase text-[11px] font-semibold">
                <tr>
                  <th className="px-4 py-3">{t.partnerName}</th>
                  <th className="px-3 py-3 text-center">{t.kpiTotal}</th>
                  <th className="px-3 py-3 text-center text-emerald-600 dark:text-emerald-400">{t.kpiAccepted}</th>
                  <th className="px-3 py-3 text-center text-rose-600 dark:text-rose-400">{t.kpiRejected}</th>
                  <th className="px-3 py-3 text-center text-purple-600 dark:text-purple-400">{t.kpiCreated}</th>
                  <th className="px-3 py-3 text-center">{t.acceptanceRate}</th>
                  <th className="px-4 py-3">{t.introducedProducts}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {partners.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Aucun partenaire trouvé pour cette recherche.
                    </td>
                  </tr>
                ) : (
                  partners.map((p) => (
                    <tr key={p.partnerId} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[11px]">
                            {p.partnerName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{p.partnerName}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">{p.partnerCode}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3.5 text-center font-bold text-foreground">
                        {p.totalSuggestions}
                      </td>

                      <td className="px-3 py-3.5 text-center font-semibold text-emerald-600 dark:text-emerald-400">
                        {p.acceptedSuggestions}
                      </td>

                      <td className="px-3 py-3.5 text-center font-semibold text-rose-600 dark:text-rose-400">
                        {p.rejectedSuggestions}
                      </td>

                      <td className="px-3 py-3.5 text-center font-bold text-purple-600 dark:text-purple-400">
                        {p.productsCreated}
                      </td>

                      <td className="px-3 py-3.5 text-center">
                        {p.acceptanceRate !== null ? (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[11px] ${
                              p.acceptanceRate >= 50
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : p.acceptanceRate >= 20
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {p.acceptanceRate}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {p.linkedProducts.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-w-sm">
                            {p.linkedProducts.map((prod) => (
                              <Link
                                key={prod.id}
                                href={`/produits/${prod.id}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 font-medium text-[11px] transition-colors"
                              >
                                <span>{prod.name}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">
                            {t.noOriginProducts}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // DEFAULT TAB: SUGGESTIONS LIST
  const statusFilter =
    typeof sp.status === "string" && sp.status.trim()
      ? (sp.status.trim() as ProductSuggestionStatus)
      : undefined;

  const searchQuery =
    typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : undefined;

  const items = await listAdminSuggestions({
    status: statusFilter,
    search: searchQuery,
  });

  const statusTabs = [
    { label: t.allStatuses, value: "" },
    { label: t.pending, value: "PENDING" },
    { label: t.underReview, value: "UNDER_REVIEW" },
    { label: t.accepted, value: "ACCEPTED" },
    { label: t.productCreated, value: "PRODUCT_CREATED" },
    { label: t.rejected, value: "REJECTED" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Lightbulb className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t.title}
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Examinez les suggestions proposées par les partenaires et convertissez-les en produits officiels du catalogue.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-muted border">
          <Link
            href="/produits/suggestions"
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-background text-foreground shadow-sm transition-colors"
          >
            {t.suggestionsTab}
          </Link>
          <Link
            href="/produits/suggestions?tab=analytics"
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            {t.contributionTab}
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-3 rounded-2xl border bg-card shadow-sm">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {statusTabs.map((tab) => {
            const isSelected = (!statusFilter && tab.value === "") || statusFilter === tab.value;
            const queryParams = new URLSearchParams();
            if (tab.value) queryParams.set("status", tab.value);
            if (searchQuery) queryParams.set("q", searchQuery);
            const href = queryParams.toString()
              ? `/produits/suggestions?${queryParams.toString()}`
              : "/produits/suggestions";

            return (
              <Link
                key={tab.value}
                href={href}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Search input form */}
        <form method="GET" action="/produits/suggestions" className="relative min-w-[260px]">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            name="q"
            defaultValue={searchQuery || ""}
            placeholder="Rechercher produit ou partenaire..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </form>
      </div>

      {/* Suggestions Table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b text-muted-foreground uppercase text-[11px] font-semibold">
              <tr>
                <th className="px-4 py-3">Produit suggéré</th>
                <th className="px-4 py-3">{t.originPartner}</th>
                <th className="px-3 py-3 text-right">{t.estimatedSellingPrice}</th>
                <th className="px-3 py-3 text-right">Fournisseur</th>
                <th className="px-3 py-3 text-center">{dict.common.status}</th>
                <th className="px-3 py-3 text-right">{dict.common.date}</th>
                <th className="px-4 py-3 text-right">{dict.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Aucune suggestion trouvée pour ces critères.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                    {/* Produit */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-muted/40 border overflow-hidden flex-shrink-0">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <Lightbulb className="w-5 h-5 opacity-40" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground text-sm line-clamp-1">
                            {item.name}
                          </div>
                          {item.description && (
                            <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Partenaire */}
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-foreground">{item.partner.displayName}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{item.partner.code}</div>
                    </td>

                    {/* Prix estimé */}
                    <td className="px-3 py-3.5 text-right font-bold text-foreground">
                      {item.estimatedSellingPrice.toFixed(2)} DT
                    </td>

                    {/* Fournisseur */}
                    <td className="px-3 py-3.5 text-right text-muted-foreground">
                      {item.estimatedPurchasePrice ? `${item.estimatedPurchasePrice.toFixed(2)} DT` : "—"}
                    </td>

                    {/* Statut */}
                    <td className="px-3 py-3.5 text-center">
                      <SuggestionStatusBadge status={item.status} lang={locale} />
                    </td>

                    {/* Date */}
                    <td className="px-3 py-3.5 text-right text-muted-foreground text-[11px]">
                      {new Date(item.createdAt).toLocaleDateString(locale === "ar" ? "ar-TN" : "fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/produits/suggestions/${item.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/95 transition-all shadow-sm"
                      >
                        <span>Examiner</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
