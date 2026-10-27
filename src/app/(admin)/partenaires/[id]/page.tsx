import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Archive,
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
import {
  addPartnerSocial,
  changePartnerStatus,
  removeAssignment,
  removePartnerSocial,
} from "../actions";
import { changePartnerLevel } from "../../parametres/performance-actions";
import { AssignProductForm } from "./assign-product-form";

export const metadata: Metadata = { title: "Partenaire" };

type PartnerStatus = "ACTIVE" | "PENDING" | "SUSPENDED" | "REJECTED" | "CLOSED";

const STATUS_BADGE: Record<
  PartnerStatus,
  "success" | "warning" | "destructive" | "secondary" | "info"
> = {
  ACTIVE: "success",
  PENDING: "warning",
  SUSPENDED: "info",
  REJECTED: "destructive",
  CLOSED: "secondary",
};

const STATUS_LABEL: Record<PartnerStatus, string> = {
  ACTIVE: "Actif",
  PENDING: "En attente d'approbation",
  SUSPENDED: "Suspendu",
  REJECTED: "Rejeté",
  CLOSED: "Fermé",
};

const STATUS_ICON: Record<PartnerStatus, React.ComponentType<{ className?: string }>> = {
  ACTIVE: CheckCircle2,
  PENDING: Clock,
  SUSPENDED: Ban,
  REJECTED: XCircle,
  CLOSED: Archive,
};

const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  OTHER: "Autre",
};

const EXPERIENCE_MAP: Record<string, string> = {
  DEBUTANT: "Débutant",
  INTERMEDIAIRE: "Intermédiaire",
  EXPERT: "Expert",
};

function PartnerStatusBadge({ status }: { status: string }) {
  const s = status as PartnerStatus;
  const Icon = STATUS_ICON[s];
  return (
    <Badge variant={STATUS_BADGE[s] ?? "secondary"} className="gap-1.5 text-sm px-3 py-1">
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {STATUS_LABEL[s] ?? status}
    </Badge>
  );
}

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

  const isPending = partner.status === "PENDING";

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/partenaires">
          <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
          Partenaires
        </Link>
      </Button>

      {/* Header */}
      <PageHeader
        title={partner.displayName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <PartnerStatusBadge status={partner.status} />
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="font-mono text-xs">{partner.code}</span>
              <span>·</span>
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              <a
                href={`mailto:${partner.user.email}`}
                className="hover:underline underline-offset-2"
              >
                {partner.user.email}
              </a>
              <span>·</span>
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                Inscrit le {partner.createdAt.toLocaleDateString("fr-FR")}
              </span>
            </span>
          </span>
        }
        action={
          <form action={changePartnerStatus} className="flex items-center gap-2">
            <input type="hidden" name="partnerId" value={partner.id} />
            <NativeSelect
              name="status"
              defaultValue={partner.status}
              aria-label="Changer le statut du partenaire"
              className="w-44"
            >
              <option value="ACTIVE">Actif</option>
              <option value="PENDING">En attente</option>
              <option value="SUSPENDED">Suspendu</option>
              <option value="REJECTED">Rejeté</option>
              <option value="CLOSED">Fermé</option>
            </NativeSelect>
            <ConfirmSubmit
              variant="outline"
              confirmMessage="Changer le statut de ce partenaire ?"
            >
              Appliquer
            </ConfirmSubmit>
          </form>
        }
      />

      {/* Pending approval banner */}
      {isPending && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Clock
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Demande d&apos;accès en attente
                </p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Ce partenaire attend votre approbation pour accéder à la plateforme.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2 sm:flex-col xl:flex-row">
              {/* Quick approve */}
              <form action={changePartnerStatus}>
                <input type="hidden" name="partnerId" value={partner.id} />
                <input type="hidden" name="status" value="ACTIVE" />
                <ConfirmSubmit
                  variant="default"
                  size="sm"
                  confirmMessage={`Approuver le compte de ${partner.displayName} ?`}
                  className="w-full"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Approuver
                </ConfirmSubmit>
              </form>
              {/* Quick reject */}
              <form action={changePartnerStatus}>
                <input type="hidden" name="partnerId" value={partner.id} />
                <input type="hidden" name="status" value="REJECTED" />
                <ConfirmSubmit
                  variant="destructive"
                  size="sm"
                  confirmMessage={`Rejeter la demande de ${partner.displayName} ? Cette action est irréversible.`}
                  className="w-full"
                >
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Rejeter
                </ConfirmSubmit>
              </form>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Registration info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Inscription</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              Téléphone
            </div>
            <div className="font-medium">
              {partner.phone ? (
                <a
                  href={`tel:${partner.phone}`}
                  className="hover:underline underline-offset-2"
                >
                  {partner.phone}
                </a>
              ) : (
                "—"
              )}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Expérience e-commerce
            </div>
            <div className="font-medium">
              {EXPERIENCE_MAP[partner.experienceLevel ?? ""] ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Invité par
            </div>
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
            {partner.wallet
              ? `${formatPrice(partner.wallet.availableBalance)} DT`
              : "0 DT"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gains en attente
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {partner.wallet
              ? `${formatPrice(partner.wallet.pendingBalance)} DT`
              : "0 DT"}
          </CardContent>
        </Card>
      </div>

      {/* Finances */}
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
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p>
                {finance.activeRequestCount} demande(s) de retrait en cours pour{" "}
                {formatPrice(finance.activeRequestTotal)} DT — à traiter dans le
                module Finance.
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="text-sm font-medium">Derniers mouvements</div>
            {finance.transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun mouvement financier pour ce partenaire.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border" role="list">
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
              <ul className="divide-y rounded-lg border" role="list">
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
              <p className="text-sm text-muted-foreground">
                Aucun compte ajouté.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border" role="list">
                {partner.socialAccounts.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 p-3"
                  >
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
                        className="text-destructive hover:text-destructive"
                        confirmMessage="Supprimer ce compte ?"
                        aria-label="Supprimer ce compte social"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </ConfirmSubmit>
                    </form>
                  </li>
                ))}
              </ul>
            )}

            <form action={addPartnerSocial} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="partnerId" value={partner.id} />
              <div className="space-y-1.5">
                <Label htmlFor="soc-platform">Plateforme</Label>
                <NativeSelect
                  id="soc-platform"
                  name="platform"
                  defaultValue="FACEBOOK"
                >
                  <option value="FACEBOOK">Facebook</option>
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="TIKTOK">TikTok</option>
                  <option value="OTHER">Autre</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="soc-label">Libellé</Label>
                <Input
                  id="soc-label"
                  name="label"
                  required
                  maxLength={80}
                  placeholder="Page principale"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="soc-url">URL</Label>
                <Input
                  id="soc-url"
                  name="url"
                  type="url"
                  required
                  maxLength={500}
                  placeholder="https://facebook.com/…"
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
                  <Badge variant="info">{partner.performanceLevel.name}</Badge>
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
              <form
                action={changePartnerLevel}
                className="flex items-end gap-2"
              >
                <input type="hidden" name="partnerId" value={partner.id} />
                <div className="space-y-1.5">
                  <Label htmlFor="perf-level" className="text-xs">
                    Attribuer un niveau
                  </Label>
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
        <Card className="lg:col-span-2">
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
              <ul className="divide-y rounded-lg border" role="list">
                {partner.assignedProducts.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 p-3"
                  >
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
                        className="text-destructive hover:text-destructive"
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
