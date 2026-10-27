import { describe, expect, it, beforeEach } from "vitest";
import Decimal from "decimal.js";
import { Prisma, ExpenseStatus, ReferralCommissionStatus } from "@prisma/client";
import {
  createExpense,
  approveExpense,
  rejectExpense,
  getAttributableExpenses,
  sumApprovedExpenses,
  ExpenseError,
} from "@/modules/finance/expenses";
import {
  createReferralCommission,
  verifyReferralCommission,
  approveReferralCommission,
  payReferralCommission,
  rejectReferralCommission,
  reverseReferralCommission,
  ReferralCommissionError,
  type DbClient,
} from "@/modules/finance/referral-commissions";
import { calculateProfitSharing } from "@/modules/finance/referral-math";

/**
 * High-fidelity in-memory Mock Database Client for Unit Testing.
 * Simulates Prisma models, transactions, atomic updateMany, unique constraints, and audit logging.
 */
function createMockDb() {
  const expenses = new Map<string, any>();
  const attributions = new Map<string, any>();
  const commissions = new Map<string, any>();
  const financialTransactions = new Map<string, any>();
  const wallets = new Map<string, any>();
  const orders = new Map<string, any>();
  const auditLogs: any[] = [];
  const systemSettings = new Map<string, any>();

  let idCounter = 1;
  const nextId = (prefix: string) => `${prefix}-${idCounter++}`;

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
        const updated = {
          ...existing,
          ...data,
          updatedAt: new Date(),
        };
        expenses.set(where.id, updated);
        return { ...updated };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        expenses.delete(where.id);
        return { id: where.id };
      },
    },

    referralAttribution: {
      findUnique: async ({ where }: { where: { id?: string; referredPartnerId?: string } }) => {
        if (where.id) {
          const row = attributions.get(where.id);
          return row ? { ...row } : null;
        }
        if (where.referredPartnerId) {
          for (const row of attributions.values()) {
            if (row.referredPartnerId === where.referredPartnerId) {
              return { ...row };
            }
          }
        }
        return null;
      },
      count: async ({ where }: { where: any }) => {
        let list = Array.from(attributions.values());
        if (where?.referrerPartnerId) {
          list = list.filter((a) => a.referrerPartnerId === where.referrerPartnerId);
        }
        if (where?.status) {
          list = list.filter((a) => a.status === where.status);
        }
        return list.length;
      },
    },

    referralCommission: {
      create: async ({ data }: { data: any }) => {
        // Enforce unique idempotencyKey constraint
        for (const c of commissions.values()) {
          if (c.idempotencyKey === data.idempotencyKey) {
            const p2002 = new Prisma.PrismaClientKnownRequestError(
              "Unique constraint failed on idempotencyKey",
              { code: "P2002", clientVersion: "6.0.0" },
            );
            throw p2002;
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
        if (args?.where) {
          const w = args.where;
          if (w.referrerPartnerId) list = list.filter((c) => c.referrerPartnerId === w.referrerPartnerId);
          if (w.status) list = list.filter((c) => c.status === w.status);
        }
        return list.map((c) => ({ ...c }));
      },
    },

    financialTransaction: {
      create: async ({ data }: { data: any }) => {
        // Enforce unique idempotencyKey constraint
        for (const t of financialTransactions.values()) {
          if (t.idempotencyKey === data.idempotencyKey) {
            const p2002 = new Prisma.PrismaClientKnownRequestError(
              "Unique constraint failed on financialTransaction idempotencyKey",
              { code: "P2002", clientVersion: "6.0.0" },
            );
            throw p2002;
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

    partner: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        return { id: where.id, createdAt: new Date("2026-01-01"), status: "ACTIVE" };
      },
    },

    systemSetting: {
      findUnique: async ({ where }: { where: { key: string } }) => {
        const row = systemSettings.get(where.key);
        return row ? { ...row } : null;
      },
      upsert: async ({ where, create, update }: { where: { key: string }; create: any; update: any }) => {
        const existing = systemSettings.get(where.key);
        if (existing) {
          const merged = { ...existing, ...update };
          systemSettings.set(where.key, merged);
          return merged;
        }
        systemSettings.set(where.key, create);
        return create;
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
    systemSettings,
  };
}

describe("Milestone 4: Expenses Management, Commission Lifecycle & Payout Safety", () => {
  let mock: ReturnType<typeof createMockDb>;
  let db: DbClient;

  beforeEach(() => {
    mock = createMockDb();
    db = mock.client;

    // Seed qualified attribution for partner tests
    mock.attributions.set("attr-qualified-1", {
      id: "attr-qualified-1",
      referrerPartnerId: "partner-alice",
      referredPartnerId: "partner-bob",
      status: "QUALIFIED",
      qualifyingOrderId: "order-100",
      qualifiedAt: new Date("2026-10-01"),
      referrerPartner: { id: "partner-alice", status: "ACTIVE", code: "ALICE" },
    });

    // Seed pending attribution
    mock.attributions.set("attr-pending-1", {
      id: "attr-pending-1",
      referrerPartnerId: "partner-alice",
      referredPartnerId: "partner-charlie",
      status: "PENDING_QUALIFICATION",
      referrerPartner: { id: "partner-alice", status: "ACTIVE", code: "ALICE" },
    });

    // Seed rejected attribution
    mock.attributions.set("attr-rejected-1", {
      id: "attr-rejected-1",
      referrerPartnerId: "partner-alice",
      referredPartnerId: "partner-dave",
      status: "REJECTED",
      referrerPartner: { id: "partner-alice", status: "ACTIVE", code: "ALICE" },
    });
  });

  // ============================================================================
  // 1. EXPENSES MANAGEMENT & APPROVAL WORKFLOW
  // ============================================================================
  describe("1. Expenses Management & Attributable Expense Deductions (E)", () => {
    it("creates a business expense in PENDING status with 3-decimal precision", async () => {
      const exp = await createExpense(
        {
          title: "Campagne Facebook Ads Q4",
          category: "MARKETING",
          amount: "450.750",
          period: "2026-10",
          createdById: "admin-1",
        },
        db,
      );

      expect(exp.id).toBeDefined();
      expect(exp.title).toBe("Campagne Facebook Ads Q4");
      expect(exp.category).toBe("MARKETING");
      expect(exp.amount.toFixed(3)).toBe("450.750");
      expect(exp.status).toBe("PENDING");
      expect(exp.period).toBe("2026-10");
    });

    it("rejects expense creation with invalid or non-positive amount", async () => {
      await expect(
        createExpense({ title: "Valid Title", category: "OPS", amount: 0 }, db),
      ).rejects.toThrow(ExpenseError);

      await expect(
        createExpense({ title: "Valid Title", category: "OPS", amount: -50 }, db),
      ).rejects.toThrow(ExpenseError);

      await expect(
        createExpense({ title: "", category: "OPS", amount: 100 }, db),
      ).rejects.toThrow(ExpenseError);

      await expect(
        createExpense({ title: "Title", category: "", amount: 100 }, db),
      ).rejects.toThrow(ExpenseError);
    });

    it("approves a pending expense and records approvedAt and approvedById", async () => {
      const exp = await createExpense(
        { title: "Fournitures packaging", category: "PACKAGING", amount: "120.000" },
        db,
      );

      const approved = await approveExpense(exp.id, "admin-1", db);
      expect(approved.status).toBe("APPROVED");
      expect(approved.approvedById).toBe("admin-1");
      expect(approved.approvedAt).toBeInstanceOf(Date);
    });

    it("rejects a pending expense and records the rejection note", async () => {
      const exp = await createExpense(
        { title: "Dépense non justifiée", category: "MISC", amount: "80.000" },
        db,
      );

      const rejected = await rejectExpense(exp.id, "admin-1", "Facture manquante", db);
      expect(rejected.status).toBe("REJECTED");
      expect(rejected.notes).toContain("Facture manquante");
    });

    it("strictly excludes PENDING and REJECTED expenses from attributable expenses E", async () => {
      // 1 approved expense: 3000 TND
      const expApproved = await createExpense(
        { title: "Livraison & Logistique", category: "LOGISTICS", amount: "3000.000", period: "2026-10" },
        db,
      );
      await approveExpense(expApproved.id, "admin-1", db);

      // 1 pending expense: 500 TND
      await createExpense(
        { title: "Marketing en attente", category: "ADS", amount: "500.000", period: "2026-10" },
        db,
      );

      // 1 rejected expense: 800 TND
      const expRejected = await createExpense(
        { title: "Dépense rejetée", category: "ADS", amount: "800.000", period: "2026-10" },
        db,
      );
      await rejectExpense(expRejected.id, "admin-1", "Non éligible", db);

      // Query attributable expenses for period "2026-10"
      const res = await getAttributableExpenses({ period: "2026-10" }, db);

      // Only the APPROVED expense is deducted
      expect(res.count).toBe(1);
      expect(res.total.toFixed(3)).toBe("3000.000");
      expect(res.expenses[0]!.id).toBe(expApproved.id);
    });

    it("enforces that no expense is counted twice during deduplication", async () => {
      const exp1 = await createExpense(
        { title: "Frais bancaires", category: "BANK", amount: "25.500" },
        db,
      );
      await approveExpense(exp1.id, "admin-1", db);

      const exp2 = await createExpense(
        { title: "Serveur & Hébergement", category: "TECH", amount: "74.500" },
        db,
      );
      await approveExpense(exp2.id, "admin-1", db);

      // Query passing duplicate IDs: [exp1, exp1, exp2, exp2, exp1]
      const res = await getAttributableExpenses(
        { expenseIds: [exp1.id, exp1.id, exp2.id, exp2.id, exp1.id] },
        db,
      );

      expect(res.count).toBe(2);
      expect(res.total.toFixed(3)).toBe("100.000"); // 25.500 + 74.500 = 100.000 TND exactly
    });

    it("sumApprovedExpenses helper deduplicates and sums only APPROVED items", () => {
      const list = [
        { id: "e1", status: "APPROVED", amount: "50.125" },
        { id: "e1", status: "APPROVED", amount: "50.125" }, // duplicate attempt
        { id: "e2", status: "PENDING", amount: "20.000" }, // pending excluded
        { id: "e3", status: "REJECTED", amount: "35.000" }, // rejected excluded
        { id: "e4", status: "APPROVED", amount: "49.875" },
      ];

      const sum = sumApprovedExpenses(list);
      expect(sum.toFixed(3)).toBe("100.000"); // 50.125 + 49.875 = 100.000
    });
  });

  // ============================================================================
  // 2. COMMISSION CALCULATION & PROFIT SHARING MATHEMATICS
  // ============================================================================
  describe("2. Commission Calculation Formula & Exact Numerical Spec", () => {
    // Exact numerical spec from Requirement R4:
    // Revenue = 5000 TND, Expenses = 3000 TND
    // -> P = 2000 TND
    // -> A = 70% × 2000 = 1400 TND
    // -> B = 30% × 2000 = 600 TND
    // -> Level 1 (5%): C = 30 TND, Balance = 570 TND
    // -> Level 2 (10%): C = 60 TND, Balance = 540 TND
    // -> Level 3 (15%): C = 90 TND, Balance = 510 TND
    it("satisfies the exact numerical spec: 5000 - 3000 = 2000 -> A = 1400, B = 600, C1 = 30, C2 = 60, C3 = 90 TND", async () => {
      const revenue = 5000;
      const expenses = 3000;

      // Level 1: 5%
      const commL1 = await createReferralCommission({
        attributionId: "attr-qualified-1",
        revenue,
        expenses,
        referrerLevel: 1,
        idempotencyKey: "spec-l1",
      }, db);
      expect(commL1.amount.toFixed(3)).toBe("30.000");
      const detailsL1 = commL1.calculationDetails as any;
      expect(detailsL1.profit).toBe("2000.000");
      expect(detailsL1.adminShare).toBe("1400.000");
      expect(detailsL1.remainingPool).toBe("600.000");
      expect(detailsL1.referralCommission).toBe("30.000");
      expect(detailsL1.balanceAfterCommission).toBe("570.000");

      // Level 2: 10%
      const commL2 = await createReferralCommission({
        attributionId: "attr-qualified-1",
        revenue,
        expenses,
        referrerLevel: 2,
        idempotencyKey: "spec-l2",
      }, db);
      expect(commL2.amount.toFixed(3)).toBe("60.000");
      const detailsL2 = commL2.calculationDetails as any;
      expect(detailsL2.referralCommission).toBe("60.000");
      expect(detailsL2.balanceAfterCommission).toBe("540.000");

      // Level 3: 15%
      const commL3 = await createReferralCommission({
        attributionId: "attr-qualified-1",
        revenue,
        expenses,
        referrerLevel: 3,
        idempotencyKey: "spec-l3",
      }, db);
      expect(commL3.amount.toFixed(3)).toBe("90.000");
      const detailsL3 = commL3.calculationDetails as any;
      expect(detailsL3.referralCommission).toBe("90.000");
      expect(detailsL3.balanceAfterCommission).toBe("510.000");
    });

    it("generates zero commission and zero admin profit share when profit is exactly zero (R = E)", async () => {
      const commZero = await createReferralCommission({
        attributionId: "attr-qualified-1",
        revenue: "2500.000",
        expenses: "2500.000",
        referrerLevel: 3,
        idempotencyKey: "comm-zero-profit",
      }, db);

      expect(commZero.amount.toFixed(3)).toBe("0.000");
      const details = commZero.calculationDetails as any;
      expect(details.profit).toBe("0.000");
      expect(details.adminShare).toBe("0.000");
      expect(details.remainingPool).toBe("0.000");
      expect(details.referralCommission).toBe("0.000");
      expect(details.isProfitable).toBe(false);
    });

    it("generates zero commission and zero admin share when profit is negative (R < E)", async () => {
      const commLoss = await createReferralCommission({
        attributionId: "attr-qualified-1",
        revenue: "1500.000",
        expenses: "2500.000", // P = -1000 TND
        referrerLevel: 2,
        idempotencyKey: "comm-loss",
      }, db);

      expect(commLoss.amount.toFixed(3)).toBe("0.000");
      const details = commLoss.calculationDetails as any;
      expect(details.profit).toBe("-1000.000");
      expect(details.adminShare).toBe("0.000");
      expect(details.remainingPool).toBe("0.000");
      expect(details.referralCommission).toBe("0.000");
      expect(details.isProfitable).toBe(false);
    });

    it("automatically derives attributable expenses E from period when not passed explicitly", async () => {
      // Create and approve an expense of 3000 TND in period "2026-11"
      const exp = await createExpense({
        title: "Logistique Novembre",
        category: "LOGISTICS",
        amount: "3000.000",
        period: "2026-11",
      }, db);
      await approveExpense(exp.id, "admin-1", db);

      // Create commission specifying period "2026-11" without explicit expenses
      const comm = await createReferralCommission({
        attributionId: "attr-qualified-1",
        revenue: 5000,
        period: "2026-11",
        referrerLevel: 1,
        idempotencyKey: "comm-period-lookup",
      }, db);

      expect(comm.amount.toFixed(3)).toBe("30.000");
      const details = comm.calculationDetails as any;
      expect(details.revenue).toBe("5000.000");
      expect(details.expenses).toBe("3000.000");
      expect(details.profit).toBe("2000.000");
    });

    it("automatically resolves collected revenue R from order when not passed explicitly", async () => {
      // Seed an order with unitSellingPrice = 50.000 and quantity = 100 -> R = 5000.000
      mock.orders.set("order-auto-rev", {
        id: "order-auto-rev",
        unitSellingPrice: new Prisma.Decimal("50.000"),
        quantity: 100,
      });

      const comm = await createReferralCommission({
        attributionId: "attr-qualified-1",
        orderId: "order-auto-rev",
        expenses: "3000.000",
        referrerLevel: 2,
        idempotencyKey: "comm-order-lookup",
      }, db);

      expect(comm.amount.toFixed(3)).toBe("60.000");
      const details = comm.calculationDetails as any;
      expect(details.revenue).toBe("5000.000");
      expect(details.expenses).toBe("3000.000");
      expect(details.profit).toBe("2000.000");
    });
  });

  // ============================================================================
  // 3. ATTRIBUTION PRECONDITIONS
  // ============================================================================
  describe("3. Attribution Qualification Preconditions", () => {
    it("rejects commission creation when attribution does not exist", async () => {
      await expect(
        createReferralCommission({
          attributionId: "non-existent-attr",
          revenue: 1000,
          expenses: 200,
        }, db),
      ).rejects.toThrow(/Referral attribution not found/);
    });

    it("rejects commission creation when attribution is in PENDING_QUALIFICATION status", async () => {
      await expect(
        createReferralCommission({
          attributionId: "attr-pending-1",
          revenue: 1000,
          expenses: 200,
        }, db),
      ).rejects.toThrow(/is not qualified/);
    });

    it("rejects commission creation when attribution is in REJECTED status", async () => {
      await expect(
        createReferralCommission({
          attributionId: "attr-rejected-1",
          revenue: 1000,
          expenses: 200,
        }, db),
      ).rejects.toThrow(/is not qualified/);
    });
  });

  // ============================================================================
  // 4. COMMISSION LIFECYCLE PROGRESSION & PAYOUT SAFETY
  // ============================================================================
  describe("4. Commission Lifecycle Progression & Payout Safety", () => {
    it("follows full lifecycle progression: PENDING_VERIFICATION -> ELIGIBLE -> APPROVED_FOR_PAYMENT -> PAID", async () => {
      // 1. Creation -> PENDING_VERIFICATION
      const comm = await createReferralCommission({
        attributionId: "attr-qualified-1",
        revenue: 2000,
        expenses: 1000,
        referrerLevel: 1, // P=1000 -> B=300 -> C=15 TND
        idempotencyKey: "comm-lifecycle-1",
        status: "PENDING_VERIFICATION",
      }, db);
      expect(comm.status).toBe("PENDING_VERIFICATION");

      // 2. Verification -> ELIGIBLE
      const verified = await verifyReferralCommission(comm.id, "verifier-1", db);
      expect(verified.status).toBe("ELIGIBLE");

      // 3. Admin Approval -> APPROVED_FOR_PAYMENT
      const approved = await approveReferralCommission(comm.id, "admin-approver", { reason: "Conforme" }, db);
      expect(approved.status).toBe("APPROVED_FOR_PAYMENT");
      expect(approved.approvedAt).toBeInstanceOf(Date);
      expect(approved.approvedById).toBe("admin-approver");

      // INVARIANCE: APPROVED_FOR_PAYMENT does NOT mark as PAID
      expect(approved.status).not.toBe("PAID");
      expect(approved.paidAt).toBeNull();
      expect(approved.paidById).toBeNull();

      // 4. Payment Execution -> PAID
      const paid = await payReferralCommission(
        comm.id,
        "finance-operator",
        "VIR-2026-TN-009988",
        { db },
      );
      expect(paid.status).toBe("PAID");
      expect(paid.paidAt).toBeInstanceOf(Date);
      expect(paid.paidById).toBe("finance-operator");

      // Financial ledger entry and wallet updated
      const txs = await db.financialTransaction.findMany({ where: { partnerId: "partner-alice" } });
      expect(txs.length).toBe(1);
      expect(txs[0]!.type).toBe("PARTNER_EARNING");
      expect(txs[0]!.amount.toFixed(3)).toBe("15.000");

      const wallet = await db.wallet.findUnique({ where: { partnerId: "partner-alice" } });
      expect(wallet).not.toBeNull();
      expect(wallet!.availableBalance.toFixed(3)).toBe("15.000");
    });

    it("verifies that APPROVED_FOR_PAYMENT strictly does NOT mark as PAID", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-qualified-1",
        revenue: 4000,
        expenses: 2000,
        referrerLevel: 2,
        idempotencyKey: "comm-approval-separation",
        status: "ELIGIBLE",
      }, db);

      const approved = await approveReferralCommission(comm.id, "admin-1", undefined, db);

      expect(approved.status).toBe("APPROVED_FOR_PAYMENT");
      expect(approved.paidAt).toBeNull();
      expect(approved.paidById).toBeNull();

      // Check in database
      const row = await db.referralCommission.findUnique({ where: { id: comm.id } });
      expect(row!.status).toBe("APPROVED_FOR_PAYMENT");
      expect(row!.paidAt).toBeNull();
    });

    it("strictly requires recorded payment reference (transactionReference) to pay commission", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-qualified-1",
        revenue: 1000,
        expenses: 0,
        referrerLevel: 1,
        idempotencyKey: "comm-pay-no-ref",
        status: "ELIGIBLE",
      }, db);

      await approveReferralCommission(comm.id, "admin-1", undefined, db);

      // Attempt to pay with empty reference
      await expect(
        payReferralCommission(comm.id, "finance-1", "", { db }),
      ).rejects.toThrow(/Payment reference.*strictly required/);

      // Attempt to pay with whitespace reference
      await expect(
        payReferralCommission(comm.id, "finance-1", "   ", { db }),
      ).rejects.toThrow(/Payment reference.*strictly required/);

      // Still in APPROVED_FOR_PAYMENT
      const row = await db.referralCommission.findUnique({ where: { id: comm.id } });
      expect(row!.status).toBe("APPROVED_FOR_PAYMENT");
    });

    it("strictly rejects skipping approval directly to PAID", async () => {
      // From PENDING_VERIFICATION
      const pendingComm = await createReferralCommission({
        attributionId: "attr-qualified-1",
        revenue: 1000,
        expenses: 0,
        referrerLevel: 1,
        idempotencyKey: "comm-skip-pending",
        status: "PENDING_VERIFICATION",
      }, db);

      await expect(
        payReferralCommission(pendingComm.id, "finance-1", "REF-SKIP-1", { db }),
      ).rejects.toThrow(/status must be APPROVED_FOR_PAYMENT/);

      // From ELIGIBLE
      const eligibleComm = await createReferralCommission({
        attributionId: "attr-qualified-1",
        revenue: 1000,
        expenses: 0,
        referrerLevel: 1,
        idempotencyKey: "comm-skip-eligible",
        status: "ELIGIBLE",
      }, db);

      await expect(
        payReferralCommission(eligibleComm.id, "finance-1", "REF-SKIP-2", { db }),
      ).rejects.toThrow(/status must be APPROVED_FOR_PAYMENT/);
    });
  });

  // ============================================================================
  // 5. REJECTION & REVERSAL POLICIES
  // ============================================================================
  describe("5. Rejection and Reversal Workflows", () => {
    it("requires non-empty rejection reason and transitions status to REJECTED", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-qualified-1",
        revenue: 1000,
        expenses: 0,
        referrerLevel: 1,
        idempotencyKey: "comm-reject-test",
        status: "ELIGIBLE",
      }, db);

      // Empty reason throws
      await expect(
        rejectReferralCommission(comm.id, "admin-1", "", { db }),
      ).rejects.toThrow(/Rejection reason is mandatory/);

      await expect(
        rejectReferralCommission(comm.id, "admin-1", "   ", { db }),
      ).rejects.toThrow(/Rejection reason is mandatory/);

      // Valid rejection succeeds
      const rejected = await rejectReferralCommission(
        comm.id,
        "admin-1",
        "Commande qualifiante suspecte",
        { db },
      );
      expect(rejected.status).toBe("REJECTED");
      expect(rejected.rejectionReason).toBe("Commande qualifiante suspecte");
    });

    it("prevents rejecting a commission that has already been PAID", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-qualified-1",
        revenue: 1000,
        expenses: 0,
        referrerLevel: 1,
        idempotencyKey: "comm-reject-paid",
        status: "ELIGIBLE",
      }, db);

      await approveReferralCommission(comm.id, "admin-1", undefined, db);
      await payReferralCommission(comm.id, "finance-1", "VIR-1234", { db });

      await expect(
        rejectReferralCommission(comm.id, "admin-1", "Annulation tardive", { db }),
      ).rejects.toThrow(/Cannot reject a commission that has already been PAID/);
    });

    it("requires non-empty reversal reason and transitions status to REVERSED", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-qualified-1",
        revenue: 1000,
        expenses: 0,
        referrerLevel: 1,
        idempotencyKey: "comm-reverse-test",
        status: "ELIGIBLE",
      }, db);

      await expect(
        reverseReferralCommission(comm.id, "admin-1", "", { db }),
      ).rejects.toThrow(/Reversal reason is mandatory/);

      const reversed = await reverseReferralCommission(
        comm.id,
        "admin-1",
        "Commande retournée après règlement",
        { db },
      );
      expect(reversed.status).toBe("REVERSED");
      expect(reversed.rejectionReason).toContain("Commande retournée après règlement");
    });

    it("reverses a previously PAID commission following documented accounting policy with compensating adjustment", async () => {
      // 1. Create, approve, pay commission (amount = 30 TND)
      const comm = await createReferralCommission({
        attributionId: "attr-qualified-1",
        revenue: 5000,
        expenses: 3000, // P=2000, B=600, r=5% -> C=30 TND
        referrerLevel: 1,
        idempotencyKey: "comm-paid-to-reverse",
        status: "ELIGIBLE",
      }, db);

      await approveReferralCommission(comm.id, "admin-1", undefined, db);
      await payReferralCommission(comm.id, "finance-1", "VIR-REVERSE-001", { db });

      // Alice's wallet has available balance 30.000 TND
      let wallet = await db.wallet.findUnique({ where: { partnerId: "partner-alice" } });
      expect(wallet!.availableBalance.toFixed(3)).toBe("30.000");

      // 2. Reverse commission due to post-settlement order return
      const reversed = await reverseReferralCommission(
        comm.id,
        "admin-supervisor",
        "Colis retourné et remboursé après settlement",
        { db },
      );

      expect(reversed.status).toBe("REVERSED");
      const details = reversed.calculationDetails as any;
      expect(details.accountingPolicy).toBe("COMPENSATING_ADJUSTMENT_POSTED_TO_LEDGER");
      expect(details.reversalReason).toBe("Colis retourné et remboursé après settlement");

      // 3. Verify compensating ledger adjustment (-30.000 TND)
      const txs = await db.financialTransaction.findMany({ where: { partnerId: "partner-alice" } });
      expect(txs.length).toBe(2); // 1 PARTNER_EARNING + 1 ADJUSTMENT
      const adjustment = txs.find((t) => t.type === "ADJUSTMENT");
      expect(adjustment).toBeDefined();
      expect(adjustment!.amount.toFixed(3)).toBe("-30.000");

      // 4. Verify wallet recomputed accurately: 30 - 30 = 0
      wallet = await db.wallet.findUnique({ where: { partnerId: "partner-alice" } });
      expect(wallet!.availableBalance.toFixed(3)).toBe("0.000");
    });
  });

  // ============================================================================
  // 6. IDEMPOTENCY & CONCURRENCY SAFETY
  // ============================================================================
  describe("6. Idempotency & Concurrency Safety", () => {
    it("blocks duplicate commission creation by unique idempotency key", async () => {
      const key = "unique-key-event-100";

      // First creation succeeds
      const first = await createReferralCommission({
        attributionId: "attr-qualified-1",
        revenue: 1000,
        expenses: 200,
        referrerLevel: 1,
        idempotencyKey: key,
      }, db);
      expect(first.id).toBeDefined();

      // Duplicate creation with same idempotency key is blocked
      await expect(
        createReferralCommission({
          attributionId: "attr-qualified-1",
          revenue: 1000,
          expenses: 200,
          referrerLevel: 1,
          idempotencyKey: key,
        }, db),
      ).rejects.toThrow(/Duplicate commission creation blocked/);
    });

    it("blocks repeated payment requests for an already PAID commission", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-qualified-1",
        revenue: 2000,
        expenses: 1000,
        referrerLevel: 1,
        idempotencyKey: "comm-pay-twice",
        status: "ELIGIBLE",
      }, db);

      await approveReferralCommission(comm.id, "admin-1", undefined, db);

      // First payout succeeds
      await payReferralCommission(comm.id, "finance-1", "PAY-REF-1", { db });

      // Second payout is blocked
      await expect(
        payReferralCommission(comm.id, "finance-1", "PAY-REF-2", { db }),
      ).rejects.toThrow(/has already been paid \(duplicate payment blocked\)/);
    });

    it("blocks concurrent payment requests via atomic conditional update", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-qualified-1",
        revenue: 2000,
        expenses: 1000,
        referrerLevel: 1,
        idempotencyKey: "comm-concurrent-pay",
        status: "ELIGIBLE",
      }, db);

      await approveReferralCommission(comm.id, "admin-1", undefined, db);

      // Simulate 2 concurrent payout attempts
      const call1 = payReferralCommission(comm.id, "finance-1", "PAY-CONCURRENT-1", { db });
      const call2 = payReferralCommission(comm.id, "finance-2", "PAY-CONCURRENT-2", { db });

      const results = await Promise.allSettled([call1, call2]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // Exactly ONE must succeed and the other must be rejected
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
    });
  });
});
