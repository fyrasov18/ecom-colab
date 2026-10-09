import Decimal from "decimal.js";
import { Prisma, PrismaClient, ExpenseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { d, roundMoney } from "@/lib/money";
import { recordAudit } from "@/modules/audit/service";

export type DbClient = PrismaClient | Prisma.TransactionClient;

export class ExpenseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpenseError";
  }
}

export interface CreateExpenseInput {
  title: string;
  category: string;
  amount: Decimal | number | string;
  currency?: string;
  period?: string;
  notes?: string;
  createdById?: string;
}

export interface UpdateExpenseInput {
  title?: string;
  category?: string;
  amount?: Decimal | number | string;
  period?: string;
  notes?: string;
}

export interface ListExpensesFilters {
  status?: ExpenseStatus;
  period?: string;
  category?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface AttributableExpensesQuery {
  period?: string;
  expenseIds?: string[];
  startDate?: Date;
  endDate?: Date;
}

export interface AttributableExpensesResult {
  total: Decimal;
  expenses: Array<{
    id: string;
    title: string;
    category: string;
    amount: Prisma.Decimal;
    currency: string;
    status: ExpenseStatus;
    period: string | null;
    approvedAt: Date | null;
    approvedById: string | null;
    createdAt: Date;
  }>;
  count: number;
  currency: string;
}

function isDbClient(arg: unknown): arg is DbClient {
  return (
    typeof arg === "object" &&
    arg !== null &&
    ("expense" in arg || "$transaction" in arg)
  );
}

/**
 * Creates a new business expense in PENDING status.
 * Validates non-empty title/category and positive amount with 3-decimal precision.
 */
export async function createExpense(
  input: CreateExpenseInput,
  db: DbClient = prisma,
) {
  if (!input.title || !input.title.trim()) {
    throw new ExpenseError("Expense title is required.");
  }
  if (!input.category || !input.category.trim()) {
    throw new ExpenseError("Expense category is required.");
  }

  const amountDecimal = roundMoney(d(input.amount));
  if (amountDecimal.lessThanOrEqualTo(0)) {
    throw new ExpenseError("Expense amount must be positive.");
  }

  const currency = input.currency ?? "TND";

  const expense = await db.expense.create({
    data: {
      title: input.title.trim(),
      category: input.category.trim(),
      amount: new Prisma.Decimal(amountDecimal.toFixed(3)),
      currency,
      status: "PENDING",
      period: input.period?.trim() ?? null,
      notes: input.notes?.trim() ?? null,
      createdById: input.createdById ?? null,
    },
  });

  await recordAudit(db, {
    actorId: input.createdById,
    action: "EXPENSE_CREATED",
    entityType: "Expense",
    entityId: expense.id,
    after: {
      title: expense.title,
      category: expense.category,
      amount: amountDecimal.toFixed(3),
      currency,
      status: "PENDING",
      period: expense.period,
    },
  });

  return expense;
}

/**
 * Approves a pending business expense.
 * Only APPROVED expenses may be deducted as attributable business expenses E.
 */
export async function approveExpense(
  expenseId: string,
  approvedByIdOrDb?: string | DbClient,
  maybeDb?: DbClient,
) {
  let approvedById: string | undefined;
  let db: DbClient = prisma;

  if (isDbClient(approvedByIdOrDb)) {
    db = approvedByIdOrDb;
  } else {
    approvedById = approvedByIdOrDb;
    if (isDbClient(maybeDb)) db = maybeDb;
  }

  const expense = await db.expense.findUnique({
    where: { id: expenseId },
  });

  if (!expense) {
    throw new ExpenseError(`Expense not found: ${expenseId}`);
  }

  if (expense.status === "APPROVED") {
    // Idempotent: already approved
    return expense;
  }

  if (expense.status === "REJECTED") {
    throw new ExpenseError(`Cannot approve an expense that has been rejected: ${expenseId}`);
  }

  const approvedAt = new Date();
  const updated = await db.expense.update({
    where: { id: expenseId },
    data: {
      status: "APPROVED",
      approvedAt,
      approvedById: approvedById ?? null,
    },
  });

  await recordAudit(db, {
    actorId: approvedById,
    action: "EXPENSE_APPROVED",
    entityType: "Expense",
    entityId: expenseId,
    before: { status: expense.status },
    after: {
      status: "APPROVED",
      approvedAt: approvedAt.toISOString(),
      approvedById,
    },
  });

  return updated;
}

/**
 * Rejects a business expense with an optional or documented reason.
 * Rejected expenses are strictly excluded from attributable expenses E.
 */
export async function rejectExpense(
  expenseId: string,
  rejectedById?: string,
  reasonOrDb?: string | DbClient,
  maybeDb?: DbClient,
) {
  let reason: string | undefined;
  let db: DbClient = prisma;

  if (isDbClient(reasonOrDb)) {
    db = reasonOrDb;
  } else {
    reason = reasonOrDb;
    if (isDbClient(maybeDb)) db = maybeDb;
  }

  const expense = await db.expense.findUnique({
    where: { id: expenseId },
  });

  if (!expense) {
    throw new ExpenseError(`Expense not found: ${expenseId}`);
  }

  const rejectionNote = reason?.trim();
  const notes = rejectionNote
    ? expense.notes
      ? `${expense.notes}\n[Rejet]: ${rejectionNote}`
      : `[Rejet]: ${rejectionNote}`
    : expense.notes;

  const updated = await db.expense.update({
    where: { id: expenseId },
    data: {
      status: "REJECTED",
      notes,
    },
  });

  await recordAudit(db, {
    actorId: rejectedById,
    action: "EXPENSE_REJECTED",
    entityType: "Expense",
    entityId: expenseId,
    before: { status: expense.status },
    after: {
      status: "REJECTED",
      reason: rejectionNote,
    },
  });

  return updated;
}

/**
 * Pure summation helper: sums only APPROVED expenses without double-counting.
 * Enforces Decimal.js precision with 3 decimal places.
 */
export function sumApprovedExpenses(
  expenses: Array<{
    id?: string;
    status: ExpenseStatus | string;
    amount: Decimal | number | string | Prisma.Decimal;
  }>,
): Decimal {
  const seenIds = new Set<string>();
  let total = d(0);

  for (const item of expenses) {
    if (item.id) {
      if (seenIds.has(item.id)) {
        continue; // Deduplicate by unique ID to prevent double-counting
      }
      seenIds.add(item.id);
    }

    if (item.status === "APPROVED") {
      total = total.plus(d(item.amount));
    }
  }

  return roundMoney(total);
}

/**
 * Queries attributable business expenses E for a period or scope.
 *
 * Requirements:
 * - Strictly deducts only APPROVED expenses for the period/scope.
 * - Pending or rejected expenses are completely excluded.
 * - Enforces that no expense is counted twice (unique ID deduplication).
 * - Exact Decimal.js summation with 3 decimal places.
 */
export async function getAttributableExpenses(
  queryOrDb?: AttributableExpensesQuery | DbClient,
  maybeDb?: DbClient,
): Promise<AttributableExpensesResult> {
  let query: AttributableExpensesQuery | undefined;
  let db: DbClient = prisma;

  if (isDbClient(queryOrDb)) {
    db = queryOrDb;
  } else {
    query = queryOrDb;
    if (isDbClient(maybeDb)) db = maybeDb;
  }

  const dedupedIds = query?.expenseIds ? Array.from(new Set(query.expenseIds)) : undefined;

  // If specific IDs were requested but the list was empty, return 0 immediately
  if (query?.expenseIds && dedupedIds?.length === 0) {
    return {
      total: d(0),
      expenses: [],
      count: 0,
      currency: "TND",
    };
  }

  const where: Prisma.ExpenseWhereInput = {
    status: "APPROVED", // Strictly only APPROVED expenses
  };

  if (query?.period) {
    where.period = query.period;
  }

  if (dedupedIds && dedupedIds.length > 0) {
    where.id = { in: dedupedIds };
  }

  if (query?.startDate || query?.endDate) {
    where.createdAt = {};
    if (query.startDate) where.createdAt.gte = query.startDate;
    if (query.endDate) where.createdAt.lte = query.endDate;
  }

  const rows = await db.expense.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });

  // Enforce in-memory deduplication safeguard
  const seen = new Set<string>();
  const uniqueExpenses: typeof rows = [];
  let sum = d(0);

  for (const exp of rows) {
    if (seen.has(exp.id)) {
      continue;
    }
    seen.add(exp.id);
    uniqueExpenses.push(exp);
    sum = sum.plus(d(exp.amount));
  }

  const total = roundMoney(sum);

  return {
    total,
    expenses: uniqueExpenses,
    count: uniqueExpenses.length,
    currency: uniqueExpenses[0]?.currency ?? "TND",
  };
}

/** Retrieves an expense by its unique ID */
export async function getExpenseById(id: string, db: DbClient = prisma) {
  return await db.expense.findUnique({
    where: { id },
  });
}

/** Lists expenses with optional filters and sorting */
export async function listExpenses(
  filters?: ListExpensesFilters,
  db: DbClient = prisma,
) {
  const where: Prisma.ExpenseWhereInput = {};

  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.period) {
    where.period = filters.period;
  }
  if (filters?.category) {
    where.category = filters.category;
  }
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  return await db.expense.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

/** Updates an expense (only if still PENDING) */
export async function updateExpense(
  id: string,
  input: UpdateExpenseInput,
  actorId?: string,
  db: DbClient = prisma,
) {
  const existing = await db.expense.findUnique({ where: { id } });
  if (!existing) {
    throw new ExpenseError(`Expense not found: ${id}`);
  }
  if (existing.status !== "PENDING") {
    throw new ExpenseError(`Cannot update an expense in status: ${existing.status}`);
  }

  const data: Prisma.ExpenseUpdateInput = {};
  if (input.title !== undefined) {
    if (!input.title.trim()) throw new ExpenseError("Expense title cannot be empty.");
    data.title = input.title.trim();
  }
  if (input.category !== undefined) {
    if (!input.category.trim()) throw new ExpenseError("Expense category cannot be empty.");
    data.category = input.category.trim();
  }
  if (input.amount !== undefined) {
    const amt = roundMoney(d(input.amount));
    if (amt.lessThanOrEqualTo(0)) throw new ExpenseError("Expense amount must be positive.");
    data.amount = new Prisma.Decimal(amt.toFixed(3));
  }
  if (input.period !== undefined) {
    data.period = input.period.trim() || null;
  }
  if (input.notes !== undefined) {
    data.notes = input.notes.trim() || null;
  }

  const updated = await db.expense.update({
    where: { id },
    data,
  });

  await recordAudit(db, {
    actorId,
    action: "EXPENSE_UPDATED",
    entityType: "Expense",
    entityId: id,
    before: {
      title: existing.title,
      amount: existing.amount.toString(),
      category: existing.category,
    },
    after: {
      title: updated.title,
      amount: updated.amount.toString(),
      category: updated.category,
    },
  });

  return updated;
}

/** Deletes an expense (only allowed if PENDING or REJECTED) */
export async function deleteExpense(
  id: string,
  actorId?: string,
  db: DbClient = prisma,
) {
  const existing = await db.expense.findUnique({ where: { id } });
  if (!existing) {
    throw new ExpenseError(`Expense not found: ${id}`);
  }
  if (existing.status === "APPROVED") {
    throw new ExpenseError("Cannot delete an APPROVED expense. Reject or reverse it first.");
  }

  await db.expense.delete({ where: { id } });

  await recordAudit(db, {
    actorId,
    action: "EXPENSE_DELETED",
    entityType: "Expense",
    entityId: id,
    before: {
      title: existing.title,
      amount: existing.amount.toString(),
      status: existing.status,
    },
  });

  return { success: true, id };
}
