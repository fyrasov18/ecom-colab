import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Users,
  Award,
  Wallet,
  Clock,
  CheckCircle2,
  TrendingUp,
  Percent,
  History,
  ShieldCheck,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getPartnerReferralLevel,
  getReferralThresholdSettings,
} from "@/modules/referrals/levels";
import { getOrCreateReferralCode } from "@/modules/referrals/service";
import { ReferralLinkCard } from "./referral-link-card";
import { PartnerBreakdownModal } from "./partner-breakdown-modal";

export const metadata: Metadata = {
  title: "Mon Réseau de Parrainage | Espace Partenaire",
};

export default async function PartnerReferralDashboardPage() {
  // 1. Strictly enforce PARTNER role
  const sessionUser = await requireSession(["PARTNER"]);

  // 2. Strict IDOR protection: only resolve data for the authenticated partner's session ID
  if (!sessionUser.partnerId) {
    redirect("/tableau-de-bord");
  }

  const partnerId = sessionUser.partnerId;

  // 3. Fetch link, levels, threshold config, summaries, attributions and commissions
  const [
    linkData,
    levelData,
    thresholdSettings,
    pendingCommissionsAgg,
    approvedCommissionsAgg,
    paidCommissionsAgg,
    attributions,
    commissions,
  ] = await Promise.all([
    getOrCreateReferralCode(partnerId),
    getPartnerReferralLevel(partnerId),
    getReferralThresholdSettings(prisma),
    prisma.referralCommission.aggregate({
      where: {
        referrerPartnerId: partnerId,
        status: { in: ["PENDING_VERIFICATION", "ELIGIBLE"] },
      },
      _sum: { amount: true },
    }),
    prisma.referralCommission.aggregate({
      where: {
        referrerPartnerId: partnerId,
        status: "APPROVED_FOR_PAYMENT",
      },
      _sum: { amount: true },
    }),
    prisma.referralCommission.aggregate({
      where: {
        referrerPartnerId: partnerId,
        status: "PAID",
      },
      _sum: { amount: true },
    }),
    prisma.referralAttribution.findMany({
      where: { referrerPartnerId: partnerId },
      include: {
        referredPartner: {
          select: {
            id: true,
            displayName: true,
            code: true,
            createdAt: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.referralCommission.findMany({
      where: { referrerPartnerId: partnerId },
      include: {
        attribution: {
          include: {
            referredPartner: {
              select: {
                displayName: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const pendingAmount = pendingCommissionsAgg._sum.amount ?? 0;
  const approvedAmount = approvedCommissionsAgg._sum.amount ?? 0;
  const paidAmount = paidCommissionsAgg._sum.amount ?? 0;

  // Calculate progress towards next level
  const currentLevel = levelData.level;
  const qualifiedCount = levelData.qualifiedCount;
  const ratePercentage = `${(levelData.rate.toNumber() * 100).toFixed(0)}%`;

  let nextTargetThreshold = thresholdSettings.level2Threshold;
  let nextLevelName = "Niveau 2 (10%)";
  let progressPercent = 0;

  if (currentLevel === 1) {
    nextTargetThreshold = thresholdSettings.level2Threshold;
    nextLevelName = "Niveau 2 (10%)";
    progressPercent = Math.min(
      100,
      Math.round((qualifiedCount / thresholdSettings.level2Threshold) * 100),
    );
  } else if (currentLevel === 2) {
    nextTargetThreshold = thresholdSettings.level3Threshold;
    nextLevelName = "Niveau 3 (15%)";
    progressPercent = Math.min(
      100,
      Math.round((qualifiedCount / thresholdSettings.level3Threshold) * 100),
    );
  } else {
    progressPercent = 100;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Parrainage & Réseau"
        description="Gagnez jusqu'à 15% de commission sur les commandes qualifiées de vos filleuls."
      />

      {/* Top Section: Link Card & Referral Level Card */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Referral Link & Code Card */}
        <ReferralLinkCard code={linkData.code} url={linkData.url} />

        {/* Referral Level & Progress Card */}
        <Card className="shadow-soft flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                <Award className="h-5 w-5 text-amber-500" />
                Votre Niveau de Parrainage
              </CardTitle>
              <Badge variant="success" className="text-xs px-2.5 py-1 font-mono font-bold">
                Niveau {currentLevel} • {ratePercentage}
              </Badge>
            </div>
            <CardDescription>
              Taux appliqué sur le pool de bénéfice restant ($B = 30\% \times P$) de chaque commande qualifiée.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Rates tier ladder */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div
                className={`rounded-lg p-2.5 border transition-all ${
                  currentLevel === 1
                    ? "border-primary bg-primary/10 font-bold text-primary shadow-xs"
                    : "bg-muted/40 text-muted-foreground"
                }`}
              >
                <div className="text-[11px] uppercase tracking-wider">Niveau 1</div>
                <div className="text-base font-extrabold mt-0.5">5%</div>
                <div className="text-[10px] text-muted-foreground">Départ</div>
              </div>

              <div
                className={`rounded-lg p-2.5 border transition-all ${
                  currentLevel === 2
                    ? "border-primary bg-primary/10 font-bold text-primary shadow-xs"
                    : "bg-muted/40 text-muted-foreground"
                }`}
              >
                <div className="text-[11px] uppercase tracking-wider">Niveau 2</div>
                <div className="text-base font-extrabold mt-0.5">10%</div>
                <div className="text-[10px] text-muted-foreground">
                  ≥ {thresholdSettings.level2Threshold} qualifiés
                </div>
              </div>

              <div
                className={`rounded-lg p-2.5 border transition-all ${
                  currentLevel === 3
                    ? "border-primary bg-primary/10 font-bold text-primary shadow-xs"
                    : "bg-muted/40 text-muted-foreground"
                }`}
              >
                <div className="text-[11px] uppercase tracking-wider">Niveau 3</div>
                <div className="text-base font-extrabold mt-0.5">15%</div>
                <div className="text-[10px] text-muted-foreground">
                  ≥ {thresholdSettings.level3Threshold} qualifiés
                </div>
              </div>
            </div>

            {/* Progression toward next level */}
            {currentLevel < 3 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-muted-foreground">
                    Progression vers le <strong className="text-foreground">{nextLevelName}</strong> :
                  </span>
                  <span className="font-mono font-bold text-foreground">
                    {qualifiedCount} / {nextTargetThreshold} qualifiés ({progressPercent}%)
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-500 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Il vous reste {Math.max(0, nextTargetThreshold - qualifiedCount)} filleul(s) qualifié(s) pour débloquer le palier supérieur.
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  Félicitations ! Vous avez atteint le Niveau 3 maximal ({ratePercentage} de commission).
                </span>
              </div>
            )}

            <div className="text-[11px] text-muted-foreground border-t pt-3 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span>Garantie : Vos niveaux acquis sont permanents et ne sont jamais rétrogradés.</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commission Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-warning-100 p-2.5 text-warning-700">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Commissions en attente / éligibles</p>
              <p className="text-xl font-bold text-foreground">
                {formatMoney(pendingAmount)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-info-100 p-2.5 text-info-700">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Approuvées pour paiement</p>
              <p className="text-xl font-bold text-foreground">
                {formatMoney(approvedAmount)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-success-100 p-2.5 text-success-700">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total commissions perçues (Payées)</p>
              <p className="text-xl font-bold text-success-700">
                {formatMoney(paidAmount)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Referred Partners Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Mes Partenaires Filleuls ({attributions.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Liste de vos filleuls directs. Un filleul devient qualifié dès qu&apos;il livre sa 1ère commande réglée.
            </p>
          </div>
        </div>

        {attributions.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            <Users className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium">Vous n&apos;avez pas encore de filleul inscrit</p>
            <p className="text-xs text-muted-foreground mt-1">
              Partagez votre lien de parrainage ci-dessus pour bâtir votre réseau et augmenter vos revenus.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card shadow-soft">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Partenaire filleul</th>
                  <th className="p-3">Date d&apos;inscription</th>
                  <th className="p-3">Statut de qualification</th>
                  <th className="p-3">Commande de qualification</th>
                  <th className="p-3">Date de qualification</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {attributions.map((a) => {
                  const isQualified = a.status === "QUALIFIED";
                  return (
                    <tr key={a.id} className="hover:bg-muted/50 transition-colors">
                      <td className="p-3 font-medium">
                        <span className="font-semibold text-foreground">
                          {a.referredPartner.displayName}
                        </span>
                        <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                          ({a.referredPartner.code})
                        </span>
                      </td>

                      <td className="p-3 text-muted-foreground">
                        {new Date(a.createdAt).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      <td className="p-3">
                        <Badge
                          variant={isQualified ? "success" : "warning"}
                          className="text-[11px] gap-1 font-normal"
                        >
                          {isQualified ? (
                            <>
                              <CheckCircle2 className="h-3 w-3" />
                              Qualifié
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3" />
                              En attente de 1ère commande
                            </>
                          )}
                        </Badge>
                      </td>

                      <td className="p-3 font-mono">
                        {a.qualifyingOrderId ? (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                            {a.qualifyingOrderId}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">
                            Aucune commande réglée
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-muted-foreground">
                        {a.qualifiedAt
                          ? new Date(a.qualifiedAt).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Commission History Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Historique de vos Commissions ({commissions.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Traçabilité financière intégrale et transparence du calcul de vos gains parrainage ($R, E, P, A, B, C$).
            </p>
          </div>
        </div>

        {commissions.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            <Wallet className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium">Aucune commission générée pour le moment</p>
            <p className="text-xs text-muted-foreground mt-1">
              Les commissions apparaîtront dès que vos filleuls auront des commandes livrées et réglées.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card shadow-soft">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Filleul générateur</th>
                  <th className="p-3">Commande source</th>
                  <th className="p-3">Montant net</th>
                  <th className="p-3">Statut de la commission</th>
                  <th className="p-3">Transparence du calcul</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {commissions.map((c) => {
                  const isPaid = c.status === "PAID";
                  const isApproved = c.status === "APPROVED_FOR_PAYMENT";
                  const isEligible = c.status === "ELIGIBLE";
                  const isPending = c.status === "PENDING_VERIFICATION";
                  const isRejected = c.status === "REJECTED";
                  const isReversed = c.status === "REVERSED";

                  const badgeVariant = isPaid
                    ? "success"
                    : isApproved
                      ? "info"
                      : isEligible
                        ? "info"
                        : isPending
                          ? "warning"
                          : isRejected
                            ? "destructive"
                            : "secondary";

                  const statusLabel = isPaid
                    ? "Payée"
                    : isApproved
                      ? "Approuvée pour paiement"
                      : isEligible
                        ? "Éligible"
                        : isPending
                          ? "En vérification"
                          : isRejected
                            ? "Rejetée"
                            : "Inversée";

                  return (
                    <tr key={c.id} className="hover:bg-muted/50 transition-colors">
                      <td className="p-3 text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      <td className="p-3 font-medium">
                        <span className="font-semibold text-foreground">
                          {c.attribution.referredPartner.displayName}
                        </span>
                        <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                          ({c.attribution.referredPartner.code})
                        </span>
                      </td>

                      <td className="p-3 font-mono">
                        {c.orderId ? (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                            {c.orderId}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="p-3 font-mono font-bold text-foreground text-sm">
                        {formatMoney(c.amount, { currency: c.currency })}
                      </td>

                      <td className="p-3">
                        <Badge variant={badgeVariant} className="text-[11px] font-normal">
                          {statusLabel}
                        </Badge>
                      </td>

                      <td className="p-3">
                        <PartnerBreakdownModal
                          commissionId={c.id}
                          orderId={c.orderId}
                          amount={c.amount.toString()}
                          currency={c.currency}
                          calculationDetails={c.calculationDetails}
                          referredName={`${c.attribution.referredPartner.displayName} (${c.attribution.referredPartner.code})`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
