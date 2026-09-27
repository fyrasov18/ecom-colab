import Link from "next/link";
import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { requireSession } from "@/lib/rbac";
import { formatPrice } from "@/lib/money";
import {
  listLedgerTransactions,
  settleDueEarnings,
} from "@/modules/finance/ledger";
import { listPendingEarnings, listWithdrawals } from "@/modules/finance/queries";
import { getWithdrawableSummary } from "@/modules/finance/withdrawals";
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
import { WithdrawForm } from "./withdraw-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Portefeuille" };
export const dynamic = "force-dynamic";

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
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

export default async function PortefeuillePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const user = await requireSession(["PARTNER"]);
  const partnerId = user.partnerId!;
  const page = Math.max(1, Number(sp.page) || 1);

  // Lazy settlement trigger: releases every pending gain whose frozen
  // settlement date has passed (idempotent, safe on every read).
  await settleDueEarnings();

  const [summary, pending, withdrawals, ledger] = await Promise.all([
    getWithdrawableSummary(partnerId),
    listPendingEarnings(partnerId),
    listWithdrawals({ partnerId, pageSize: 5 }),
    listLedgerTransactions({ partnerId, page }),
  ]);

  const wallet = summary.wallet;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Portefeuille</h1>
        <p className="text-sm text-muted-foreground">
          Solde, gains en attente et historique de vos mouvements financiers —{" "}
          {pending.nextSettlementAt
            ? `prochaine disponibilité le ${dateTime.format(pending.nextSettlementAt)}`
            : "aucun gain en attente"}
          .
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Solde disponible"
          value={`${formatPrice(wallet.availableBalance)} DT`}
          hint={`Retirable maintenant : ${formatPrice(summary.drawable)} DT`}
        />
        <Stat
          label="Gains en attente"
          value={`${formatPrice(wallet.pendingBalance)} DT`}
          hint="Disponibles après la période de settlement"
        />
        <Stat
          label="Total gagné"
          value={`${formatPrice(wallet.totalEarned)} DT`}
        />
        <Stat
          label="Total retiré"
          value={`${formatPrice(wallet.totalWithdrawn)} DT`}
          hint={
            summary.activeRequestCount > 0
              ? `${summary.activeRequestCount} demande(s) en cours (${formatPrice(summary.activeRequestsTotal)} DT)`
              : "Aucune demande en cours"
          }
        />
      </div>

      <WithdrawForm
        drawable={formatPrice(summary.drawable)}
        minAmount={formatPrice(summary.minAmount)}
        hasActiveRequest={summary.hasActiveRequest}
      />

      {/* ── Gains en attente ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Gains en attente</h2>
        {pending.items.length === 0 ? (
          <EmptyState
            title="Aucun gain en attente"
            description="Vos gains apparaissent ici dès qu'une commande est livrée, avec leur date de disponibilité."
          />
        ) : (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Commande</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Disponible le</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.items.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      {t.order ? (
                        <Link
                          href={`/mes-commandes/${t.order.id}`}
                          className="hover:underline"
                        >
                          #{t.order.orderNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{formatPrice(t.amount)} DT</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.availableAt ? dateTime.format(t.availableAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={LEDGER_STATUS_VARIANTS[t.status]}>
                        {LEDGER_STATUS_LABELS[t.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
      {/* ── Mes demandes de retrait ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Mes demandes de retrait</h2>
        {withdrawals.items.length === 0 ? (
          <EmptyState
            title="Aucune demande de retrait"
            description="Vos demandes et leur statut (demandé, en vérification, approuvé, payé, rejeté) s'afficheront ici."
          />
        ) : (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Demandée le</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Moyen</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Détail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.items.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="text-muted-foreground">
                      {dateTime.format(w.requestedAt)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatPrice(w.amount)} DT
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {w.paymentMethod}
                    </TableCell>
                    <TableCell>
                      <Badge variant={WITHDRAWAL_STATUS_VARIANTS[w.status]}>
                        {WITHDRAWAL_STATUS_LABELS[w.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {w.status === "PAID" && w.transactionReference
                        ? `Réf. ${w.transactionReference}`
                        : w.status === "REJECTED" && w.rejectionReason
                          ? w.rejectionReason
                          : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* ── Historique ledger (append-only) ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Historique des mouvements</h2>
        {ledger.items.length === 0 ? (
          <EmptyState
            title="Aucun mouvement"
            description="Chaque gain, coût de retour et retrait payé est enregistré ici, définitivement."
          />
        ) : (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
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

      <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
        <Wallet className="h-4 w-4 shrink-0 text-primary" />
        Vos gains sont mis en attente à la livraison puis deviennent disponibles
        après la période de settlement. Un retour ou un refus applique la règle
        de coût configurée par l&apos;opérateur.
      </div>


    </div>
  );
}

