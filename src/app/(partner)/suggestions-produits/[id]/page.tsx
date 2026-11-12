import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  Sparkles,
  Building2,
  DollarSign,
  Target,
  FileText,
  AlertCircle,
  CheckCircle2,
  PackageCheck,
  Clock,
  History,
} from "lucide-react";
import { requireSession } from "@/lib/rbac";
import { getPartnerSuggestion } from "@/modules/suggestions/service";
import { SuggestionStatusBadge } from "@/components/suggestions/status-badge";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = {
  title: "Détail de la suggestion — Ecom Partner",
};

export default async function PartnerSuggestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSession(["PARTNER"]);
  if (!user.partnerId) {
    return notFound();
  }

  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.productSuggestions;

  const suggestion = await getPartnerSuggestion(user.partnerId, id);
  if (!suggestion) {
    return notFound();
  }

  const numSelling = suggestion.estimatedSellingPrice;
  const numPurchase = suggestion.estimatedPurchasePrice || 0;
  const grossMargin = numSelling > 0 && numPurchase > 0 ? numSelling - numPurchase : null;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Bar with Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/suggestions-produits"
          className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.backToList}</span>
        </Link>

        <SuggestionStatusBadge status={suggestion.status} lang={locale} />
      </div>

      {/* Main Banner if Product Created */}
      {suggestion.status === "PRODUCT_CREATED" && suggestion.linkedProduct && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-500/15 via-primary/10 to-transparent border border-purple-500/30 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-purple-500 text-white shadow-md">
              <PackageCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Félicitations ! Votre produit a été validé et créé 🚀
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Le produit « {suggestion.linkedProduct.name} » est désormais officiellement intégré au catalogue. Vous en êtes le partenaire initiateur !
              </p>
            </div>
          </div>
          <Link
            href={`/catalogue/${suggestion.linkedProduct.id}`}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-md transition-all whitespace-nowrap"
          >
            <ExternalLink className="w-4 h-4" />
            <span>{t.viewInCatalog}</span>
          </Link>
        </div>
      )}

      {/* Admin Feedback Highlight */}
      {suggestion.partnerFeedback && (
        <div className="p-5 rounded-2xl border bg-card/80 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{t.adminFeedback}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed pl-6">
            {suggestion.partnerFeedback}
          </p>
        </div>
      )}

      {/* Product Overview Layout: Left (Images & Prices), Right (Specs & Supplier) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Visuals & Financials */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="aspect-square relative bg-muted/30">
              {suggestion.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={suggestion.imageUrl}
                  alt={suggestion.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Sparkles className="w-10 h-10 opacity-30" />
                </div>
              )}
            </div>

            {/* Additional images gallery */}
            {suggestion.images && suggestion.images.length > 0 && (
              <div className="p-3 border-t bg-muted/10 grid grid-cols-4 gap-2">
                {suggestion.images.map((img, i) => (
                  <div key={i} className="aspect-square rounded-lg border overflow-hidden bg-background">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}

            <div className="p-5 space-y-4 border-t">
              <div>
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                  {t.estimatedSellingPrice}
                </span>
                <div className="text-2xl font-bold text-foreground">
                  {suggestion.estimatedSellingPrice.toFixed(2)} DT
                </div>
              </div>

              {suggestion.estimatedPurchasePrice && (
                <div className="pt-3 border-t flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t.estimatedPurchasePrice}</span>
                  <span className="font-semibold text-foreground">
                    {suggestion.estimatedPurchasePrice.toFixed(2)} DT
                  </span>
                </div>
              )}

              {grossMargin !== null && (
                <div className="pt-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Marge brute estimée</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    +{grossMargin.toFixed(2)} DT
                  </span>
                </div>
              )}

              <div className="pt-3 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Soumis le</span>
                </span>
                <span>
                  {new Date(suggestion.createdAt).toLocaleDateString(locale === "ar" ? "ar-TN" : "fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Detailed info & Supplier */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Info Card */}
          <div className="p-6 rounded-2xl border bg-card shadow-sm space-y-5">
            <div>
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                Fiche de suggestion
              </span>
              <h1 className="text-xl font-bold text-foreground mt-1">
                {suggestion.name}
              </h1>
            </div>

            {suggestion.description && (
              <div className="space-y-1.5 pt-3 border-t">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  <span>Description du produit</span>
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                  {suggestion.description}
                </p>
              </div>
            )}

            {suggestion.characteristics && (
              <div className="space-y-1.5 pt-3 border-t">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>{t.characteristics}</span>
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                  {suggestion.characteristics}
                </p>
              </div>
            )}

            {suggestion.targetAudience && (
              <div className="space-y-1.5 pt-3 border-t">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-primary" />
                  <span>{t.targetAudience}</span>
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                  {suggestion.targetAudience}
                </p>
              </div>
            )}

            {suggestion.partnerReason && (
              <div className="space-y-1.5 pt-3 border-t">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-primary" />
                  <span>{t.partnerReason}</span>
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                  {suggestion.partnerReason}
                </p>
              </div>
            )}

            {suggestion.additionalNotes && (
              <div className="space-y-1.5 pt-3 border-t">
                <h4 className="text-xs font-semibold text-foreground">
                  {t.additionalNotes}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                  {suggestion.additionalNotes}
                </p>
              </div>
            )}
          </div>

          {/* Supplier details card if any provided */}
          {(suggestion.supplierName || suggestion.supplierContact || suggestion.supplierUrl) && (
            <div className="p-6 rounded-2xl border bg-card shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Informations Fournisseur renseignées
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                {suggestion.supplierName && (
                  <div>
                    <span className="text-muted-foreground">Nom :</span>
                    <p className="font-semibold text-foreground mt-0.5">{suggestion.supplierName}</p>
                  </div>
                )}
                {suggestion.supplierContact && (
                  <div>
                    <span className="text-muted-foreground">Contact :</span>
                    <p className="font-semibold text-foreground mt-0.5">{suggestion.supplierContact}</p>
                  </div>
                )}
                {suggestion.supplierUrl && (
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Lien / URL :</span>
                    <p className="mt-0.5">
                      <a
                        href={suggestion.supplierUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1 font-medium break-all"
                      >
                        <span>{suggestion.supplierUrl}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline History */}
          <div className="p-6 rounded-2xl border bg-card shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                {t.timelineTitle}
              </h3>
            </div>

            <div className="space-y-4 pt-2">
              {suggestion.history.map((event) => (
                <div key={event.id} className="relative pl-6 pb-4 border-l border-border last:border-0 last:pb-0">
                  <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-primary" />
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <SuggestionStatusBadge status={event.newStatus} lang={locale} />
                      <span className="text-muted-foreground text-[11px]">par {event.actorName}</span>
                    </div>
                    <span className="text-muted-foreground text-[11px]">
                      {new Date(event.createdAt).toLocaleDateString(locale === "ar" ? "ar-TN" : "fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {event.feedback && (
                    <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                      {event.feedback}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
