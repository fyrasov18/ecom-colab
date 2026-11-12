import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Plus, Search, ExternalLink, Lightbulb, Clock, CheckCircle2, PackageCheck, AlertCircle } from "lucide-react";
import { requireSession } from "@/lib/rbac";
import { listPartnerSuggestions } from "@/modules/suggestions/service";
import { SuggestionStatusBadge } from "@/components/suggestions/status-badge";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { ProductSuggestionStatus } from "@prisma/client";

export const metadata: Metadata = {
  title: "Suggestions de produits — Ecom Partner",
};

export default async function PartnerSuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const user = await requireSession(["PARTNER"]);
  if (!user.partnerId) {
    return null;
  }

  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.productSuggestions;

  const statusFilter =
    typeof sp.status === "string" && sp.status.trim()
      ? (sp.status.trim() as ProductSuggestionStatus)
      : undefined;

  const searchQuery =
    typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : undefined;

  const items = await listPartnerSuggestions(user.partnerId, {
    status: statusFilter,
    search: searchQuery,
  });

  // Calculate quick counters for current partner across statuses
  const allSuggestions = await listPartnerSuggestions(user.partnerId);
  const counts = {
    total: allSuggestions.length,
    pending: allSuggestions.filter((s) => s.status === "PENDING").length,
    underReview: allSuggestions.filter((s) => s.status === "UNDER_REVIEW").length,
    accepted: allSuggestions.filter((s) => s.status === "ACCEPTED").length,
    productCreated: allSuggestions.filter((s) => s.status === "PRODUCT_CREATED").length,
  };

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
            {t.subtitle}
          </p>
        </div>

        <Link
          href="/suggestions-produits/nouvelle"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm shadow hover:bg-primary/95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>{t.newSuggestion}</span>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">{t.kpiTotal}</span>
            <Lightbulb className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{counts.total}</div>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">{t.kpiPending}</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {counts.pending}
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">{t.kpiAccepted}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {counts.accepted}
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">{t.kpiCreated}</span>
            <PackageCheck className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-400">
            {counts.productCreated}
          </div>
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
              ? `/suggestions-produits?${queryParams.toString()}`
              : "/suggestions-produits";

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
        <form method="GET" action="/suggestions-produits" className="relative min-w-[240px]">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            name="q"
            defaultValue={searchQuery || ""}
            placeholder={t.searchPlaceholder}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </form>
      </div>

      {/* List or Grid */}
      {items.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed bg-card/50 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Lightbulb className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">{t.emptyTitle}</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {t.emptySubtitle}
          </p>
          <Link
            href="/suggestions-produits/nouvelle"
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/95 transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.newSuggestion}</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col rounded-2xl border bg-card hover:border-primary/40 hover:shadow-md transition-all overflow-hidden group"
            >
              {/* Image & Badges */}
              <div className="relative aspect-video w-full bg-muted/40 overflow-hidden">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Lightbulb className="w-8 h-8 opacity-40" />
                  </div>
                )}
                <div className="absolute top-2.5 right-2.5">
                  <SuggestionStatusBadge status={item.status} lang={locale} />
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                    {item.name}
                  </h4>

                  <div className="mt-2 flex items-baseline justify-between">
                    <div>
                      <span className="text-[11px] text-muted-foreground">Prix suggéré</span>
                      <div className="text-base font-bold text-foreground">
                        {item.estimatedSellingPrice.toFixed(2)} DT
                      </div>
                    </div>
                    {item.estimatedPurchasePrice && (
                      <div className="text-right">
                        <span className="text-[11px] text-muted-foreground">Coût estimé</span>
                        <div className="text-xs font-medium text-muted-foreground">
                          {item.estimatedPurchasePrice.toFixed(2)} DT
                        </div>
                      </div>
                    )}
                  </div>

                  {item.partnerFeedback && (
                    <div className="mt-3 p-2.5 rounded-xl bg-muted/50 border border-border/60 text-xs text-foreground/90">
                      <div className="flex items-center gap-1.5 font-medium text-primary text-[11px] mb-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{t.adminFeedback}</span>
                      </div>
                      <p className="line-clamp-2 text-muted-foreground">{item.partnerFeedback}</p>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs">
                  <span className="text-muted-foreground text-[11px]">
                    {new Date(item.createdAt).toLocaleDateString(locale === "ar" ? "ar-TN" : "fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>

                  <div className="flex items-center gap-2">
                    {item.status === "PRODUCT_CREATED" && item.productId && (
                      <Link
                        href={`/catalogue/${item.productId}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium text-[11px] hover:bg-purple-500/20 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Catalogue</span>
                      </Link>
                    )}

                    <Link
                      href={`/suggestions-produits/${item.id}`}
                      className="px-3 py-1 rounded-lg border bg-background hover:bg-accent font-medium text-[11px] transition-colors"
                    >
                      Détails
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
