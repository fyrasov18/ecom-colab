import { describe, expect, it, beforeEach } from "vitest";
import Decimal from "decimal.js";
import { Prisma } from "@prisma/client";
import {
  createExpense,
  approveExpense,
  rejectExpense,
  getAttributableExpenses,
  sumApprovedExpenses,
  updateExpense,
  deleteExpense,
  ExpenseError,
} from "@/modules/finance/expenses";
import {
  createReferralCommission,
  approveReferralCommission,
  payReferralCommission,
  rejectReferralCommission,
  reverseReferralCommission,
  ReferralCommissionError,
  type DbClient,
} from "@/modules/finance/referral-commissions";
import { calculateProfitSharing } from "@/modules/finance/referral-math";
import { createWithdrawalPayment } from "@/modules/finance/ledger";

/**
 * In-memory Mock Database Client for Empirical Financial Math & Reversals Verification.
 * Emulates Prisma models, transactions, unique constraints, atomic operations, and ledger.
 */
function createFinancialMockDb() {
  const expenses = new Map<string, any>();
  const attributions = new Map<string, any>();
  const commissions = new Map<string, any>();
  const financialTransactions = new Map<string, any>();
  const wallets = new Map<string, any>();
  const orders = new Map<string, any>();
  const auditLogs: any[] = [];

  let idCounter = 1;
  const nextId = (p: string) => `${p}-${idCounter++}`;

  const client = {
    expense: {
      create: async ({ data }: { data: any }) => {
        const id = nextId("exp");
        const record = {
          id,
          title: data.title,
          category: data.category,
          amount: new Prisma.Decimal(data.amount.toString()),
          currency: data.currency ?? "TND",
          status: data.status ?? "PENDING",
          period: data.period ?? null,
          notes: data.notes ?? null,
          approvedAt: data.approvedAt ?? null,
          approvedById: data.approvedById ?? null,
          createdById: data.createdById ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        expenses.set(id, record);
        return { ...record };
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = expenses.get(where.id);
        return row ? { ...row } : null;
      },
      findMany: async (args?: { where?: any; orderBy?: any }) => {
        let list = Array.from(expenses.values());
        if (args?.where) {
          const w = args.where;
          if (w.status) list = list.filter((r) => r.status === w.status);
          if (w.period) list = list.filter((r) => r.period === w.period);
          if (w.id?.in) {
            const allowed = new Set(w.id.in);
            list = list.filter((r) => allowed.has(r.id));
          }
        }
        return list.map((r) => ({ ...r }));
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const existing = expenses.get(where.id);
        if (!existing) throw new Error("Expense not found");
        const updated = { ...existing, ...data, updatedAt: new Date() };
        expenses.set(where.id, updated);
        return { ...updated };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        expenses.delete(where.id);
        return { id: where.id };
      },
    },

    referralAttribution: {
      findUnique: async ({ where }: { where: { id?: string } }) => {
        if (where.id) {
          const row = attributions.get(where.id);
          return row ? { ...row } : null;
        }
        return null;
      },
    },

    referralCommission: {
      create: async ({ data }: { data: any }) => {
        for (const c of commissions.values()) {
          if (c.idempotencyKey === data.idempotencyKey) {
            throw new Prisma.PrismaClientKnownRequestError(
              "Unique constraint failed on idempotencyKey",
              { code: "P2002", clientVersion: "6.0.0" },
            );
          }
        }
        const id = nextId("comm");
        const record = {
          id,
          attributionId: data.attributionId,
          referrerPartnerId: data.referrerPartnerId,
          orderId: data.orderId ?? null,
          amount: new Prisma.Decimal(data.amount.toString()),
          currency: data.currency ?? "TND",
          status: data.status ?? "PENDING_VERIFICATION",
          idempotencyKey: data.idempotencyKey,
          calculationDetails: data.calculationDetails ?? null,
          approvedAt: data.approvedAt ?? null,
          approvedById: data.approvedById ?? null,
          paidAt: data.paidAt ?? null,
          paidById: data.paidById ?? null,
          rejectionReason: data.rejectionReason ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        commissions.set(id, record);
        return { ...record };
      },
      findUnique: async ({ where }: { where: { id?: string; idempotencyKey?: string } }) => {
        if (where.id) {
          const row = commissions.get(where.id);
          return row ? { ...row } : null;
        }
        if (where.idempotencyKey) {
          for (const row of commissions.values()) {
            if (row.idempotencyKey === where.idempotencyKey) return { ...row };
          }
        }
        return null;
      },
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const row = commissions.get(where.id);
        if (!row) throw new Error(`Commission not found: ${where.id}`);
        return { ...row };
      },
      updateMany: async ({ where, data }: { where: any; data: any }) => {
        let count = 0;
        const row = commissions.get(where.id);
        if (row) {
          let matches = true;
          if (where.status) {
            if (typeof where.status === "string" && row.status !== where.status) {
              matches = false;
            } else if (where.status.in && !where.status.in.includes(row.status)) {
              matches = false;
            }
          }
          if (matches) {
            Object.assign(row, data, { updatedAt: new Date() });
            commissions.set(where.id, row);
            count++;
          }
        }
        return { count };
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const row = commissions.get(where.id);
        if (!row) throw new Error("Commission not found");
        Object.assign(row, data, { updatedAt: new Date() });
        commissions.set(where.id, row);
        return { ...row };
      },
      findMany: async (args?: { where?: any }) => {
        let list = Array.from(commissions.values());
        if (args?.where?.referrerPartnerId) {
          list = list.filter((c) => c.referrerPartnerId === args.where.referrerPartnerId);
        }
        return list.map((c) => ({ ...c }));
      },
    },

    financialTransaction: {
      create: async ({ data }: { data: any }) => {
        for (const t of financialTransactions.values()) {
          if (t.idempotencyKey === data.idempotencyKey) {
            throw new Prisma.PrismaClientKnownRequestError(
              "Unique constraint failed on financialTransaction idempotencyKey",
              { code: "P2002", clientVersion: "6.0.0" },
            );
          }
        }
        const id = nextId("tx");
        const record = {
          id,
          partnerId: data.partnerId,
          type: data.type,
          amount: new Prisma.Decimal(data.amount.toString()),
          currency: data.currency ?? "TND",
          status: data.status ?? "AVAILABLE",
          idempotencyKey: data.idempotencyKey,
          orderId: data.orderId ?? null,
          withdrawalId: data.withdrawalId ?? null,
          availableAt: data.availableAt ?? null,
          description: data.description ?? null,
          createdById: data.createdById ?? null,
          createdAt: new Date(),
        };
        financialTransactions.set(id, record);
        return { ...record };
      },
      findUnique: async ({ where }: { where: { idempotencyKey?: string } }) => {
        if (where.idempotencyKey) {
          for (const row of financialTransactions.values()) {
            if (row.idempotencyKey === where.idempotencyKey) return { ...row };
          }
        }
        return null;
      },
      findMany: async (args?: { where?: any }) => {
        let list = Array.from(financialTransactions.values());
        if (args?.where?.partnerId) {
          list = list.filter((t) => t.partnerId === args.where.partnerId);
        }
        return list.map((t) => ({ ...t }));
      },
    },

    wallet: {
      upsert: async ({ where, create, update }: { where: { partnerId: string }; create: any; update: any }) => {
        const existing = wallets.get(where.partnerId);
        if (existing) {
          const merged = { ...existing, ...update, updatedAt: new Date() };
          wallets.set(where.partnerId, merged);
          return { ...merged };
        }
        const created = { id: nextId("wal"), ...create, updatedAt: new Date() };
        wallets.set(where.partnerId, created);
        return { ...created };
      },
      findUnique: async ({ where }: { where: { partnerId: string } }) => {
        const row = wallets.get(where.partnerId);
        return row ? { ...row } : null;
      },
    },

    order: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = orders.get(where.id);
        return row ? { ...row } : null;
      },
    },

    auditLog: {
      create: async ({ data }: { data: any }) => {
        const row = { id: nextId("audit"), ...data, createdAt: new Date() };
        auditLogs.push(row);
        return row;
      },
    },
  } as unknown as DbClient;

  return {
    client,
    expenses,
    attributions,
    commissions,
    financialTransactions,
    wallets,
    orders,
    auditLogs,
  };
}

describe("Empirical Challenger 2: Financial Math & Reversals Suite", () => {
  let mock: ReturnType<typeof createFinancialMockDb>;
  let db: DbClient;

  beforeEach(() => {
    mock = createFinancialMockDb();
    db = mock.client;

    // Seed qualified partner attribution
    mock.attributions.set("attr-qualified", {
      id: "attr-qualified",
      referrerPartnerId: "partner-alice",
      referredPartnerId: "partner-bob",
      status: "QUALIFIED",
      referrerPartner: { id: "partner-alice", status: "ACTIVE", code: "ALICE" },
    });
  });

  // ==========================================================================
  // SECTION 1: EXACT NUMERICAL SPECIFICATION
  // ==========================================================================
  describe("1. Exact Numerical Specification (Revenue 5000, Expenses 3000)", () => {
    const R = 5000;
    const E = 3000;

    it("verifies pure math engine produces P=2000, A=1400, B=600, C1=30, C2=60, C3=90 TND", () => {
      // Level 1: 5%
      const m1 = calculateProfitSharing({ revenue: R, expenses: E, referrerLevel: 1 });
      expect(m1.profit.toFixed(3)).toBe("2000.000");
      expect(m1.adminShare.toFixed(3)).toBe("1400.000");
      expect(m1.remainingPool.toFixed(3)).toBe("600.000");
      expect(m1.referralCommission.toFixed(3)).toBe("30.000");
      expect(m1.balanceAfterCommission.toFixed(3)).toBe("570.000");

      // Level 2: 10%
      const m2 = calculateProfitSharing({ revenue: R, expenses: E, referrerLevel: 2 });
      expect(m2.profit.toFixed(3)).toBe("2000.000");
      expect(m2.adminShare.toFixed(3)).toBe("1400.000");
      expect(m2.remainingPool.toFixed(3)).toBe("600.000");
      expect(m2.referralCommission.toFixed(3)).toBe("60.000");
      expect(m2.balanceAfterCommission.toFixed(3)).toBe("540.000");

      // Level 3: 15%
      const m3 = calculateProfitSharing({ revenue: R, expenses: E, referrerLevel: 3 });
      expect(m3.profit.toFixed(3)).toBe("2000.000");
      expect(m3.adminShare.toFixed(3)).toBe("1400.000");
      expect(m3.remainingPool.toFixed(3)).toBe("600.000");
      expect(m3.referralCommission.toFixed(3)).toBe("90.000");
      expect(m3.balanceAfterCommission.toFixed(3)).toBe("510.000");

      // Invariance: A + C + balanceAfterCommission == P for all tiers
      for (const m of [m1, m2, m3]) {
        const sum = m.adminShare.plus(m.referralCommission).plus(m.balanceAfterCommission);
        expect(sum.toFixed(3)).toBe(m.profit.toFixed(3));
      }
    });

    it("verifies referral-commissions module creates persisted commissions matching exact spec", async () => {
      const comm1 = await createReferralCommission({
        attributionId: "attr-qualified",
        revenue: R,
        expenses: E,
        referrerLevel: 1,
        idempotencyKey: "spec-comm-l1",
      }, db);
      expect(comm1.amount.toFixed(3)).toBe("30.000");
      const det1 = comm1.calculationDetails as any;
      expect(det1.revenue).toBe("5000.000");
      expect(det1.expenses).toBe("3000.000");
      expect(det1.profit).toBe("2000.000");
      expect(det1.adminShare).toBe("1400.000");
      expect(det1.remainingPool).toBe("600.000");
      expect(det1.referralCommission).toBe("30.000");
      expect(det1.balanceAfterCommission).toBe("570.000");

      const comm2 = await createReferralCommission({
        attributionId: "attr-qualified",
        revenue: R,
        expenses: E,
        referrerLevel: 2,
        idempotencyKey: "spec-comm-l2",
      }, db);
      expect(comm2.amount.toFixed(3)).toBe("60.000");

      const comm3 = await createReferralCommission({
        attributionId: "attr-qualified",
        revenue: R,
        expenses: E,
        referrerLevel: 3,
        idempotencyKey: "spec-comm-l3",
      }, db);
      expect(comm3.amount.toFixed(3)).toBe("90.000");
    });
  });

  // ==========================================================================
  // SECTION 2: ZERO AND NEGATIVE PROFIT (R <= E) SAFETY
  // ==========================================================================
  describe("2. Zero and Negative Profit (R <= E) Safety", () => {
    it("exact break-even (R == E) produces strictly 0 commission and 0 admin share", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-qualified",
        revenue: "3500.000",
        expenses: "3500.000",
        referrerLevel: 3,
        idempotencyKey: "zero-profit-breakeven",
      }, db);

      expect(comm.amount.toFixed(3)).toBe("0.000");
      const det = comm.calculationDetails as any;
      expect(det.profit).toBe("0.000");
      expect(det.adminShare).toBe("0.000");
      expect(det.remainingPool).toBe("0.000");
      expect(det.referralCommission).toBe("0.000");
      expect(det.balanceAfterCommission).toBe("0.000");
      expect(det.isProfitable).toBe(false);
    });

    it("loss scenario (R < E) produces negative profit, 0 commission, and 0 admin share", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-qualified",
        revenue: "2000.000",
        expenses: "3000.000",
        referrerLevel: 3,
        idempotencyKey: "negative-profit-loss",
      }, db);

      expect(comm.amount.toFixed(3)).toBe("0.000");
      const det = comm.calculationDetails as any;
      expect(det.profit).toBe("-1000.000");
      expect(det.adminShare).toBe("0.000");
      expect(det.remainingPool).toBe("0.000");
      expect(det.referralCommission).toBe("0.000");
      expect(det.isProfitable).toBe(false);
    });

    it("zero revenue with massive expenses (R = 0, E = 500,000) produces 0 commission", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-qualified",
        revenue: "0.000",
        expenses: "500000.000",
        referrerLevel: 2,
        idempotencyKey: "zero-rev-massive-exp",
      }, db);

      expect(comm.amount.toFixed(3)).toBe("0.000");
      const det = comm.calculationDetails as any;
      expect(det.profit).toBe("-500000.000");
      expect(det.adminShare).toBe("0.000");
      expect(det.remainingPool).toBe("0.000");
      expect(det.referralCommission).toBe("0.000");
    });

    it("paying a zero-amount commission does not create ledger entries or distort wallet", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-qualified",
        revenue: 1000,
        expenses: 1000, // P = 0 -> amount = 0
        referrerLevel: 1,
        idempotencyKey: "zero-amount-pay",
        status: "APPROVED_FOR_PAYMENT",
      }, db);

      const paid = await payReferralCommission(comm.id, "finance-1", "ZERO-PAY-REF", { db });
      expect(paid.status).toBe("PAID");

      // No ledger entry created for 0 TND
      const txs = await db.financialTransaction.findMany({ where: { partnerId: "partner-alice" } });
      expect(txs.length).toBe(0);

      // Wallet was not mutated
      const wallet = await db.wallet.findUnique({ where: { partnerId: "partner-alice" } });
      expect(wallet).toBeNull();
    });
  });

  // ==========================================================================
  // SECTION 3: UNAPPROVED EXPENSES EXCLUSION & TAMPER RESISTANCE
  // ==========================================================================
  describe("3. Unapproved Expenses Exclusion & Tamper Resistance", () => {
    it("strictly excludes PENDING and REJECTED expenses from attributable expenses", async () => {
      // 1. Approved expense: 2000.000 TND
      const expApp = await createExpense({
        title: "Logistique Approuvée",
        category: "LOGISTICS",
        amount: "2000.000",
        period: "2026-10",
      }, db);
      await approveExpense(expApp.id, "admin-1", db);

      // 2. Pending expense: 700.000 TND
      await createExpense({
        title: "Publicité En Attente",
        category: "MARKETING",
        amount: "700.000",
        period: "2026-10",
      }, db);

      // 3. Rejected expense: 1200.000 TND
      const expRej = await createExpense({
        title: "Dépense Refusée",
        category: "MISC",
        amount: "1200.000",
        period: "2026-10",
      }, db);
      await rejectExpense(expRej.id, "admin-1", "Dépense non justifiable", db);

      // Query attributable expenses for period "2026-10"
      const res = await getAttributableExpenses({ period: "2026-10" }, db);
      expect(res.count).toBe(1);
      expect(res.total.toFixed(3)).toBe("2000.000");
      expect(res.expenses[0]!.id).toBe(expApp.id);
    });

    it("passing unapproved expense IDs explicitly in expenseIds does not bypass the APPROVED filter", async () => {
      const expPending = await createExpense({
        title: "Pending Expense",
        category: "ADS",
        amount: "500.000",
      }, db);

      const expRejected = await createExpense({
        title: "Rejected Expense",
        category: "ADS",
        amount: "300.000",
      }, db);
      await rejectExpense(expRejected.id, "admin-1", "Rejected", db);

      // Query specifically by unapproved IDs
      const res = await getAttributableExpenses({
        expenseIds: [expPending.id, expRejected.id],
      }, db);

      expect(res.count).toBe(0);
      expect(res.total.toFixed(3)).toBe("0.000");
    });

    it("prevents double-counting duplicate expense IDs in query", async () => {
      const exp = await createExpense({
        title: "Packaging",
        category: "PACKAGING",
        amount: "400.000",
      }, db);
      await approveExpense(exp.id, "admin-1", db);

      // Duplicate list of the same ID 5 times
      const res = await getAttributableExpenses({
        expenseIds: [exp.id, exp.id, exp.id, exp.id, exp.id],
      }, db);

      expect(res.count).toBe(1);
      expect(res.total.toFixed(3)).toBe("400.000");
    });

    it("sumApprovedExpenses helper ignores unapproved and duplicate items", () => {
      const list = [
        { id: "e1", status: "APPROVED", amount: "150.250" },
        { id: "e1", status: "APPROVED", amount: "150.250" }, // duplicate
        { id: "e2", status: "PENDING", amount: "500.000" },  // pending
        { id: "e3", status: "REJECTED", amount: "200.000" }, // rejected
        { id: "e4", status: "APPROVED", amount: "49.750" },
      ];
      const sum = sumApprovedExpenses(list);
      expect(sum.toFixed(3)).toBe("200.000"); // 150.250 + 49.750 = 200.000
    });

    it("blocks updating or mutating an expense once it has been APPROVED", async () => {
      const exp = await createExpense({
        title: "Matériel",
        category: "EQUIPMENT",
        amount: "100.000",
      }, db);
      await approveExpense(exp.id, "admin-1", db);

      // Attempt to tamper with amount after approval
      await expect(
        updateExpense(exp.id, { amount: "500.000" }, "malicious-actor", db),
      ).rejects.toThrow(/Cannot update an expense in status: APPROVED/);
    });

    it("blocks deleting an expense once it has been APPROVED", async () => {
      const exp = await createExpense({
        title: "Serveurs",
        category: "TECH",
        amount: "250.000",
      }, db);
      await approveExpense(exp.id, "admin-1", db);

      await expect(
        deleteExpense(exp.id, "admin-1", db),
      ).rejects.toThrow(/Cannot delete an APPROVED expense/);
    });
  });

  // ==========================================================================
  // SECTION 4: COMMISSION REVERSALS & WALLET LEDGER INTEGRITY
  // ==========================================================================
  describe("4. Commission Reversal Accounting & Wallet Ledger Integrity", () => {
    it("reversal of a PAID commission posts compensating negative ADJUSTMENT and recomputes wallet to 0", async () => {
      // 1. Create commission: P=2000, B=600 -> C=30 TND
      const comm = await createReferralCommission({
        attributionId: "attr-qualified",
        revenue: 5000,
        expenses: 3000,
        referrerLevel: 1,
        idempotencyKey: "rev-paid-test-1",
        status: "APPROVED_FOR_PAYMENT",
      }, db);

      // 2. Pay commission
      await payReferralCommission(comm.id, "finance-1", "PAY-REF-REV-01", { db });

      // Alice's wallet has availableBalance = 30.000 TND
      let wallet = await db.wallet.findUnique({ where: { partnerId: "partner-alice" } });
      expect(wallet!.availableBalance.toFixed(3)).toBe("30.000");

      // 3. Reverse commission
      const reversed = await reverseReferralCommission(
        comm.id,
        "admin-supervisor",
        "Rétractation client post-règlement",
        { db },
      );

      expect(reversed.status).toBe("REVERSED");
      const det = reversed.calculationDetails as any;
      expect(det.accountingPolicy).toBe("COMPENSATING_ADJUSTMENT_POSTED_TO_LEDGER");
      expect(det.reversalReason).toBe("Rétractation client post-règlement");

      // 4. Ledger verification
      const txs = await db.financialTransaction.findMany({ where: { partnerId: "partner-alice" } });
      expect(txs.length).toBe(2);

      const earning = txs.find((t) => t.type === "PARTNER_EARNING");
      expect(earning!.amount.toFixed(3)).toBe("30.000");

      const adjustment = txs.find((t) => t.type === "ADJUSTMENT");
      expect(adjustment!.amount.toFixed(3)).toBe("-30.000");
      expect(adjustment!.idempotencyKey).toBe(`reversal:commission:${comm.id}`);

      // 5. Wallet ledger parity: 30.000 - 30.000 = 0.000
      wallet = await db.wallet.findUnique({ where: { partnerId: "partner-alice" } });
      expect(wallet!.availableBalance.toFixed(3)).toBe("0.000");
    });

    it("idempotency check: repeated reversal of an already REVERSED commission does not post double negative adjustments", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-qualified",
        revenue: 5000,
        expenses: 3000,
        referrerLevel: 1,
        idempotencyKey: "rev-repeat-test",
        status: "APPROVED_FOR_PAYMENT",
      }, db);

      await payReferralCommission(comm.id, "finance-1", "PAY-REPEAT-REV", { db });

      // First reversal
      await reverseReferralCommission(comm.id, "admin-1", "First reversal", { db });

      // Second reversal (idempotent call)
      const secondCall = await reverseReferralCommission(comm.id, "admin-1", "Second reversal", { db });
      expect(secondCall.status).toBe("REVERSED");

      // Exactly ONE negative ADJUSTMENT entry in ledger
      const txs = await db.financialTransaction.findMany({ where: { partnerId: "partner-alice" } });
      const adjustments = txs.filter((t) => t.type === "ADJUSTMENT");
      expect(adjustments.length).toBe(1);

      // Wallet remains at 0.000 (not -30.000)
      const wallet = await db.wallet.findUnique({ where: { partnerId: "partner-alice" } });
      expect(wallet!.availableBalance.toFixed(3)).toBe("0.000");
    });

    it("reversal of an UNPAID commission (ELIGIBLE) transitions to REVERSED without moving funds or posting ledger entries", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-qualified",
        revenue: 2000,
        expenses: 1000,
        referrerLevel: 1,
        idempotencyKey: "rev-unpaid-eligible",
        status: "ELIGIBLE",
      }, db);

      const reversed = await reverseReferralCommission(comm.id, "admin-1", "Order cancelled before payout", { db });
      expect(reversed.status).toBe("REVERSED");
      const det = reversed.calculationDetails as any;
      expect(det.accountingPolicy).toBe("ZERO_FUNDS_MOVED_UNPAID_STATUS_REVERSED");

      // No ledger entries posted
      const txs = await db.financialTransaction.findMany({ where: { partnerId: "partner-alice" } });
      expect(txs.length).toBe(0);

      // Wallet not modified
      const wallet = await db.wallet.findUnique({ where: { partnerId: "partner-alice" } });
      expect(wallet).toBeNull();
    });

    it("rejecting a PAID commission is strictly blocked and directs to reversal", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-qualified",
        revenue: 2000,
        expenses: 1000,
        referrerLevel: 1,
        idempotencyKey: "reject-paid-guard",
        status: "APPROVED_FOR_PAYMENT",
      }, db);

      await payReferralCommission(comm.id, "finance-1", "PAY-BLOCK-REJECT", { db });

      await expect(
        rejectReferralCommission(comm.id, "admin-1", "Attempt reject", { db }),
      ).rejects.toThrow(/Cannot reject a commission that has already been PAID\. Use reverseReferralCommission instead/);
    });

    it("reversal after partner withdrawal creates authorized negative balance that is recovered on next earning", async () => {
      // 1. Earn and pay 60 TND commission (Level 2: R=5000, E=3000 -> B=600 -> C=60 TND)
      const comm1 = await createReferralCommission({
        attributionId: "attr-qualified",
        revenue: 5000,
        expenses: 3000,
        referrerLevel: 2,
        idempotencyKey: "rev-withdrawn-comm1",
        status: "APPROVED_FOR_PAYMENT",
      }, db);
      await payReferralCommission(comm1.id, "finance-1", "PAY-WITHDRAW-TEST", { db });

      let wallet = await db.wallet.findUnique({ where: { partnerId: "partner-alice" } });
      expect(wallet!.availableBalance.toFixed(3)).toBe("60.000");

      // 2. Partner withdraws full 60 TND
      await createWithdrawalPayment(db, {
        withdrawalId: "w-001",
        partnerId: "partner-alice",
        amount: "60.000",
        actorId: "finance-1",
      });

      wallet = await db.wallet.findUnique({ where: { partnerId: "partner-alice" } });
      expect(wallet!.availableBalance.toFixed(3)).toBe("0.000");
      expect(wallet!.totalWithdrawn.toFixed(3)).toBe("60.000");

      // 3. Customer returns order -> commission 1 is reversed
      await reverseReferralCommission(comm1.id, "admin-1", "Customer return post-withdrawal", { db });

      // Wallet available balance is now -60.000 TND (authorized debt)
      wallet = await db.wallet.findUnique({ where: { partnerId: "partner-alice" } });
      expect(wallet!.availableBalance.toFixed(3)).toBe("-60.000");

      // 4. Partner earns new commission of 90 TND (Level 3)
      const comm2 = await createReferralCommission({
        attributionId: "attr-qualified",
        revenue: 5000,
        expenses: 3000,
        referrerLevel: 3,
        idempotencyKey: "rev-recovery-comm2",
        status: "APPROVED_FOR_PAYMENT",
      }, db);
      await payReferralCommission(comm2.id, "finance-1", "PAY-RECOVERY", { db });

      // Wallet available balance recovers: -60 + 90 = +30.000 TND
      wallet = await db.wallet.findUnique({ where: { partnerId: "partner-alice" } });
      expect(wallet!.availableBalance.toFixed(3)).toBe("30.000");
    });
  });

  // ==========================================================================
  // SECTION 5: LIFECYCLE PROGRESSION & PAYOUT GATES
  // ==========================================================================
  describe("5. Lifecycle Progression & Payout Gates", () => {
    it("approval strictly requires ELIGIBLE or PENDING_VERIFICATION and does not mark as PAID", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-qualified",
        revenue: 1000,
        expenses: 0,
        referrerLevel: 1,
        idempotencyKey: "gate-approval-test",
        status: "PENDING_VERIFICATION",
      }, db);

      const approved = await approveReferralCommission(comm.id, "admin-approver", undefined, db);
      expect(approved.status).toBe("APPROVED_FOR_PAYMENT");
      expect(approved.approvedAt).toBeInstanceOf(Date);
      expect(approved.approvedById).toBe("admin-approver");
      expect(approved.paidAt).toBeNull();
      expect(approved.paidById).toBeNull();
    });

    it("payout strictly requires non-empty transaction reference", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-qualified",
        revenue: 1000,
        expenses: 0,
        referrerLevel: 1,
        idempotencyKey: "gate-empty-ref-test",
        status: "APPROVED_FOR_PAYMENT",
      }, db);

      await expect(
        payReferralCommission(comm.id, "finance-1", "", { db }),
      ).rejects.toThrow(/Payment reference.*strictly required/);

      await expect(
        payReferralCommission(comm.id, "finance-1", "   ", { db }),
      ).rejects.toThrow(/Payment reference.*strictly required/);
    });

    it("skipping approval directly to PAID throws ReferralCommissionError", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-qualified",
        revenue: 1000,
        expenses: 0,
        referrerLevel: 1,
        idempotencyKey: "gate-skip-approval",
        status: "ELIGIBLE",
      }, db);

      await expect(
        payReferralCommission(comm.id, "finance-1", "REF-ILLEGAL-SKIP", { db }),
      ).rejects.toThrow(/status must be APPROVED_FOR_PAYMENT/);
    });
  });
});
