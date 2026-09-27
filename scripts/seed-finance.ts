import { PrismaClient, type Role } from "@prisma/client";
import {
  createPartnerEarning,
  settleDueEarnings,
} from "../src/modules/finance/ledger";
import {
  approveWithdrawal,
  payWithdrawal,
  requestWithdrawal,
} from "../src/modules/finance/withdrawals";

const prisma = new PrismaClient();

/**
 * Phase 5 demo data — built ONLY through the real services so the ledger,
 * wallets, withdrawals and audit trail stay perfectly consistent.
 *
 *   1. every DELIVERED order gets its PENDING partner earning (idempotent);
 *   2. ~60 % of the pending entries are backdated, then settled for real;
 *   3. a few withdrawals go through the real lifecycle (paid / approved / requested).
 *
 * Safe to re-run: every step is idempotent or skipped when data exists.
 */
async function main() {
  // ── 1. Earnings for delivered orders ──
  const delivered = await prisma.order.findMany({
    where: { status: "DELIVERED", earningStatus: "NONE" },
    select: {
      id: true,
      partnerId: true,
      partnerEarning: true,
      settlementDueAt: true,
    },
  });
  let earnings = 0;
  for (const order of delivered) {
    const entry = await createPartnerEarning(prisma, order);
    if (entry) earnings++;
  }
  console.log(
    earnings > 0
      ? `✅ ${earnings} gain(s) partenaire créé(s) (statut en attente).`
      : "ℹ️  Aucun gain à créer — tout est déjà enregistré.",
  );

  // ── 2. Settlement (simulate elapsed time on part of the entries) ──
  const pending = await prisma.financialTransaction.findMany({
    where: { status: "PENDING", availableAt: { gt: new Date() } },
    orderBy: { availableAt: "asc" },
    select: { id: true },
  });
  const backdateCount = Math.floor(pending.length * 0.6);
  if (backdateCount > 0) {
    const past = new Date(Date.now() - 3_600_000);
    await prisma.financialTransaction.updateMany({
      where: { id: { in: pending.slice(0, backdateCount).map((p) => p.id) } },
      data: { availableAt: past },
    });
  }
  const settled = await settleDueEarnings();
  console.log(
    settled.settled > 0
      ? `✅ Settlement : ${settled.settled} gain(s) débloqué(s) pour ${settled.partners.length} partenaire(s).`
      : "ℹ️  Rien à débloquer (les gains restent en attente).",
  );

  // ── 3. Withdrawals through the real lifecycle ──
  const admin = await prisma.user.findFirstOrThrow({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  const wallets = await prisma.wallet.findMany({
    where: { availableBalance: { gte: 300 } },
    orderBy: { availableBalance: "desc" },
    take: 6,
    include: { partner: { select: { id: true, userId: true, code: true } } },
  });

  let paid = 0;
  let approved = 0;
  let requested = 0;

  for (const [index, wallet] of wallets.entries()) {
    const existing = await prisma.withdrawal.count({
      where: { partnerId: wallet.partnerId },
    });
    if (existing > 0) continue;

    const amount =
      Math.floor((Number(wallet.availableBalance) / 3) * 1000) / 1000;
    if (amount < 100) continue;

    const withdrawal = await requestWithdrawal({
      partnerId: wallet.partnerId,
      amount,
      paymentMethod: "BANK_TRANSFER",
      paymentAccount: `TN59 1000 6035 ${1000 + index} 4821`,
      actorId: wallet.partner.userId,
    });

    if (index % 3 === 0) {
      await approveWithdrawal({
        withdrawalId: withdrawal.id,
        actorId: admin.id,
        role: "ADMIN" as Role,
      });
      await payWithdrawal({
        withdrawalId: withdrawal.id,
        actorId: admin.id,
        role: "ADMIN" as Role,
        transactionReference: `TRX-${Date.now()}-${index}`,
      });
      paid++;
    } else if (index % 3 === 1) {
      await approveWithdrawal({
        withdrawalId: withdrawal.id,
        actorId: admin.id,
        role: "ADMIN" as Role,
      });
      approved++;
    } else {
      requested++;
    }
  }

  console.log(
    `✅ Retraits : ${paid} payé(s), ${approved} approuvé(s) en attente de paiement, ${requested} demandé(s).`,
  );

  // ── Summary ──
  const [walletsCount, entries, availableAgg] = await Promise.all([
    prisma.wallet.count(),
    prisma.financialTransaction.count(),
    prisma.wallet.aggregate({
      _sum: { availableBalance: true, pendingBalance: true },
    }),
  ]);
  console.log(
    `📊 ${walletsCount} portefeuille(s), ${entries} écriture(s) de ledger · disponible ${Number(availableAgg._sum.availableBalance ?? 0).toFixed(3)} DT · en attente ${Number(availableAgg._sum.pendingBalance ?? 0).toFixed(3)} DT`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
