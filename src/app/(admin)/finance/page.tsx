import Link from "next/link";
import type { Metadata } from "next";
import { requireSession } from "@/lib/rbac";
import { formatPrice } from "@/lib/money";
import {
  getFinanceOverview,
  listLedgerTransactions,
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
import {
  SettleNowButton,
  SettleSingleTransactionButton,
} from "./settle-button";
import { WithdrawalActions } from "./withdrawal-actions";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = { title: "Finance" };
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

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const page = Math.max(1, Number(sp.page) || 1);

  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.finance;
  const o = dict.orders;
  const c = dict.common;
  const currencySymbol = locale === "ar" ? "د.ت" : locale === "en" ? "TND" : "DT";
  const intlLocale = locale === "ar" ? "ar-TN" : locale === "en" ? "en-US" : "fr-FR";

  const dateTime = new Intl.DateTimeFormat(intlLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

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
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SettleNowButton
            dueNowCount={queue.dueNowCount}
            scheduledCount={queue.scheduledCount}
          />
          <Link
            href="/parametres"
            className="inline-flex h-8 items-center rounded-md border border-input bg-card px-3 text-xs font-medium shadow-sm hover:bg-accent"
          >
            {locale === "ar" ? "قاعدة تكلفة الإرجاع" : locale === "en" ? "Return cost rule" : "Règle de coût des retours"}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-900">
        <div>
          <strong>{queue.dueNowCount}</strong> {locale === "ar" ? "أرباح مستحقة الآن" : locale === "en" ? "earning(s) due now" : "gain(s) dû(s) maintenant"} (
          {formatPrice(queue.dueNowTotal)} {currencySymbol}) ·{" "}
          <strong>{queue.scheduledCount}</strong> {locale === "ar" ? "مجدولة" : locale === "en" ? "scheduled" : "programmé(s)"} (
          {formatPrice(queue.scheduledTotal)} {currencySymbol}).
          <div className="text-xs text-blue-700 mt-0.5">
            {locale === "ar"
              ? "معالجة يدوية: استخدم الأزرار أعلاه أو زر «تحرير» على كل سطر في السجل."
              : locale === "en"
              ? "Manual settlement: use buttons above or the 'Release' button on ledger rows."
              : "Gestion manuelle : utilisez les boutons ci-dessus ou le bouton « Débloquer » sur chaque ligne du journal."}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label={locale === "ar" ? "الرصيد المتاح (الشركاء)" : locale === "en" ? "Available balance (partners)" : "Solde disponible (partenaires)"}
          value={`${formatPrice(overview.availableTotal)} ${currencySymbol}`}
          hint={`${overview.availableEntries} ${locale === "ar" ? "قيود متاحة" : locale === "en" ? "available entries" : "écriture(s) disponible(s)"}`}
        />
        <Stat
          label={t.pendingSettlements}
          value={`${formatPrice(overview.pendingTotal)} ${currencySymbol}`}
          hint={`${overview.pendingEntries} ${locale === "ar" ? "قيود معلقة" : locale === "en" ? "pending entries" : "écriture(s) en attente"}`}
        />
        <Stat
          label={locale === "ar" ? "إجمالي أرباح الشركاء" : locale === "en" ? "Total earned by partners" : "Total gagné par les partenaires"}
          value={`${formatPrice(overview.totalEarned)} ${currencySymbol}`}
        />
        <Stat
          label={locale === "ar" ? "السحوبات المدفوعة" : locale === "en" ? "Paid withdrawals" : "Retraits payés"}
          value={`${formatPrice(overview.totalWithdrawn)} ${currencySymbol}`}
          hint={`${summary.paidCount} ${locale === "ar" ? "سحوبات مدفوعة" : locale === "en" ? "paid withdrawal(s)" : "retrait(s) payé(s)"}`}
        />
        <Stat
          label={locale === "ar" ? "تكاليف الإرجاع/الرفض المعاد فوترتها" : locale === "en" ? "Re-invoiced return costs" : "Coûts de retour/refus refacturés"}
          value={`${formatPrice(overview.totalReturnCosts)} ${currencySymbol}`}
        />
        <Stat
          label={t.withdrawalsTitle}
          value={`${summary.activeCount}`}
          hint={`${formatPrice(summary.activeTotal)} ${currencySymbol} — ${locale === "ar" ? "للمعالجة أدناه" : locale === "en" ? "to process below" : "à traiter ci-dessous"}`}
        />
      </div>

      {/* ── Demandes de retrait à traiter ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          {t.withdrawalQueue}
        </h2>
        {activeRequests.items.length === 0 ? (
          <EmptyState
            title={t.noWithdrawals}
            description={locale === "ar" ? "تظهر طلبات الشركاء هنا بمجرد إرسالها." : locale === "en" ? "Partner requests appear here as soon as submitted." : "Les demandes des partenaires apparaissent ici dès leur envoi."}
          />
        ) : (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{o.partner}</TableHead>
                  <TableHead>{t.payoutAmount}</TableHead>
                  <TableHead>{t.ribD17}</TableHead>
                  <TableHead>{locale === "ar" ? "تاريخ الطلب" : locale === "en" ? "Requested at" : "Demandée le"}</TableHead>
                  <TableHead>{c.status}</TableHead>
                  <TableHead>{c.actions}</TableHead>
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
                      {formatPrice(w.amount)} {currencySymbol}
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
        <h2 className="text-lg font-semibold">{locale === "ar" ? "أرصدة الشركاء (أفضل 10)" : locale === "en" ? "Partner balances (top 10)" : "Soldes partenaires (top 10)"}</h2>
        {wallets.length === 0 ? (
          <EmptyState
            title={locale === "ar" ? "لا توجد محافظ نشطة" : locale === "en" ? "No active wallet" : "Aucun portefeuille actif"}
            description={locale === "ar" ? "يتم إنشاء المحافظ تلقائياً عند أول ربح." : locale === "en" ? "Wallets are created automatically on first earning." : "Les portefeuilles sont créés automatiquement au premier gain."}
          />
        ) : (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{o.partner}</TableHead>
                  <TableHead>{locale === "ar" ? "المتاح" : locale === "en" ? "Available" : "Disponible"}</TableHead>
                  <TableHead>{locale === "ar" ? "قيد الانتظار" : locale === "en" ? "Pending" : "En attente"}</TableHead>
                  <TableHead>{locale === "ar" ? "إجمالي الأرباح" : locale === "en" ? "Total earned" : "Total gagné"}</TableHead>
                  <TableHead>{locale === "ar" ? "إجمالي المسحوب" : locale === "en" ? "Total withdrawn" : "Total retiré"}</TableHead>
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
                      {formatPrice(w.availableBalance)} {currencySymbol}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatPrice(w.pendingBalance)} {currencySymbol}
                    </TableCell>
                    <TableCell>{formatPrice(w.totalEarned)} {currencySymbol}</TableCell>
                    <TableCell>{formatPrice(w.totalWithdrawn)} {currencySymbol}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* ── Journal des mouvements ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t.settlementHistory}</h2>
        {ledger.items.length === 0 ? (
          <EmptyState
            title={locale === "ar" ? "السجل المالي فارغ" : locale === "en" ? "Ledger is empty" : "Ledger vide"}
            description={locale === "ar" ? "تظهر الأرباح والتكاليف والسحوبات هنا عند أول توصيل." : locale === "en" ? "Earnings, costs and withdrawals appear here upon first delivery." : "Les gains, coûts et retraits apparaissent ici dès la première livraison."}
          />
        ) : (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{c.date}</TableHead>
                  <TableHead>{o.partner}</TableHead>
                  <TableHead>{locale === "ar" ? "النوع" : locale === "en" ? "Type" : "Type"}</TableHead>
                  <TableHead>{o.orderNumber}</TableHead>
                  <TableHead>{c.total}</TableHead>
                  <TableHead>{c.status}</TableHead>
                  <TableHead className="text-right">{c.actions}</TableHead>
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
                      <TableCell>
                        {tr.partner ? tr.partner.displayName : "—"}
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
                      <TableCell className="text-right">
                        {tr.status === "PENDING" ? (
                          <SettleSingleTransactionButton transactionId={tr.id} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
