import Link from "next/link";
import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { requireSession } from "@/lib/rbac";
import { formatPrice } from "@/lib/money";
import {
  listLedgerTransactions,
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
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = { title: "Portefeuille" };
export const dynamic = "force-dynamic";

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

  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.partnerPortal.wallet;
  const c = dict.common;
  const o = dict.orders;
  const currencySymbol = locale === "ar" ? "د.ت" : locale === "en" ? "TND" : "DT";
  const intlLocale = locale === "ar" ? "ar-TN" : locale === "en" ? "en-US" : "fr-FR";

  const dateTime = new Intl.DateTimeFormat(intlLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

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
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t.subtitle}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t.availableBalance}
          value={`${formatPrice(wallet.availableBalance)} ${currencySymbol}`}
          hint={`${locale === "ar" ? "قابل للسحب الآن:" : locale === "en" ? "Withdrawable now:" : "Retirable maintenant :"} ${formatPrice(summary.drawable)} ${currencySymbol}`}
        />
        <Stat
          label={t.pendingSettlement}
          value={`${formatPrice(wallet.pendingBalance)} ${currencySymbol}`}
          hint={locale === "ar" ? "متاح بعد فترة التسوية" : locale === "en" ? "Available after settlement period" : "Disponibles après la période de settlement"}
        />
        <Stat
          label={locale === "ar" ? "إجمالي الأرباح" : locale === "en" ? "Total earned" : "Total gagné"}
          value={`${formatPrice(wallet.totalEarned)} ${currencySymbol}`}
        />
        <Stat
          label={t.totalWithdrawn}
          value={`${formatPrice(wallet.totalWithdrawn)} ${currencySymbol}`}
          hint={
            summary.activeRequestCount > 0
              ? `${summary.activeRequestCount} ${locale === "ar" ? "طلبات جارية" : locale === "en" ? "active request(s)" : "demande(s) en cours"} (${formatPrice(summary.activeRequestsTotal)} ${currencySymbol})`
              : (locale === "ar" ? "لا توجد طلبات جارية" : locale === "en" ? "No active requests" : "Aucune demande en cours")
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
        <h2 className="text-lg font-semibold">{t.pendingSettlement}</h2>
        {pending.items.length === 0 ? (
          <EmptyState
            title={locale === "ar" ? "لا توجد أرباح معلقة" : locale === "en" ? "No pending earnings" : "Aucun gain en attente"}
            description={locale === "ar" ? "تظهر أرباحك هنا فور تسليم الطلبات مع موعد إتاحتها." : locale === "en" ? "Earnings appear here once orders are delivered, with due availability date." : "Vos gains apparaissent ici dès qu'une commande est livrée, avec leur date de disponibilité."}
          />
        ) : (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{o.orderNumber}</TableHead>
                  <TableHead>{c.total}</TableHead>
                  <TableHead>{locale === "ar" ? "متاح في" : locale === "en" ? "Available on" : "Disponible le"}</TableHead>
                  <TableHead>{c.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.items.map((tr) => (
                  <TableRow key={tr.id}>
                    <TableCell className="font-medium">
                      {tr.order ? (
                        <Link
                          href={`/mes-commandes/${tr.order.id}`}
                          className="hover:underline text-primary"
                        >
                          #{tr.order.orderNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{formatPrice(tr.amount)} {currencySymbol}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {tr.availableAt ? dateTime.format(tr.availableAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={LEDGER_STATUS_VARIANTS[tr.status]}>
                        {LEDGER_STATUS_LABELS[tr.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* ── Historique des retraits ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t.withdrawalHistory}</h2>
        {withdrawals.items.length === 0 ? (
          <EmptyState
            title={locale === "ar" ? "لا توجد سحوبات سابقة" : locale === "en" ? "No withdrawal history" : "Aucun retrait"}
            description={locale === "ar" ? "سيظهر سجل طلبات السحب هنا." : locale === "en" ? "Withdrawal history will appear here once requested." : "Historique de vos demandes de retrait."}
          />
        ) : (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{c.date}</TableHead>
                  <TableHead>{t.amountToWithdraw}</TableHead>
                  <TableHead>{t.payoutMethod}</TableHead>
                  <TableHead>{c.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.items.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="text-muted-foreground">
                      {dateTime.format(w.requestedAt)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatPrice(w.amount)} {currencySymbol}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {w.paymentMethod} · {w.paymentAccount}
                    </TableCell>
                    <TableCell>
                      <Badge variant={WITHDRAWAL_STATUS_VARIANTS[w.status]}>
                        {WITHDRAWAL_STATUS_LABELS[w.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* ── Journal des transactions ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{locale === "ar" ? "سجل المعاملات" : locale === "en" ? "Transaction Ledger" : "Journal des mouvements"}</h2>
        {ledger.items.length === 0 ? (
          <EmptyState
            title={locale === "ar" ? "لا توجد حركات مالية" : locale === "en" ? "No financial movements" : "Aucun mouvement"}
            description={locale === "ar" ? "تظهر تفاصيل أرباحك وتكاليفك هنا." : locale === "en" ? "Details of your earnings and costs appear here." : "Les détails de vos gains et coûts apparaissent ici."}
          />
        ) : (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{c.date}</TableHead>
                  <TableHead>{locale === "ar" ? "النوع" : locale === "en" ? "Type" : "Type"}</TableHead>
                  <TableHead>{o.orderNumber}</TableHead>
                  <TableHead>{c.total}</TableHead>
                  <TableHead>{c.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.items.map((tr) => {
                  const negative = Number(tr.amount) < 0;
                  return (
                    <TableRow key={tr.id}>
                      <TableCell className="text-muted-foreground">
                        {dateTime.format(tr.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {LEDGER_TYPE_LABELS[tr.type]}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tr.order ? `#${tr.order.orderNumber}` : "—"}
                      </TableCell>
                      <TableCell
                        className={
                          negative
                            ? "font-medium text-destructive"
                            : "font-medium text-emerald-700"
                        }
                      >
                        {negative ? "" : "+"}
                        {formatPrice(tr.amount)} {currencySymbol}
                      </TableCell>
                      <TableCell>
                        <Badge variant={LEDGER_STATUS_VARIANTS[tr.status]}>
                          {LEDGER_STATUS_LABELS[tr.status]}
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
