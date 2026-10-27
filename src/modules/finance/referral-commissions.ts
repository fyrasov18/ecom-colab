import Decimal from "decimal.js";
import { Prisma, PrismaClient, ReferralCommissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { d, roundMoney } from "@/lib/money";
import { recordAudit } from "@/modules/audit/service";
import {
  calculateProfitSharing,
  ReferralLevel,
} from "./referral-math";
import { getAttributableExpenses } from "./expenses";
import { getPartnerReferralLevel } from "@/modules/referrals/levels";
import { createLedgerEntry, recomputeWallet } from "./ledger";

export type DbClient = PrismaClient | Prisma.TransactionClient;

export class ReferralCommissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReferralCommissionError";
  }
}

export interface CreateReferralCommissionInput {
  attributionId: string;
  orderId?: string | null;
  revenue?: Decimal | number | string;
  expenses?: Decimal | number | string;
  period?: string;
  referrerLevel?: ReferralLevel;
  status?: ReferralCommissionStatus;
  idempotencyKey?: string;
  actorId?: string;
}

export interface CommissionCalculationDetails {
  revenue: string;
  expenses: string;
  profit: string;
  adminShare: string;
  remainingPool: string;
  commissionRate: string;
  referralCommission: string;
  balanceAfterCommission: string;
  referrerLevel: ReferralLevel;
  isProfitable: boolean;
  currency: string;
  period?: string | null;
  reversalReason?: string;
  reversedAt?: string;
  reversedById?: string;
  accountingPolicy?: string;
}

export interface ApproveCommissionOptions {
  reason?: string;
  db?: DbClient;
}

export interface PayCommissionOptions {
  db?: DbClient;
}

export interface RejectionOptions {
  db?: DbClient;
}

export interface ReversalOptions {
  db?: DbClient;
}

/** Helper to detect if an argument is a Prisma client */
function isDbClient(arg: unknown): arg is DbClient {
  return (
    typeof arg === "object" &&
    arg !== null &&
    ("referralCommission" in arg || "$transaction" in arg)
  );
}

/**
 * Creates a referral commission for a qualified attribution.
 *
 * Requirements:
 * - Checks attribution exists and is strictly QUALIFIED.
 * - Takes collected revenue R and approved attributable expenses E.
 * - Computes profit P = R - E.
 * - When P <= 0: generates zero commission (C = 0, A = 0, B = 0).
 * - When P > 0: Admin share A = 70% × P, remaining pool B = 30% × P,
 *   rate r in {0.05, 0.10, 0.15}, C = B × r.
 * - Sets status ELIGIBLE (or PENDING_VERIFICATION).
 * - Unique idempotencyKey blocks duplicate commission creation.
 * - Stores full numerical breakdown in calculationDetails.
 */
export async function createReferralCommission(
  arg1: DbClient | CreateReferralCommissionInput | string,
  arg2?: string | DbClient | null,
  arg3?: string | null | Partial<CreateReferralCommissionInput>,
  arg4?: Partial<CreateReferralCommissionInput> | DbClient,
  arg5?: DbClient,
) {
  let db: DbClient = prisma;
  let attributionId: string;
  let orderId: string | null = null;
  let opts: Partial<CreateReferralCommissionInput> = {};

  if (typeof arg1 === "string") {
    // createReferralCommission("attr-123", "order-456", opts, db)
    attributionId = arg1;
    if (typeof arg2 === "string") {
      orderId = arg2;
    }
    if (typeof arg3 === "object" && arg3 !== null && !isDbClient(arg3)) {
      opts = arg3 as Partial<CreateReferralCommissionInput>;
    }
    if (isDbClient(arg4)) {
      db = arg4;
    } else if (isDbClient(arg5)) {
      db = arg5;
    }
  } else if (isDbClient(arg1)) {
    // createReferralCommission(db, "attr-123", "order-456", opts)
    db = arg1;
    attributionId = arg2 as string;
    if (typeof arg3 === "string") {
      orderId = arg3;
    }
    if (typeof arg4 === "object" && arg4 !== null && !isDbClient(arg4)) {
      opts = arg4 as Partial<CreateReferralCommissionInput>;
    }
  } else {
    // createReferralCommission({ attributionId, orderId, ... }, db)
    const input = arg1 as CreateReferralCommissionInput;
    attributionId = input.attributionId;
    orderId = input.orderId ?? null;
    opts = input;
    if (isDbClient(arg2)) {
      db = arg2;
    }
  }

  if (!attributionId || !attributionId.trim()) {
    throw new ReferralCommissionError("Attribution ID is required to create a referral commission.");
  }

  // 1. Verify that attribution exists and is strictly QUALIFIED
  const attribution = await db.referralAttribution.findUnique({
    where: { id: attributionId },
    include: {
      referrerPartner: {
        select: { id: true, status: true, code: true },
      },
    },
  });

  if (!attribution) {
    throw new ReferralCommissionError(`Referral attribution not found: ${attributionId}`);
  }

  if (attribution.status !== "QUALIFIED") {
    throw new ReferralCommissionError(
      `Attribution ${attributionId} is not qualified (status: ${attribution.status}). Commissions require an approved qualifying order.`,
    );
  }

  // 2. Resolve collected revenue R
  let collectedRevenue: Decimal;
  if (opts.revenue !== undefined) {
    collectedRevenue = roundMoney(d(opts.revenue));
  } else if (orderId) {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { unitSellingPrice: true, quantity: true },
    });
    if (order) {
      collectedRevenue = roundMoney(d(order.unitSellingPrice).times(order.quantity));
    } else {
      collectedRevenue = d(0);
    }
  } else {
    collectedRevenue = d(0);
  }

  // 3. Resolve approved attributable expenses E
  let attributableExpenses: Decimal;
  if (opts.expenses !== undefined) {
    attributableExpenses = roundMoney(d(opts.expenses));
  } else if (opts.period) {
    const expResult = await getAttributableExpenses({ period: opts.period }, db);
    attributableExpenses = expResult.total;
  } else {
    attributableExpenses = d(0);
  }

  // 4. Determine referrer's tier level (1, 2, or 3)
  let referrerLevel: ReferralLevel;
  if (opts.referrerLevel !== undefined) {
    referrerLevel = opts.referrerLevel;
  } else {
    const levelState = await getPartnerReferralLevel(attribution.referrerPartnerId, db);
    referrerLevel = levelState.level;
  }

  // 5. Compute profit sharing and referral commission
  const math = calculateProfitSharing({
    revenue: collectedRevenue,
    expenses: attributableExpenses,
    referrerLevel,
  });

  const commissionAmount = math.referralCommission;
  const initialStatus: ReferralCommissionStatus = opts.status ?? "PENDING_VERIFICATION";
  const idempotencyKey = opts.idempotencyKey ?? `comm:${attributionId}:${orderId ?? "direct"}`;

  // 6. Enforce idempotency: prevent duplicate commission creation
  const existing = await db.referralCommission.findUnique({
    where: { idempotencyKey },
  });

  if (existing) {
    throw new ReferralCommissionError(
      `Duplicate commission creation blocked: commission with idempotencyKey "${idempotencyKey}" already exists.`,
    );
  }

  const calculationDetails: CommissionCalculationDetails = {
    revenue: math.revenue.toFixed(3),
    expenses: math.expenses.toFixed(3),
    profit: math.profit.toFixed(3),
    adminShare: math.adminShare.toFixed(3),
    remainingPool: math.remainingPool.toFixed(3),
    commissionRate: math.commissionRate.toString(),
    referralCommission: commissionAmount.toFixed(3),
    balanceAfterCommission: math.balanceAfterCommission.toFixed(3),
    referrerLevel,
    isProfitable: math.isProfitable,
    currency: "TND",
    period: opts.period ?? null,
  };

  try {
    const commission = await db.referralCommission.create({
      data: {
        attributionId,
        referrerPartnerId: attribution.referrerPartnerId,
        orderId,
        amount: new Prisma.Decimal(commissionAmount.toFixed(3)),
        currency: "TND",
        status: initialStatus,
        idempotencyKey,
        calculationDetails: calculationDetails as unknown as Prisma.InputJsonValue,
      },
    });

    await recordAudit(db, {
      actorId: opts.actorId,
      action: "REFERRAL_COMMISSION_CREATED",
      entityType: "ReferralCommission",
      entityId: commission.id,
      after: {
        status: initialStatus,
        amount: commissionAmount.toFixed(3),
        revenue: math.revenue.toFixed(3),
        expenses: math.expenses.toFixed(3),
        profit: math.profit.toFixed(3),
        adminShare: math.adminShare.toFixed(3),
        remainingPool: math.remainingPool.toFixed(3),
        idempotencyKey,
      },
    });

    return commission;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ReferralCommissionError(
        `Duplicate commission creation blocked by database constraint: idempotencyKey "${idempotencyKey}" already exists.`,
      );
    }
    throw err;
  }
}

/**
 * Transitions a commission from PENDING_VERIFICATION to ELIGIBLE.
 */
export async function verifyReferralCommission(
  commissionId: string,
  actorId?: string,
  optsOrDb?: { db?: DbClient } | DbClient,
) {
  let db: DbClient = prisma;
  if (isDbClient(optsOrDb)) {
    db = optsOrDb;
  } else if (optsOrDb?.db) {
    db = optsOrDb.db;
  }

  const comm = await db.referralCommission.findUnique({
    where: { id: commissionId },
  });

  if (!comm) {
    throw new ReferralCommissionError(`Commission not found: ${commissionId}`);
  }

  if (comm.status !== "PENDING_VERIFICATION") {
    throw new ReferralCommissionError(
      `Cannot verify commission: status is ${comm.status}, expected PENDING_VERIFICATION.`,
    );
  }

  const updated = await db.referralCommission.update({
    where: { id: commissionId },
    data: { status: "ELIGIBLE" },
  });

  await recordAudit(db, {
    actorId,
    action: "REFERRAL_COMMISSION_VERIFIED",
    entityType: "ReferralCommission",
    entityId: commissionId,
    before: { status: comm.status },
    after: { status: "ELIGIBLE" },
  });

  return updated;
}

/**
 * Approves a referral commission for payment.
 *
 * Requirements:
 * - Verifies status is ELIGIBLE or PENDING_VERIFICATION.
 * - Atomically updates status to APPROVED_FOR_PAYMENT.
 * - Records approvedAt and approvedById.
 * - DOES NOT mark as PAID (explicit separation of approval and payment).
 */
export async function approveReferralCommission(
  commissionId: string,
  actorId: string,
  optsOrReason?: string | ApproveCommissionOptions | DbClient,
  maybeDb?: DbClient,
) {
  let reason: string | undefined;
  let db: DbClient = prisma;

  if (typeof optsOrReason === "string") {
    reason = optsOrReason;
    if (isDbClient(maybeDb)) db = maybeDb;
  } else if (isDbClient(optsOrReason)) {
    db = optsOrReason;
  } else if (typeof optsOrReason === "object" && optsOrReason !== null) {
    reason = optsOrReason.reason;
    if (optsOrReason.db) db = optsOrReason.db;
  }

  const comm = await db.referralCommission.findUnique({
    where: { id: commissionId },
  });

  if (!comm) {
    throw new ReferralCommissionError(`Commission not found: ${commissionId}`);
  }

  if (comm.status === "PAID") {
    throw new ReferralCommissionError(
      `Cannot approve commission: already PAID. Status is ${comm.status}.`,
    );
  }

  if (comm.status === "REJECTED" || comm.status === "REVERSED") {
    throw new ReferralCommissionError(
      `Cannot approve commission: commission is in terminal status ${comm.status}.`,
    );
  }

  if (comm.status === "APPROVED_FOR_PAYMENT") {
    // Idempotent: already approved
    return comm;
  }

  if (comm.status !== "ELIGIBLE" && comm.status !== "PENDING_VERIFICATION") {
    throw new ReferralCommissionError(
      `Cannot approve commission: status must be ELIGIBLE or PENDING_VERIFICATION (current: ${comm.status}).`,
    );
  }

  const approvedAt = new Date();
  const updateResult = await db.referralCommission.updateMany({
    where: {
      id: commissionId,
      status: { in: ["PENDING_VERIFICATION", "ELIGIBLE"] },
    },
    data: {
      status: "APPROVED_FOR_PAYMENT",
      approvedAt,
      approvedById: actorId,
    },
  });

  if (updateResult.count === 0) {
    throw new ReferralCommissionError(
      `Concurrent modification: commission ${commissionId} could not be approved.`,
    );
  }

  const updated = await db.referralCommission.findUniqueOrThrow({
    where: { id: commissionId },
  });

  await recordAudit(db, {
    actorId,
    action: "REFERRAL_COMMISSION_APPROVED",
    entityType: "ReferralCommission",
    entityId: commissionId,
    before: { status: comm.status },
    after: {
      status: "APPROVED_FOR_PAYMENT",
      approvedAt: approvedAt.toISOString(),
      approvedById: actorId,
      reason,
    },
  });

  return updated;
}

/**
 * Pays an approved referral commission.
 *
 * Requirements:
 * - Verifies status is strictly APPROVED_FOR_PAYMENT.
 * - Strictly requires non-empty recorded payment reference (transactionReference).
 * - Atomically updates status to PAID, records paidAt, paidById.
 * - Updates financial records and wallet cache via ledger engine.
 * - Blocks concurrent and repeated payment requests.
 */
export async function payReferralCommission(
  arg1: string | { commissionId: string; actorId: string; transactionReference: string; db?: DbClient },
  arg2?: string | DbClient,
  arg3?: string,
  arg4?: PayCommissionOptions | DbClient,
) {
  let commissionId: string;
  let actorId: string;
  let transactionReference: string;
  let db: DbClient = prisma;

  if (typeof arg1 === "object" && arg1 !== null) {
    commissionId = arg1.commissionId;
    actorId = arg1.actorId;
    transactionReference = arg1.transactionReference;
    if (arg1.db) db = arg1.db;
    else if (isDbClient(arg2)) db = arg2;
  } else {
    commissionId = arg1;
    actorId = arg2 as string;
    transactionReference = arg3 as string;
    if (isDbClient(arg4)) {
      db = arg4;
    } else if (arg4?.db) {
      db = arg4.db;
    }
  }

  if (!transactionReference || !transactionReference.trim()) {
    throw new ReferralCommissionError(
      "Payment reference (transactionReference) is strictly required to pay commission.",
    );
  }

  const trimmedReference = transactionReference.trim();

  const comm = await db.referralCommission.findUnique({
    where: { id: commissionId },
  });

  if (!comm) {
    throw new ReferralCommissionError(`Commission not found: ${commissionId}`);
  }

  if (comm.status === "PAID") {
    throw new ReferralCommissionError(
      `Commission ${commissionId} has already been paid (duplicate payment blocked).`,
    );
  }

  if (comm.status !== "APPROVED_FOR_PAYMENT") {
    throw new ReferralCommissionError(
      `Cannot pay commission: status must be APPROVED_FOR_PAYMENT (current status: ${comm.status}). Explicit approval is required before payment.`,
    );
  }

  const paidAt = new Date();

  // Atomic state transition: ensures only one concurrent execution can transition to PAID
  const updateResult = await db.referralCommission.updateMany({
    where: {
      id: commissionId,
      status: "APPROVED_FOR_PAYMENT",
    },
    data: {
      status: "PAID",
      paidAt,
      paidById: actorId,
    },
  });

  if (updateResult.count === 0) {
    const fresh = await db.referralCommission.findUnique({ where: { id: commissionId } });
    if (fresh?.status === "PAID") {
      throw new ReferralCommissionError(
        `Commission ${commissionId} has already been paid (duplicate payment blocked).`,
      );
    }
    throw new ReferralCommissionError(
      `Concurrent payment blocked: commission ${commissionId} is no longer in APPROVED_FOR_PAYMENT status.`,
    );
  }

  // Update financial records and wallet
  const commissionAmount = roundMoney(d(comm.amount));
  if (commissionAmount.greaterThan(0)) {
    await createLedgerEntry(db, {
      partnerId: comm.referrerPartnerId,
      type: "PARTNER_EARNING",
      amount: commissionAmount,
      status: "AVAILABLE",
      idempotencyKey: `payout:commission:${commissionId}`,
      description: `Commission de parrainage (Réf: ${trimmedReference})`,
      orderId: comm.orderId,
      createdById: actorId,
    });

    await recomputeWallet(db, comm.referrerPartnerId);
  }

  await recordAudit(db, {
    actorId,
    action: "REFERRAL_COMMISSION_PAID",
    entityType: "ReferralCommission",
    entityId: commissionId,
    before: { status: "APPROVED_FOR_PAYMENT" },
    after: {
      status: "PAID",
      paidAt: paidAt.toISOString(),
      paidById: actorId,
      transactionReference: trimmedReference,
      amount: commissionAmount.toFixed(3),
    },
  });

  return await db.referralCommission.findUniqueOrThrow({
    where: { id: commissionId },
  });
}

/**
 * Rejects a referral commission with a mandatory non-empty reason.
 *
 * Requirements:
 * - Requires non-empty rejection reason.
 * - Transitions status to REJECTED.
 * - Cannot reject a commission that is already PAID (must use reverse).
 */
export async function rejectReferralCommission(
  commissionId: string,
  actorId: string,
  reason: string,
  opts?: RejectionOptions | DbClient,
) {
  let db: DbClient = prisma;
  if (isDbClient(opts)) {
    db = opts;
  } else if (opts?.db) {
    db = opts.db;
  }

  if (!reason || !reason.trim()) {
    throw new ReferralCommissionError("Rejection reason is mandatory to reject a commission.");
  }

  const trimmedReason = reason.trim();

  const comm = await db.referralCommission.findUnique({
    where: { id: commissionId },
  });

  if (!comm) {
    throw new ReferralCommissionError(`Commission not found: ${commissionId}`);
  }

  if (comm.status === "PAID") {
    throw new ReferralCommissionError(
      "Cannot reject a commission that has already been PAID. Use reverseReferralCommission instead.",
    );
  }

  if (comm.status === "REVERSED") {
    throw new ReferralCommissionError("Cannot reject an already REVERSED commission.");
  }

  if (comm.status === "REJECTED") {
    // Idempotent
    return comm;
  }

  const updated = await db.referralCommission.update({
    where: { id: commissionId },
    data: {
      status: "REJECTED",
      rejectionReason: trimmedReason,
    },
  });

  await recordAudit(db, {
    actorId,
    action: "REFERRAL_COMMISSION_REJECTED",
    entityType: "ReferralCommission",
    entityId: commissionId,
    before: { status: comm.status },
    after: {
      status: "REJECTED",
      rejectionReason: trimmedReason,
    },
  });

  return updated;
}

/**
 * Reverses a referral commission with a documented accounting policy and mandatory reason.
 *
 * Requirements:
 * - Requires non-empty reversal reason.
 * - Transitions status to REVERSED.
 * - Follows documented accounting policy:
 *   If the commission was previously PAID and settled, a compensating adjustment
 *   (type: ADJUSTMENT) is recorded in FinancialTransaction and the partner's wallet
 *   is updated. Never creates untracked balance deductions.
 */
export async function reverseReferralCommission(
  commissionId: string,
  actorId: string,
  reason: string,
  opts?: ReversalOptions | DbClient,
) {
  let db: DbClient = prisma;
  if (isDbClient(opts)) {
    db = opts;
  } else if (opts?.db) {
    db = opts.db;
  }

  if (!reason || !reason.trim()) {
    throw new ReferralCommissionError("Reversal reason is mandatory to reverse a commission.");
  }

  const trimmedReason = reason.trim();

  const comm = await db.referralCommission.findUnique({
    where: { id: commissionId },
  });

  if (!comm) {
    throw new ReferralCommissionError(`Commission not found: ${commissionId}`);
  }

  if (comm.status === "REVERSED") {
    // Idempotent
    return comm;
  }

  // Documented accounting policy:
  // If the commission was previously PAID and non-zero, post a compensating negative adjustment
  const commissionAmount = roundMoney(d(comm.amount));
  if (comm.status === "PAID" && commissionAmount.greaterThan(0)) {
    await createLedgerEntry(db, {
      partnerId: comm.referrerPartnerId,
      type: "ADJUSTMENT",
      amount: commissionAmount.negated(),
      status: "AVAILABLE",
      idempotencyKey: `reversal:commission:${commissionId}`,
      description: `Annulation commission de parrainage: ${trimmedReason}`,
      orderId: comm.orderId,
      createdById: actorId,
    });

    await recomputeWallet(db, comm.referrerPartnerId);
  }

  const existingDetails = (comm.calculationDetails as Record<string, unknown>) ?? {};
  const updatedDetails = {
    ...existingDetails,
    reversalReason: trimmedReason,
    reversedAt: new Date().toISOString(),
    reversedById: actorId,
    accountingPolicy:
      comm.status === "PAID"
        ? "COMPENSATING_ADJUSTMENT_POSTED_TO_LEDGER"
        : "ZERO_FUNDS_MOVED_UNPAID_STATUS_REVERSED",
  };

  const updated = await db.referralCommission.update({
    where: { id: commissionId },
    data: {
      status: "REVERSED",
      rejectionReason: `Reversal: ${trimmedReason}`,
      calculationDetails: updatedDetails as Prisma.InputJsonValue,
    },
  });

  await recordAudit(db, {
    actorId,
    action: "REFERRAL_COMMISSION_REVERSED",
    entityType: "ReferralCommission",
    entityId: commissionId,
    before: { status: comm.status },
    after: {
      status: "REVERSED",
      reversalReason: trimmedReason,
      compensatedAmount: comm.status === "PAID" ? commissionAmount.negated().toFixed(3) : "0.000",
    },
  });

  return updated;
}

/** Retrieves a commission by ID */
export async function getReferralCommissionById(id: string, db: DbClient = prisma) {
  return await db.referralCommission.findUnique({
    where: { id },
    include: {
      attribution: true,
      referrerPartner: true,
    },
  });
}

/** Lists referral commissions with filtering */
export async function listReferralCommissions(
  filters?: {
    referrerPartnerId?: string;
    attributionId?: string;
    orderId?: string;
    status?: ReferralCommissionStatus;
  },
  db: DbClient = prisma,
) {
  const where: Prisma.ReferralCommissionWhereInput = {};

  if (filters?.referrerPartnerId) {
    where.referrerPartnerId = filters.referrerPartnerId;
  }
  if (filters?.attributionId) {
    where.attributionId = filters.attributionId;
  }
  if (filters?.orderId) {
    where.orderId = filters.orderId;
  }
  if (filters?.status) {
    where.status = filters.status;
  }

  return await db.referralCommission.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      attribution: true,
      referrerPartner: {
        select: { id: true, displayName: true, code: true },
      },
    },
  });
}
