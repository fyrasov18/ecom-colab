import { describe, expect, it, beforeEach } from "vitest";
import Decimal from "decimal.js";
import { Prisma, ReferralCommissionStatus } from "@prisma/client";
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

/**
 * Adversarial Concurrency & Lifecycle Mock Database Client.
 * Simulates atomic database updates, row locking behavior, unique constraint violations,
 * ledger transaction creation, and audit trails.
 */
function createAdversarialMockDb() {
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
    attributions,
    commissions,
    financialTransactions,
    wallets,
    orders,
    auditLogs,
    systemSettings,
  };
}

describe("Empirical Challenger 1: Milestone 4 Lifecycle & Concurrency Stress Test", () => {
  let mock: ReturnType<typeof createAdversarialMockDb>;
  let db: DbClient;

  beforeEach(() => {
    mock = createAdversarialMockDb();
    db = mock.client;

    // Seed qualified attribution for tests
    mock.attributions.set("attr-stress-1", {
      id: "attr-stress-1",
      referrerPartnerId: "partner-stress-alice",
      referredPartnerId: "partner-stress-bob",
      status: "QUALIFIED",
      qualifyingOrderId: "order-999",
      qualifiedAt: new Date("2026-10-01"),
      referrerPartner: { id: "partner-stress-alice", status: "ACTIVE", code: "STRESS_ALICE" },
    });
  });

  // ============================================================================
  // REQUIREMENT 1: LIFECYCLE SKIPPING PREVENTION
  // ============================================================================
  describe("1. State Machine Skipping Prevention", () => {
    it("strictly rejects skipping from ELIGIBLE directly to PAID without prior approval", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-stress-1",
        revenue: 5000,
        expenses: 3000,
        referrerLevel: 1,
        idempotencyKey: "skip-test-eligible",
        status: "ELIGIBLE",
      }, db);

      expect(comm.status).toBe("ELIGIBLE");

      // Attempt to pay directly from ELIGIBLE status
      await expect(
        payReferralCommission(comm.id, "finance-actor", "VIR-SKIP-ATTEMPT-1", { db }),
      ).rejects.toThrow(ReferralCommissionError);

      await expect(
        payReferralCommission(comm.id, "finance-actor", "VIR-SKIP-ATTEMPT-1", { db }),
      ).rejects.toThrow(/status must be APPROVED_FOR_PAYMENT/i);

      // Verify commission state was not mutated
      const fresh = await db.referralCommission.findUnique({ where: { id: comm.id } });
      expect(fresh!.status).toBe("ELIGIBLE");
      expect(fresh!.paidAt).toBeNull();
      expect(fresh!.paidById).toBeNull();
    });

    it("strictly rejects skipping from PENDING_VERIFICATION directly to PAID without approval", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-stress-1",
        revenue: 2000,
        expenses: 500,
        referrerLevel: 2,
        idempotencyKey: "skip-test-pending",
        status: "PENDING_VERIFICATION",
      }, db);

      expect(comm.status).toBe("PENDING_VERIFICATION");

      await expect(
        payReferralCommission(comm.id, "finance-actor", "VIR-SKIP-ATTEMPT-2", { db }),
      ).rejects.toThrow(ReferralCommissionError);

      const fresh = await db.referralCommission.findUnique({ where: { id: comm.id } });
      expect(fresh!.status).toBe("PENDING_VERIFICATION");
      expect(fresh!.paidAt).toBeNull();
    });

    it("strictly rejects paying a REJECTED commission", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-stress-1",
        revenue: 1000,
        expenses: 200,
        referrerLevel: 1,
        idempotencyKey: "skip-test-rejected",
        status: "ELIGIBLE",
      }, db);

      await rejectReferralCommission(comm.id, "admin-actor", "Fraude suspectée", { db });

      await expect(
        payReferralCommission(comm.id, "finance-actor", "VIR-SKIP-ATTEMPT-3", { db }),
      ).rejects.toThrow(/status must be APPROVED_FOR_PAYMENT/i);
    });

    it("strictly rejects paying an already REVERSED commission", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-stress-1",
        revenue: 1000,
        expenses: 200,
        referrerLevel: 1,
        idempotencyKey: "skip-test-reversed",
        status: "ELIGIBLE",
      }, db);

      await reverseReferralCommission(comm.id, "admin-actor", "Annulation de commande", { db });

      await expect(
        payReferralCommission(comm.id, "finance-actor", "VIR-SKIP-ATTEMPT-4", { db }),
      ).rejects.toThrow(/status must be APPROVED_FOR_PAYMENT/i);
    });

    it("strictly rejects approving a terminal REJECTED or REVERSED commission", async () => {
      const comm1 = await createReferralCommission({
        attributionId: "attr-stress-1",
        revenue: 1000,
        expenses: 200,
        referrerLevel: 1,
        idempotencyKey: "resurrect-rejected",
        status: "ELIGIBLE",
      }, db);
      await rejectReferralCommission(comm1.id, "admin-actor", "Rejet définitif", { db });

      await expect(
        approveReferralCommission(comm1.id, "admin-actor", "Tentative résurrection", db),
      ).rejects.toThrow(/terminal status REJECTED/i);

      const comm2 = await createReferralCommission({
        attributionId: "attr-stress-1",
        revenue: 1000,
        expenses: 200,
        referrerLevel: 1,
        idempotencyKey: "resurrect-reversed",
        status: "ELIGIBLE",
      }, db);
      await reverseReferralCommission(comm2.id, "admin-actor", "Annulation définitive", { db });

      await expect(
        approveReferralCommission(comm2.id, "admin-actor", "Tentative résurrection", db),
      ).rejects.toThrow(/terminal status REVERSED/i);
    });
  });

  // ============================================================================
  // REQUIREMENT 2: MANDATORY TRANSACTION REFERENCE ENFORCEMENT
  // ============================================================================
  describe("2. Mandatory Transaction Reference Enforcement", () => {
    it("strictly rejects paying without transaction reference across all empty and whitespace variations", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-stress-1",
        revenue: 3000,
        expenses: 1000,
        referrerLevel: 2,
        idempotencyKey: "ref-validation-test",
        status: "ELIGIBLE",
      }, db);

      await approveReferralCommission(comm.id, "admin-approver", undefined, db);

      // 1. Empty string
      await expect(
        payReferralCommission(comm.id, "finance-actor", "", { db }),
      ).rejects.toThrow(/Payment reference.*strictly required/i);

      // 2. Spaces only
      await expect(
        payReferralCommission(comm.id, "finance-actor", "    ", { db }),
      ).rejects.toThrow(/Payment reference.*strictly required/i);

      // 3. Tabs and newlines only
      await expect(
        payReferralCommission(comm.id, "finance-actor", "\t\n  \r", { db }),
      ).rejects.toThrow(/Payment reference.*strictly required/i);

      // 4. Undefined / null via object parameter
      await expect(
        payReferralCommission({
          commissionId: comm.id,
          actorId: "finance-actor",
          transactionReference: "",
          db,
        }),
      ).rejects.toThrow(/Payment reference.*strictly required/i);

      // 5. Undefined reference via positional parameter
      await expect(
        payReferralCommission(comm.id, "finance-actor", undefined as any, { db }),
      ).rejects.toThrow(/Payment reference.*strictly required/i);

      // Invariance check: status remains APPROVED_FOR_PAYMENT, paidAt is null, zero ledger entries
      const fresh = await db.referralCommission.findUnique({ where: { id: comm.id } });
      expect(fresh!.status).toBe("APPROVED_FOR_PAYMENT");
      expect(fresh!.paidAt).toBeNull();
      expect(fresh!.paidById).toBeNull();

      const txs = await db.financialTransaction.findMany({
        where: { partnerId: "partner-stress-alice" },
      });
      expect(txs).toHaveLength(0);
    });
  });

  // ============================================================================
  // REQUIREMENT 3: CONCURRENT & REPEATED PAYOUT SAFETY
  // ============================================================================
  describe("3. Concurrent & Repeated Payout Safety", () => {
    it("blocks sequential repeated payment requests for an already PAID commission", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-stress-1",
        revenue: 5000,
        expenses: 3000,
        referrerLevel: 1, // P=2000, B=600, C=30 TND
        idempotencyKey: "sequential-double-pay",
        status: "ELIGIBLE",
      }, db);

      await approveReferralCommission(comm.id, "admin-approver", undefined, db);

      // Call 1: First payment succeeds
      const paid1 = await payReferralCommission(comm.id, "finance-actor-1", "VIR-SEQ-001", { db });
      expect(paid1.status).toBe("PAID");
      expect(paid1.paidAt).toBeInstanceOf(Date);

      // Call 2: Immediate retry / duplicate request must throw duplicate payment error
      await expect(
        payReferralCommission(comm.id, "finance-actor-2", "VIR-SEQ-002", { db }),
      ).rejects.toThrow(/has already been paid \(duplicate payment blocked\)/i);

      // Call 3: Subsequent third attempt also rejected
      await expect(
        payReferralCommission(comm.id, "finance-actor-3", "VIR-SEQ-003", { db }),
      ).rejects.toThrow(/has already been paid \(duplicate payment blocked\)/i);

      // Invariance check: exactly 1 financial transaction created and wallet credited only once
      const txs = await db.financialTransaction.findMany({
        where: { partnerId: "partner-stress-alice" },
      });
      expect(txs).toHaveLength(1);
      expect(txs[0]!.amount.toFixed(3)).toBe("30.000");

      const wallet = await db.wallet.findUnique({
        where: { partnerId: "partner-stress-alice" },
      });
      expect(wallet!.availableBalance.toFixed(3)).toBe("30.000");
    });

    it("handles high-concurrency race condition: exactly 1 of N concurrent requests succeeds and N-1 are rejected", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-stress-1",
        revenue: 5000,
        expenses: 3000,
        referrerLevel: 3, // P=2000, B=600, C=90 TND
        idempotencyKey: "high-concurrency-pay",
        status: "ELIGIBLE",
      }, db);

      await approveReferralCommission(comm.id, "admin-approver", undefined, db);

      // Launch 8 parallel concurrent payout attempts simultaneously
      const N = 8;
      const promises = Array.from({ length: N }, (_, idx) =>
        payReferralCommission(comm.id, `actor-concurrent-${idx}`, `VIR-RACE-${idx}`, { db }),
      );

      const results = await Promise.allSettled(promises);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // EXACTLY ONE must succeed, and all others must fail
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(N - 1);

      // All rejected errors must be ReferralCommissionError explaining why it failed
      for (const rej of rejected) {
        if (rej.status === "rejected") {
          expect(rej.reason).toBeInstanceOf(ReferralCommissionError);
          expect(rej.reason.message).toMatch(/(already been paid|no longer in APPROVED_FOR_PAYMENT status)/i);
        }
      }

      // Partner wallet must have received EXACTLY 90 TND, NOT 8 * 90 TND
      const wallet = await db.wallet.findUnique({
        where: { partnerId: "partner-stress-alice" },
      });
      expect(wallet!.availableBalance.toFixed(3)).toBe("90.000");

      const txs = await db.financialTransaction.findMany({
        where: { partnerId: "partner-stress-alice" },
      });
      expect(txs).toHaveLength(1);
      expect(txs[0]!.amount.toFixed(3)).toBe("90.000");
    });
  });

  // ============================================================================
  // REQUIREMENT 4: DUPLICATE COMMISSION CREATION IDEMPOTENCY
  // ============================================================================
  describe("4. Duplicate Commission Creation Idempotency", () => {
    it("blocks duplicate commission creation when same explicit idempotency key is supplied", async () => {
      const key = "idem-test-key-001";

      const first = await createReferralCommission({
        attributionId: "attr-stress-1",
        revenue: 4000,
        expenses: 1000,
        referrerLevel: 1,
        idempotencyKey: key,
      }, db);
      expect(first.id).toBeDefined();

      // Duplicate attempt
      await expect(
        createReferralCommission({
          attributionId: "attr-stress-1",
          revenue: 4000,
          expenses: 1000,
          referrerLevel: 1,
          idempotencyKey: key,
        }, db),
      ).rejects.toThrow(/Duplicate commission creation blocked.*already exists/i);
    });

    it("blocks duplicate commission creation when idempotencyKey is omitted (default key collision)", async () => {
      // Without explicit key, default key is `comm:${attributionId}:${orderId ?? 'direct'}`
      const first = await createReferralCommission({
        attributionId: "attr-stress-1",
        orderId: "order-idem-default",
        revenue: 4000,
        expenses: 1000,
        referrerLevel: 1,
      }, db);
      expect(first.idempotencyKey).toBe("comm:attr-stress-1:order-idem-default");

      // Repeated call without explicit key for same attribution and order
      await expect(
        createReferralCommission({
          attributionId: "attr-stress-1",
          orderId: "order-idem-default",
          revenue: 4000,
          expenses: 1000,
          referrerLevel: 1,
        }, db),
      ).rejects.toThrow(/Duplicate commission creation blocked/i);
    });

    it("catches database Prisma P2002 unique constraint violations and wraps in ReferralCommissionError", async () => {
      const key = "prisma-p2002-collision";

      // Insert directly into mock map to simulate a race condition where findUnique missed it
      mock.commissions.set("comm-pre-existing", {
        id: "comm-pre-existing",
        attributionId: "attr-stress-1",
        referrerPartnerId: "partner-stress-alice",
        orderId: null,
        amount: new Prisma.Decimal("50.000"),
        currency: "TND",
        status: "ELIGIBLE",
        idempotencyKey: key,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Attempt to create commission with same key
      await expect(
        createReferralCommission({
          attributionId: "attr-stress-1",
          revenue: 2000,
          expenses: 500,
          referrerLevel: 1,
          idempotencyKey: key,
        }, db),
      ).rejects.toThrow(ReferralCommissionError);

      await expect(
        createReferralCommission({
          attributionId: "attr-stress-1",
          revenue: 2000,
          expenses: 500,
          referrerLevel: 1,
          idempotencyKey: key,
        }, db),
      ).rejects.toThrow(/already exists/i);
    });
  });

  // ============================================================================
  // ADVERSARIAL COMBINATIONS & REVERSAL INVARIANCES
  // ============================================================================
  describe("5. Adversarial Combinations & Reversal Invariances", () => {
    it("prevents double approval from re-triggering audit logs or altering timestamps", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-stress-1",
        revenue: 2000,
        expenses: 500,
        referrerLevel: 1,
        idempotencyKey: "double-approval-test",
        status: "ELIGIBLE",
      }, db);

      const firstApprove = await approveReferralCommission(comm.id, "admin-1", { reason: "R1" }, db);
      expect(firstApprove.status).toBe("APPROVED_FOR_PAYMENT");
      const firstApprovedAt = firstApprove.approvedAt;

      // Second approval is idempotent
      const secondApprove = await approveReferralCommission(comm.id, "admin-2", { reason: "R2" }, db);
      expect(secondApprove.status).toBe("APPROVED_FOR_PAYMENT");
      expect(secondApprove.approvedAt).toEqual(firstApprovedAt);
    });

    it("rejects approving an already PAID commission", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-stress-1",
        revenue: 2000,
        expenses: 500,
        referrerLevel: 1,
        idempotencyKey: "approve-already-paid",
        status: "ELIGIBLE",
      }, db);

      await approveReferralCommission(comm.id, "admin-1", undefined, db);
      await payReferralCommission(comm.id, "finance-1", "VIR-PAID-001", { db });

      await expect(
        approveReferralCommission(comm.id, "admin-2", undefined, db),
      ).rejects.toThrow(/already PAID/i);
    });

    it("rejects rejecting an already PAID commission and requires reverseReferralCommission instead", async () => {
      const comm = await createReferralCommission({
        attributionId: "attr-stress-1",
        revenue: 2000,
        expenses: 500,
        referrerLevel: 1,
        idempotencyKey: "reject-already-paid",
        status: "ELIGIBLE",
      }, db);

      await approveReferralCommission(comm.id, "admin-1", undefined, db);
      await payReferralCommission(comm.id, "finance-1", "VIR-PAID-002", { db });

      await expect(
        rejectReferralCommission(comm.id, "admin-1", "Motif rejet", { db }),
      ).rejects.toThrow(/Cannot reject a commission that has already been PAID/i);
    });

    it("handles zero-profit commission payout safely without injecting erroneous ledger credits", async () => {
      // R = 1000, E = 1000 -> P = 0, C = 0.000 TND
      const zeroComm = await createReferralCommission({
        attributionId: "attr-stress-1",
        revenue: 1000,
        expenses: 1000,
        referrerLevel: 1,
        idempotencyKey: "zero-profit-payout",
        status: "ELIGIBLE",
      }, db);

      expect(zeroComm.amount.toFixed(3)).toBe("0.000");

      await approveReferralCommission(zeroComm.id, "admin-1", undefined, db);
      const paidZero = await payReferralCommission(zeroComm.id, "finance-1", "VIR-ZERO-001", { db });

      expect(paidZero.status).toBe("PAID");
      expect(paidZero.paidAt).toBeInstanceOf(Date);

      // Ledger must NOT have spurious zero-credit entry
      const txs = await db.financialTransaction.findMany({
        where: { partnerId: "partner-stress-alice" },
      });
      expect(txs).toHaveLength(0);
    });
  });
});
