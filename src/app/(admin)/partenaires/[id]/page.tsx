import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { getPartnerAdmin } from "@/modules/partners/service";
import { listPerformanceLevels } from "@/modules/finance/performance-service";
import { listProductOptions } from "@/modules/products/service";
import { getPartnerFinanceCard } from "@/modules/finance/queries";
import {
  LEDGER_STATUS_LABELS,
  LEDGER_STATUS_VARIANTS,
  LEDGER_TYPE_LABELS,
  WITHDRAWAL_STATUS_LABELS,
  WITHDRAWAL_STATUS_VARIANTS,
} from "@/modules/finance/labels";
import { requireSession } from "@/lib/rbac";
import { formatPrice } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import {
  addPartnerSocial,
  changePartnerStatus,
  removeAssignment,
  removePartnerSocial,
} from "../actions";
import { changePartnerLevel } from "../../parametres/performance-actions";
import { AssignProductForm } from "./assign-product-form";

export const metadata: Metadata = { title: "Partenaire" };

const STATUS_BADGE: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  ACTIVE: "success",
  PENDING: "warning",
  SUSPENDED: "warning",
  REJECTED: "destructive",
  CLOSED: "destructive",
};

const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  OTHER: "Autre",
};

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const [partner, productOptions, finance, levels] = await Promise.all([
    getPartnerAdmin(id),
    listProductOptions(),
    getPartnerFinanceCard(id, { limit: 5 }),
    listPerformanceLevels(),
  ]);
  if (!partner) notFound();

  const assignedIds = new Set(partner.assignedProducts.map((a) => a.productId));
  const availableProducts = productOptions
    .filter((p) => !assignedIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {partner.displayName}
            </h1>
            <Badge variant={STATUS_BADGE[partner.status] ?? "secondary"}>
              {partner.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {partner.code} · {partner.user.email} · inscrit le{" "}
            {partner.createdAt.toLocaleDateString("fr-FR")}
          </p>
        </div>
        <form action={changePartnerStatus} className="flex items-center gap-2">
          <input type="hidden" name="partnerId" value={partner.id} />
          <select
            name="status"
            defaultValue={partner.status}
            className="flex h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="ACTIVE">Actif</option>
            <option value="PENDING">En attente</option>
            <option value="SUSPENDED">Suspendu</option>
            <option value="REJECTED">Rejeté</option>
            <option value="CLOSED">Fermé</option>
          </select>
          <ConfirmSubmit
            variant="outline"
            confirmMessage="Changer le statut de ce partenaire ?"
          >
            Appliquer
          </ConfirmSubmit>
        </form>
      </div>
      {/* Registration */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Inscription</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">Téléphone</div>
            <div className="font-medium">{partner.phone ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Expérience e-commerce</div>
            <div className="font-medium">
              {partner.experienceLevel === "DEBUTANT"
                ? "Débutant"
                : partner.experienceLevel === "INTERMEDIAIRE"
                  ? "Intermédiaire"
                  : partner.experienceLevel === "EXPERT"
                    ? "Expert"
                    : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Invité par</div>
            <div className="font-medium">
              {partner.invitedBy
                ? `${partner.invitedBy.firstName} ${partner.invitedBy.lastName} (${partner.invitedBy.email})`
                : "—"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Produits assignés
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {partner.assignedProducts.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Commandes
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {partner._count.orders}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Solde disponible
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {partner.wallet ? `${formatPrice(partner.wallet.availableBalance)} DT` : "0 DT"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gains en attente
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {partner.wallet ? `${formatPrice(partner.wallet.pendingBalance)} DT` : "0 DT"}
          </CardContent>
        </Card>
      </div>

      {/* Finances (Phase 5) — ledger-derived, no estimates */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Finances</CardTitle>
          <Link
            href="/finance"
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            Ouvrir le module Finance
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Disponible</div>
              <div className="text-lg font-semibold">
                {formatPrice(finance.wallet?.availableBalance ?? 0)} DT
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">En attente</div>
              <div className="text-lg font-semibold">
                {formatPrice(finance.wallet?.pendingBalance ?? 0)} DT
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Total retiré</div>
              <div className="text-lg font-semibold">
                {formatPrice(finance.wallet?.totalWithdrawn ?? 0)} DT
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">
                Coûts retour/refus
              </div>
              <div className="text-lg font-semibold">
                {formatPrice(finance.returnCostTotal)} DT
              </div>
            </div>
          </div>

          {finance.activeRequestCount > 0 ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {finance.activeRequestCount} demande(s) de retrait en cours pour{" "}
              {formatPrice(finance.activeRequestTotal)} DT — à traiter dans le
              module Finance.
            </p>
          ) : null}

          <div className="space-y-2">
            <div className="text-sm font-medium">Derniers mouvements</div>
            {finance.transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun mouvement financier pour ce partenaire.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {finance.transactions.map((t) => {
                  const negative = Number(t.amount) < 0;
                  return (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-3 p-3 text-sm"
                    >
                      <div>
                        <div className="font-medium">
                          {LEDGER_TYPE_LABELS[t.type]}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t.createdAt.toLocaleString("fr-FR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                          {t.order ? ` · #${t.order.orderNumber}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            negative
                              ? "font-medium text-destructive"
                              : "font-medium text-emerald-700"
                          }
                        >
                          {negative ? "" : "+"}
                          {formatPrice(t.amount)} DT
                        </span>
                        <Badge variant={LEDGER_STATUS_VARIANTS[t.status]}>
                          {LEDGER_STATUS_LABELS[t.status]}
                        </Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {finance.withdrawals.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-medium">
                Dernières demandes de retrait
              </div>
              <ul className="divide-y rounded-lg border">
                {finance.withdrawals.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center justify-between gap-3 p-3 text-sm"
                  >
                    <span>
                      {formatPrice(w.amount)} DT ·{" "}
                      <span className="text-xs text-muted-foreground">
                        {w.requestedAt.toLocaleDateString("fr-FR")}
                        {w.status === "REJECTED" && w.rejectionReason
                          ? ` · ${w.rejectionReason}`
                          : ""}
                      </span>
                    </span>
                    <Badge variant={WITHDRAWAL_STATUS_VARIANTS[w.status]}>
                      {WITHDRAWAL_STATUS_LABELS[w.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Social accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comptes réseaux sociaux</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {partner.socialAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun compte ajouté.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {partner.socialAccounts.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 p-3">
                    <div>
                      <div className="text-sm font-medium">
                        {PLATFORM_LABELS[s.platform] ?? s.platform} — {s.label}
                      </div>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline-offset-2 hover:underline"
                      >
                        {s.url}
                      </a>
                    </div>
                    <form action={removePartnerSocial}>
                      <input type="hidden" name="id" value={s.id} />
                      <ConfirmSubmit
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        confirmMessage="Supprimer ce compte ?"
                      >
                        <Trash2 className="h-4 w-4" />
                      </ConfirmSubmit>
                    </form>
                  </li>
                ))}
              </ul>
            )}

            <form action={addPartnerSocial} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="partnerId" value={partner.id} />
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="soc-platform">Plateforme</label>
                <NativeSelect id="soc-platform" name="platform" defaultValue="FACEBOOK">
                  <option value="FACEBOOK">Facebook</option>
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="TIKTOK">TikTok</option>
                  <option value="OTHER">Autre</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="soc-label">Libellé</label>
                <input
                  id="soc-label"
                  name="label"
                  required
                  maxLength={80}
                  placeholder="Page principale"
                  className="flex h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium" htmlFor="soc-url">URL</label>
                <input
                  id="soc-url"
                  name="url"
                  type="url"
                  required
                  maxLength={500}
                  placeholder="https://facebook.com/…"
                  className="flex h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" variant="outline" size="sm">
                  Ajouter le compte
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Performance level */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Niveau de performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {partner.performanceLevel ? (
              <>
                <Badge variant="info">
                  {partner.performanceLevel.name}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Partage du profit :{" "}
                  <strong className="text-foreground">
                    {partner.performanceLevel.sharePercentage.toString()} %
                  </strong>
                </span>
              </>
            ) : (
              <Badge variant="secondary">Aucun niveau attribué</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Les conditions de progression sont configurables depuis Paramètres.
            Le niveau s&apos;applique uniquement aux nouvelles commandes : les
            gains déjà calculés restent inchangés.
          </p>
          {user.role === "SUPER_ADMIN" && levels.length > 0 && (
            <form action={changePartnerLevel} className="flex items-end gap-2">
              <input type="hidden" name="partnerId" value={partner.id} />
              <div className="space-y-1.5">
                <label className="text-xs font-medium" htmlFor="perf-level">
                  Attribuer un niveau
                </label>
                <NativeSelect
                  id="perf-level"
                  name="performanceLevelId"
                  defaultValue={partner.performanceLevelId ?? ""}
                  className="w-56"
                >
                  <option value="">— Aucun —</option>
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.sharePercentage.toString()} %)
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Button type="submit" variant="outline" size="sm">
                Appliquer
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Assigned products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Produits assignés</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AssignProductForm
              partnerId={partner.id}
              products={availableProducts}
              canEditCommission={user.role === "SUPER_ADMIN"}
            />

            {partner.assignedProducts.length === 0 ? (
              <EmptyState title="Aucun produit assigné" />
            ) : (
              <ul className="divide-y rounded-lg border">
                {partner.assignedProducts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 p-3">
                    <div>
                      <Link
                        href={`/produits/${a.productId}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {a.product.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {a.commissionType
                          ? `Commission perso : ${a.commissionType === "PERCENTAGE" ? `${a.commissionValue} %` : `${a.commissionValue} DT`}`
                          : "Règle par défaut"}
                        {" · "}
                        {formatPrice(a.product.sellingPrice)} DT
                      </div>
                    </div>
                    <form action={removeAssignment}>
                      <input type="hidden" name="partnerId" value={partner.id} />
                      <input type="hidden" name="productId" value={a.productId} />
                      <ConfirmSubmit
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        confirmMessage="Désassigner ce produit ?"
                      >
                        Désassigner
                      </ConfirmSubmit>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

