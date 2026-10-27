import type { Metadata } from "next";
import {
  Users,
  Link as LinkIcon,
  CheckCircle2,
  Clock,
  Wallet,
  Award,
  AlertTriangle,
  History,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getPartnerReferralLevel,
  getReferralThresholdSettings,
} from "@/modules/referrals/levels";
import { ApprovalQueueTable, type QueueCommissionItem } from "./approval-queue";
import { PaymentQueueTable, type PaymentQueueItem } from "./payment-queue";
import { PromotionQueueTable, type PromotionCandidate } from "./promotion-queue";
import { CalculationBreakdownModal } from "./breakdown-modal";

export const metadata: Metadata = {
  title: "Hub Parrainage & Commissions | Administration",
};

export default async function AdminReferralHubPage() {
  // 1. Strictly enforce SUPER_ADMIN or ADMIN role
  await requireSession(["SUPER_ADMIN", "ADMIN"]);

  // 2. Fetch overview metrics
  const [
    activeLinksCount,
    totalAttributionsCount,
    qualifiedReferralsCount,
    pendingApprovalCount,
    totalPaidCommissionsAgg,
  ] = await Promise.all([
    prisma.referralLink.count({ where: { isActive: true } }),
    prisma.referralAttribution.count(),
    prisma.referralAttribution.count({ where: { status: "QUALIFIED" } }),
    prisma.referralCommission.count({
      where: { status: { in: ["PENDING_VERIFICATION", "ELIGIBLE"] } },
    }),
    prisma.referralCommission.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
    }),
  ]);

  const totalPaidAmount = totalPaidCommissionsAgg._sum.amount ?? 0;

  // 3. Attributions list (recent 50)
  const attributions = await prisma.referralAttribution.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      referrerPartner: {
        select: {
          id: true,
          code: true,
          displayName: true,
          user: { select: { email: true } },
        },
      },
      referredPartner: {
        select: {
          id: true,
          code: true,
          displayName: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  // 4. Promotion Queue
  const { level2Threshold, level3Threshold } = await getReferralThresholdSettings(prisma);
  const qualifiedAttributions = await prisma.referralAttribution.findMany({
    where: { status: "QUALIFIED" },
    select: { referrerPartnerId: true },
  });

  const countByReferrer = new Map<string, number>();
  for (const attr of qualifiedAttributions) {
    countByReferrer.set(
      attr.referrerPartnerId,
      (countByReferrer.get(attr.referrerPartnerId) ?? 0) + 1,
    );
  }

  const promotionCandidates: PromotionCandidate[] = [];
  for (const [pId, count] of countByReferrer.entries()) {
    if (count >= level2Threshold) {
      const levelRes = await getPartnerReferralLevel(pId, prisma);
      if (levelRes.targetLevel > levelRes.level) {
        const partner = await prisma.partner.findUnique({
          where: { id: pId },
          include: { user: { select: { email: true } } },
        });
        if (partner) {
          promotionCandidates.push({
            partnerId: partner.id,
            displayName: partner.displayName,
            code: partner.code,
            email: partner.user.email,
            currentLevel: levelRes.level,
            targetLevel: levelRes.targetLevel,
            qualifiedCount: levelRes.qualifiedCount,
            threshold: levelRes.targetLevel === 3 ? level3Threshold : level2Threshold,
            currentRate:
              levelRes.level === 3 ? "15%" : levelRes.level === 2 ? "10%" : "5%",
            targetRate: levelRes.targetLevel === 3 ? "15%" : "10%",
          });
        }
      }
    }
  }

  // 5. Commission Approval Queue (PENDING_VERIFICATION or ELIGIBLE)
  const approvalCommissions = await prisma.referralCommission.findMany({
    where: { status: { in: ["PENDING_VERIFICATION", "ELIGIBLE"] } },
    orderBy: { createdAt: "desc" },
    include: {
      referrerPartner: {
        select: {
          id: true,
          code: true,
          displayName: true,
          user: { select: { email: true } },
        },
      },
      attribution: {
        include: {
          referredPartner: {
            select: {
              id: true,
              code: true,
              displayName: true,
              user: { select: { email: true } },
            },
          },
        },
      },
    },
  });

  const approvalQueueItems: QueueCommissionItem[] = approvalCommissions.map((c) => ({
    id: c.id,
    orderId: c.orderId,
    amount: c.amount.toString(),
    currency: c.currency,
    status: c.status,
    createdAt: c.createdAt,
    calculationDetails: c.calculationDetails,
    referrer: {
      id: c.referrerPartner.id,
      code: c.referrerPartner.code,
      displayName: c.referrerPartner.displayName,
      email: c.referrerPartner.user?.email,
    },
    referred: {
      id: c.attribution.referredPartner.id,
      code: c.attribution.referredPartner.code,
      displayName: c.attribution.referredPartner.displayName,
      email: c.attribution.referredPartner.user?.email,
    },
  }));

  // 6. Payment Queue (APPROVED_FOR_PAYMENT)
  const paymentCommissions = await prisma.referralCommission.findMany({
    where: { status: "APPROVED_FOR_PAYMENT" },
    orderBy: { approvedAt: "desc" },
    include: {
      referrerPartner: {
        select: {
          id: true,
          code: true,
          displayName: true,
          user: { select: { email: true } },
        },
      },
      attribution: {
        include: {
          referredPartner: {
            select: {
              id: true,
              code: true,
              displayName: true,
            },
          },
        },
      },
    },
  });

  const paymentQueueItems: PaymentQueueItem[] = paymentCommissions.map((c) => ({
    id: c.id,
    orderId: c.orderId,
    amount: c.amount.toString(),
    currency: c.currency,
    status: c.status,
    approvedAt: c.approvedAt,
    approvedById: c.approvedById,
    calculationDetails: c.calculationDetails,
    referrer: {
      id: c.referrerPartner.id,
      code: c.referrerPartner.code,
      displayName: c.referrerPartner.displayName,
      email: c.referrerPartner.user?.email,
    },
    referred: {
      id: c.attribution.referredPartner.id,
      code: c.attribution.referredPartner.code,
      displayName: c.attribution.referredPartner.displayName,
    },
  }));

  // 7. Historical Ledger / Payout Log (PAID, REJECTED, REVERSED)
  const historicalCommissions = await prisma.referralCommission.findMany({
    where: { status: { in: ["PAID", "REJECTED", "REVERSED"] } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      referrerPartner: {
        select: {
          id: true,
          code: true,
          displayName: true,
          user: { select: { email: true } },
        },
      },
      attribution: {
        include: {
          referredPartner: {
            select: {
              id: true,
              code: true,
              displayName: true,
              user: { select: { email: true } },
            },
          },
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Hub Parrainage & Commissions"
        description="Supervision du réseau de parrainage, approbation des commissions et exécution des paiements."
      />

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <LinkIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Liens actifs</p>
              <p className="text-xl font-bold text-foreground">{activeLinksCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-info-100 p-2 text-info-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total attributions</p>
              <p className="text-xl font-bold text-foreground">{totalAttributionsCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-success-100 p-2 text-success-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Filleuls qualifiés</p>
              <p className="text-xl font-bold text-foreground">{qualifiedReferralsCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-warning-100 p-2 text-warning-700">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">En attente d&apos;approbation</p>
              <p className="text-xl font-bold text-foreground">{pendingApprovalCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total commissions payées</p>
              <p className="text-xl font-bold text-foreground">
                {formatMoney(totalPaidAmount)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* 1. Commission Approval Queue */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning-600" />
              File d&apos;approbation des commissions ({approvalQueueItems.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Commissions calculées sur les commandes qualifiées et livrées. Vérifiez la décomposition $R, E, P, A, B, C$ avant validation.
            </p>
          </div>
        </div>
        <ApprovalQueueTable items={approvalQueueItems} />
      </section>

      {/* 2. Payment Queue */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              File d&apos;exécution des paiements ({paymentQueueItems.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Commissions approuvées prêtes pour versement. Saisissez la référence bancaire ou du reçu pour archiver le paiement.
            </p>
          </div>
        </div>
        <PaymentQueueTable items={paymentQueueItems} />
      </section>

      {/* 3. Partner Promotion Queue */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-600" />
              File de confirmation des promotions ({promotionCandidates.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Partenaires ayant atteint les seuils de qualification (Seuil Niv 2: {level2Threshold}, Seuil Niv 3: {level3Threshold}).
            </p>
          </div>
        </div>
        <PromotionQueueTable candidates={promotionCandidates} />
      </section>

      {/* 4. Attributions List */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Réseau d&apos;attributions ({attributions.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            Historique des rattachements de parrainage et statuts de qualification.
          </p>
        </div>

        {attributions.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            <p className="text-sm">Aucune attribution de parrainage enregistrée.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card shadow-soft">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Parrain</th>
                  <th className="p-3">Filleul</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3">Commande de qualification</th>
                  <th className="p-3">Date de qualification</th>
                  <th className="p-3">Création</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {attributions.map((a) => {
                  const isQualified = a.status === "QUALIFIED";
                  return (
                    <tr key={a.id} className="hover:bg-muted/50 transition-colors">
                      <td className="p-3 font-medium">
                        <span className="font-semibold text-foreground">
                          {a.referrerPartner.displayName}
                        </span>
                        <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                          ({a.referrerPartner.code})
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-foreground">
                          {a.referredPartner.displayName}
                        </span>
                        <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                          ({a.referredPartner.code})
                        </span>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={isQualified ? "success" : "secondary"}
                          className="text-[11px] font-normal"
                        >
                          {isQualified ? "Qualifié" : "En attente"}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono">
                        {a.qualifyingOrderId ? (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                            {a.qualifyingOrderId}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
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
                      <td className="p-3 text-muted-foreground">
                        {new Date(a.createdAt).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 5. Historical Ledger / Payout Log */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Journal historique des règlements & rejets ({historicalCommissions.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            Grand livre des commissions traitées (Payées, Rejetées, Inversées) avec piste d&apos;audit intégrale.
          </p>
        </div>

        {historicalCommissions.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            <p className="text-sm">Aucune opération clôturée dans le grand livre.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card shadow-soft">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Bénéficiaire</th>
                  <th className="p-3">Filleul</th>
                  <th className="p-3">Montant net</th>
                  <th className="p-3">Statut final</th>
                  <th className="p-3">Piste d&apos;audit & Référence</th>
                  <th className="p-3">Date mise à jour</th>
                  <th className="p-3">Détail du calcul</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {historicalCommissions.map((hc) => {
                  const isPaid = hc.status === "PAID";
                  const isRejected = hc.status === "REJECTED";
                  const isReversed = hc.status === "REVERSED";

                  return (
                    <tr key={hc.id} className="hover:bg-muted/50 transition-colors">
                      <td className="p-3 font-medium">
                        <span className="font-semibold text-foreground">
                          {hc.referrerPartner.displayName}
                        </span>
                        <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                          ({hc.referrerPartner.code})
                        </span>
                      </td>

                      <td className="p-3">
                        <span className="text-foreground">
                          {hc.attribution.referredPartner.displayName}
                        </span>
                      </td>

                      <td className="p-3 font-mono font-bold text-foreground">
                        {formatMoney(hc.amount, { currency: hc.currency })}
                      </td>

                      <td className="p-3">
                        <Badge
                          variant={
                            isPaid
                              ? "success"
                              : isRejected
                                ? "destructive"
                                : "warning"
                          }
                          className="text-[11px] font-normal"
                        >
                          {isPaid ? "Payé" : isRejected ? "Rejeté" : "Inversé"}
                        </Badge>
                      </td>

                      <td className="p-3">
                        {isPaid && (
                          <div className="space-y-0.5">
                            <span className="font-mono text-xs text-foreground">
                              {hc.paidAt
                                ? `Payé le ${new Date(hc.paidAt).toLocaleDateString("fr-FR")}`
                                : "Paiement validé"}
                            </span>
                            {hc.paidById && (
                              <p className="text-[10px] text-muted-foreground">
                                Par: {hc.paidById}
                              </p>
                            )}
                          </div>
                        )}
                        {isRejected && (
                          <div className="space-y-0.5 text-danger-700">
                            <span className="font-medium">Motif : </span>
                            <span className="italic">{hc.rejectionReason || "Non spécifié"}</span>
                          </div>
                        )}
                        {isReversed && (
                          <span className="text-muted-foreground italic">
                            Commission inversée
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-muted-foreground">
                        {new Date(hc.updatedAt).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      <td className="p-3">
                        <CalculationBreakdownModal
                          commissionId={hc.id}
                          orderId={hc.orderId}
                          amount={hc.amount.toString()}
                          currency={hc.currency}
                          calculationDetails={hc.calculationDetails}
                          referrerName={`${hc.referrerPartner.displayName} (${hc.referrerPartner.code})`}
                          referredName={`${hc.attribution.referredPartner.displayName} (${hc.attribution.referredPartner.code})`}
                          triggerSize="sm"
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
