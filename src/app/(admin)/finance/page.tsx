import Link from "next/link";
import type { Metadata } from "next";
import { requireSession } from "@/lib/rbac";
import { formatPrice } from "@/lib/money";
import {
  getFinanceOverview,
  listLedgerTransactions,
  settleDueEarnings,
} from "@/modules/finance/ledger";
import {
  getSettlementQueueStats,
  getWithdrawalsSummary,
  listWalletsWithPartner,
  listWithdrawals,
} from "@/modules/finance/queries";
import { ACTIVE_WITHDRAWAL_STATUSES } from "@/modules/finance/withdrawals";
import {
  LEDGER_STATUS_LABELS,
  LEDGER_STATUS_VARIANTS,
  LEDGER_TYPE_LABELS,
  WITHDRAWAL_STATUS_LABELS,
  WITHDRAWAL_STATUS_VARIANTS,
} from "@/modules/finance/labels";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SettleNowButton } from "./settle-button";
import { WithdrawalActions } from "./withdrawal-actions";

export const metadata: Metadata = { title: "Finance" };
export const dynamic = "force-dynamic";

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {hint ? (
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const page = Math.max(1, Number(sp.page) || 1);

  // Lazy settlement trigger before reading the aggregates, so the figures
  // shown are the true post-settlement state (the cron does the same thing).
  await settleDueEarnings();

  const [overview, summary, queue, wallets, activeRequests, ledger] =
    await Promise.all([
      getFinanceOverview(),
      getWithdrawalsSummary(),
      getSettlementQueueStats(),
      listWalletsWithPartner(10),
      listWithdrawals({ statuses: ACTIVE_WITHDRAWAL_STATUSES, pageSize: 10 }),
      listLedgerTransactions({ page, pageSize: 12 }),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Finance</h1>
          <p className="text-sm text-muted-foreground">
            Ledger immuable des gains partenaires, coûts de retour et retraits —
            chaque chiffre est calculé depuis les transactions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SettleNowButton dueNowCount={queue.dueNowCount} />
          <Link
            href="/parametres"
            className="inline-flex h-8 items-center rounded-md border border-input bg-card px-3 text-xs font-medium shadow-sm hover:bg-accent"
          >
            Règle de coût des retours
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <span>
          <strong>{queue.dueNowCount}</strong> gain(s) dû(s) maintenant (
          {formatPrice(queue.dueNowTotal)} DT) ·{" "}
          <strong>{queue.scheduledCount}</strong> programmé(s) (
          {formatPrice(queue.scheduledTotal)} DT) · prochain déblocage automatique
          via <code className="rounded bg-white/70 px-1">/api/cron/settle</code>.
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Solde disponible (partenaires)"
          value={`${formatPrice(overview.availableTotal)} DT`}
          hint={`${overview.availableEntries} écriture(s) disponible(s)`}
        />
        <Stat
          label="Gains en attente"
          value={`${formatPrice(overview.pendingTotal)} DT`}
          hint={`${overview.pendingEntries} écriture(s) en attente`}
        />
        <Stat
          label="Total gagné par les partenaires"
          value={`${formatPrice(overview.totalEarned)} DT`}
        />
        <Stat
          label="Retraits payés"
          value={`${formatPrice(overview.totalWithdrawn)} DT`}
          hint={`${summary.paidCount} retrait(s) payé(s)`}
        />
        <Stat
          label="Coûts de retour/refus refacturés"
          value={`${formatPrice(overview.totalReturnCosts)} DT`}
        />
        <Stat
          label="Demandes de retrait en cours"
          value={`${summary.activeCount}`}
          hint={`${formatPrice(summary.activeTotal)} DT — à traiter ci-dessous`}
        />
      </div>
      {/* ── Demandes de retrait à traiter ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Demandes de retrait à traiter
        </h2>
        {activeRequests.items.length === 0 ? (
          <EmptyState
            title="Aucune demande en attente"
            description="Les demandes des partenaires apparaissent ici dès leur envoi."
          />
        ) : (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partenaire</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Coordonnées</TableHead>
                  <TableHead>Demandée le</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeRequests.items.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>
                      <Link
                        href={`/partenaires/${w.partner.id}`}
                        className="font-medium hover:underline"
                      >
                        {w.partner.displayName}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {w.partner.code}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatPrice(w.amount)} DT
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {w.paymentMethod}
                      <div>{w.paymentAccount}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {dateTime.format(w.requestedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={WITHDRAWAL_STATUS_VARIANTS[w.status]}>
                        {WITHDRAWAL_STATUS_LABELS[w.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <WithdrawalActions
                        withdrawalId={w.id}
                        status={w.status}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* ── Soldes partenaires ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Soldes partenaires (top 10)</h2>
        {wallets.length === 0 ? (
          <EmptyState
            title="Aucun portefeuille actif"
            description="Les portefeuilles sont créés automatiquement au premier gain."
          />
        ) : (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partenaire</TableHead>
                  <TableHead>Disponible</TableHead>
                  <TableHead>En attente</TableHead>
                  <TableHead>Total gagné</TableHead>
                  <TableHead>Total retiré</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallets.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>
                      <Link
                        href={`/partenaires/${w.partner.id}`}
                        className="font-medium hover:underline"
                      >
                        {w.partner.displayName}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {w.partner.code}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatPrice(w.availableBalance)} DT
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatPrice(w.pendingBalance)} DT
                    </TableCell>
                    <TableCell>{formatPrice(w.totalEarned)} DT</TableCell>
                    <TableCell>{formatPrice(w.totalWithdrawn)} DT</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* ── Journal des mouvements ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Journal des mouvements</h2>
        {ledger.items.length === 0 ? (
          <EmptyState
            title="Ledger vide"
            description="Les gains, coûts et retraits apparaissent ici dès la première livraison."
          />
        ) : (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Partenaire</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Commande</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.items.map((t) => {
                  const negative = Number(t.amount) < 0;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="text-muted-foreground">
                        {dateTime.format(t.createdAt)}
                      </TableCell>
                      <TableCell>
                        {t.partner ? t.partner.displayName : "—"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {LEDGER_TYPE_LABELS[t.type]}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.order ? `#${t.order.orderNumber}` : "—"}
                      </TableCell>
                      <TableCell
                        className={
                          negative
                            ? "font-medium text-destructive"
                            : "font-medium text-emerald-700"
                        }
                      >
                        {negative ? "" : "+"}
                        {formatPrice(t.amount)} DT
                      </TableCell>
                      <TableCell>
                        <Badge variant={LEDGER_STATUS_VARIANTS[t.status]}>
                          {LEDGER_STATUS_LABELS[t.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <Pagination
          page={ledger.page}
          totalPages={ledger.totalPages}
          searchParams={sp}
        />
      </section>



    </div>
  );
}

