import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  Sparkles,
  Building2,
  DollarSign,
  Target,
  User,
  Phone,
  History,
  Lock,
  MessageSquare,
} from "lucide-react";
import { requireSession } from "@/lib/rbac";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import {
  getAdminSuggestion,
  getAvailableProductsForLinking,
} from "@/modules/suggestions/service";
import { listActiveCategories } from "@/modules/categories/service";
import { SuggestionStatusBadge } from "@/components/suggestions/status-badge";
import { AdminDecisionPanel } from "@/components/suggestions/admin-decision-panel";
import { getServerLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Examen de la suggestion — Admin",
};

export default async function AdminSuggestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSession(["ADMIN", "SUPER_ADMIN"]);
  const canView = await hasPermission(user, PERMISSIONS.VIEW_PRODUCT_SUGGESTIONS);
  const canManage = await hasPermission(user, PERMISSIONS.MANAGE_PRODUCT_SUGGESTIONS);

  if (!canView && !canManage) {
    redirect("/dashboard");
  }

  const locale = await getServerLocale();

  const suggestion = await getAdminSuggestion(id);
  if (!suggestion) {
    return notFound();
  }

  const [categories, availableProducts] = await Promise.all([
    listActiveCategories(),
    getAvailableProductsForLinking(),
  ]);

  const numSelling = suggestion.estimatedSellingPrice;
  const numPurchase = suggestion.estimatedPurchasePrice || 0;
  const grossMargin = numSelling > 0 && numPurchase > 0 ? numSelling - numPurchase : null;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Bar with Back Link */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link
          href="/produits/suggestions"
          className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à la liste des suggestions</span>
        </Link>

        <div className="flex items-center gap-2">
          <SuggestionStatusBadge status={suggestion.status} lang={locale} />
        </div>
      </div>

      {/* Main Grid: Left (Product Image & Partner Attribution), Right (Decision Panel & Details) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-6">
          {/* Visuals & Pricing Card */}
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

            {/* Additional images */}
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

            <div className="p-5 space-y-4 border-t text-xs">
              <div>
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                  Prix de vente proposé
                </span>
                <div className="text-2xl font-bold text-foreground">
                  {suggestion.estimatedSellingPrice.toFixed(2)} DT
                </div>
              </div>

              {suggestion.estimatedPurchasePrice && (
                <div className="pt-2 border-t flex items-center justify-between">
                  <span className="text-muted-foreground">Coût d&apos;achat estimé</span>
                  <span className="font-semibold text-foreground">
                    {suggestion.estimatedPurchasePrice.toFixed(2)} DT
                  </span>
                </div>
              )}

              {grossMargin !== null && (
                <div className="pt-1 flex items-center justify-between">
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

          {/* Partner Attribution Card */}
          <div className="p-5 rounded-2xl border bg-card shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b pb-2">
              <User className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Partenaire Initiateur
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-muted-foreground text-[11px]">Nom :</span>
                <div className="font-semibold text-foreground text-sm">
                  {suggestion.partner.displayName}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-[11px]">Code partenaire :</span>
                <span className="font-mono px-2 py-0.5 rounded bg-muted font-bold text-[11px]">
                  {suggestion.partner.code}
                </span>
              </div>

              {suggestion.partner.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    <span>Téléphone :</span>
                  </span>
                  <span className="font-medium text-foreground">{suggestion.partner.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Supplier Info if available */}
          {(suggestion.supplierName || suggestion.supplierContact || suggestion.supplierUrl) && (
            <div className="p-5 rounded-2xl border bg-card shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b pb-2">
                <Building2 className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Fournisseur Proposé
                </h3>
              </div>

              <div className="space-y-2 text-xs">
                {suggestion.supplierName && (
                  <div>
                    <span className="text-muted-foreground text-[11px]">Nom / Entreprise :</span>
                    <p className="font-semibold text-foreground">{suggestion.supplierName}</p>
                  </div>
                )}
                {suggestion.supplierContact && (
                  <div>
                    <span className="text-muted-foreground text-[11px]">Contact :</span>
                    <p className="font-semibold text-foreground">{suggestion.supplierContact}</p>
                  </div>
                )}
                {suggestion.supplierUrl && (
                  <div>
                    <span className="text-muted-foreground text-[11px]">Lien produit :</span>
                    <p className="mt-0.5">
                      <a
                        href={suggestion.supplierUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1 font-medium break-all"
                      >
                        <span>Visiter le lien</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Decision Center Panel */}
          {canManage && (
            <AdminDecisionPanel
              suggestion={suggestion}
              categories={categories}
              availableProducts={availableProducts}
            />
          )}

          {/* Product Specifications & Motivation */}
          <div className="p-6 rounded-2xl border bg-card shadow-sm space-y-5">
            <div>
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                Argumentaire & Détails
              </span>
              <h2 className="text-lg font-bold text-foreground mt-1">
                {suggestion.name}
              </h2>
            </div>

            {suggestion.description && (
              <div className="space-y-1 pt-3 border-t">
                <h4 className="text-xs font-semibold text-foreground">Description fournie</h4>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                  {suggestion.description}
                </p>
              </div>
            )}

            {suggestion.characteristics && (
              <div className="space-y-1 pt-3 border-t">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Caractéristiques & Atouts</span>
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                  {suggestion.characteristics}
                </p>
              </div>
            )}

            {suggestion.targetAudience && (
              <div className="space-y-1 pt-3 border-t">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-primary" />
                  <span>Public cible identifié</span>
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                  {suggestion.targetAudience}
                </p>
              </div>
            )}

            {suggestion.partnerReason && (
              <div className="space-y-1 pt-3 border-t">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-primary" />
                  <span>Pourquoi le partenaire veut le vendre</span>
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                  {suggestion.partnerReason}
                </p>
              </div>
            )}

            {suggestion.additionalNotes && (
              <div className="space-y-1 pt-3 border-t">
                <h4 className="text-xs font-semibold text-foreground">Notes complémentaires</h4>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                  {suggestion.additionalNotes}
                </p>
              </div>
            )}
          </div>

          {/* Audit History Timeline */}
          <div className="p-6 rounded-2xl border bg-card shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b pb-3">
              <History className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Historique des transitions & Audit
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
                    <div className="mt-2 p-2.5 rounded-xl bg-muted/40 border text-xs">
                      <div className="text-[11px] font-semibold text-primary mb-0.5 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        <span>Message envoyé au partenaire :</span>
                      </div>
                      <p className="text-muted-foreground">{event.feedback}</p>
                    </div>
                  )}

                  {event.internalNotes && (
                    <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                      <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 mb-0.5 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>Note administrative confidentielle :</span>
                      </div>
                      <p className="text-amber-900 dark:text-amber-300 font-mono text-[11px]">
                        {event.internalNotes}
                      </p>
                    </div>
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
