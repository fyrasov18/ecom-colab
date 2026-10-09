# Milestone 4 Review & Adversarial Challenge Report: Expenses Management

**Reviewer**: Reviewer 1 (Expenses Reviewer & Critic — `teamwork_preview_reviewer_m4_1`)  
**Target Milestone**: Milestone 4 (`src/modules/finance/expenses.ts`)  
**Date**: 2026-10-09  
**Verdict**: **APPROVE**  

---

## 1. Observation

### 1.1 Source Code Inspection (`src/modules/finance/expenses.ts`)
- **CRUD Operations**:
  - `createExpense` (lines 79–126): Validates non-empty `title` and `category` (lines 83–88), parses and rounds amount using `roundMoney(d(input.amount))` (line 90), validates `amountDecimal.lessThanOrEqualTo(0)` (line 91), persists to database with `status: "PENDING"`, default currency `"TND"`, and records audit event `"EXPENSE_CREATED"` via `recordAudit(db, ...)` (lines 110–123).
  - `getExpenseById` (lines 360–365): Executes `db.expense.findUnique({ where: { id } })`.
  - `listExpenses` (lines 368–393): Supports filtering by `status`, `period`, `category`, and date ranges (`startDate`, `endDate`) with `orderBy: { createdAt: "desc" }`.
  - `updateExpense` (lines 396–454): Enforces that only expenses in `status === "PENDING"` can be updated (line 406); validates positive amounts with 3-decimal rounding; records audit event `"EXPENSE_UPDATED"` (lines 436–452).
  - `deleteExpense` (lines 457–485): Strictly blocks deletion of approved expenses (`if (existing.status === "APPROVED") throw new ExpenseError("Cannot delete an APPROVED expense. Reject or reverse it first.")`, line 466); records audit event `"EXPENSE_DELETED"`.

- **Approval Workflow**:
  - `approveExpense` (lines 132–188):
    - Retrieves expense and throws `ExpenseError` if not found (lines 151–153).
    - Idempotent: If `status === "APPROVED"`, immediately returns the existing record (lines 155–158).
    - Rejection guard: Explicitly throws if already rejected: `if (expense.status === "REJECTED") throw new ExpenseError(...)` (lines 160–162).
    - Sets `status: "APPROVED"`, `approvedAt: new Date()`, and `approvedById` (lines 168–171).
    - Logs `"EXPENSE_APPROVED"` in the append-only audit log (lines 174–185).
  - `rejectExpense` (lines 194–246):
    - Retrieves expense, preserves and appends rejection reason into `notes` (`[Rejet]: <reason>`, lines 218–223).
    - Transitions `status: "REJECTED"`, updates `db.expense.update`, and logs `"EXPENSE_REJECTED"` audit entry.

- **Attributable Expenses Filtering (`getAttributableExpenses`)**:
  - Lines 313–315:
    ```typescript
    const where: Prisma.ExpenseWhereInput = {
      status: "APPROVED", // Strictly only APPROVED expenses
    };
    ```
  - Any pending or rejected expenses are excluded at the SQL query level.
  - Query parameters (`period`, `startDate`, `endDate`, `expenseIds`) cannot override this constraint.

- **Deduplication Safeguards**:
  - Layer 1 (Input array): `const dedupedIds = query?.expenseIds ? Array.from(new Set(query.expenseIds)) : undefined;` (line 301).
  - Layer 2 (Database primary key): SQL query filters `id: { in: dedupedIds }` against primary key `id`.
  - Layer 3 (In-memory defense in depth, lines 337–349):
    ```typescript
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
    ```
  - Standalone helper `sumApprovedExpenses` (lines 252–276): Similarly tracks `seenIds = new Set<string>()` and filters `item.status === "APPROVED"` before accumulating.

- **Decimal.js Precision & Rounding**:
  - `src/lib/money.ts` lines 7–18: `Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP })` and `roundMoney(value)` uses `toDecimalPlaces(3, Decimal.ROUND_HALF_UP)`.
  - All arithmetic operations in `expenses.ts` use `sum.plus(d(exp.amount))` and finalize via `roundMoney(sum)`.
  - Stored amounts use `new Prisma.Decimal(amountDecimal.toFixed(3))`, matching PostgreSQL column `@db.Decimal(12, 3)`.
  - Zero native floating-point math operators (`+`, `-`, `*`, `/`) are applied to financial amounts.

### 1.2 Test Suite Verification (`tests/referrals-commissions-lifecycle.test.ts`)
- Section 1 (lines 370–499) contains unit tests validating:
  - Expense creation with 3 decimal places (`450.750` TND) and `PENDING` initial status.
  - Rejection of invalid titles, categories, and zero/negative amounts (`amount: 0`, `amount: -50`).
  - Approval recording `approvedAt` and `approvedById`.
  - Rejection recording `notes` containing the rejection reason.
  - Strict exclusion of `PENDING` (500 TND) and `REJECTED` (800 TND) expenses from attributable queries, summing strictly the `APPROVED` expense (3000.000 TND).
  - Deduplication across duplicate IDs `[exp1, exp1, exp2, exp2, exp1]` yielding exactly `100.000` TND (25.500 + 74.500).
  - `sumApprovedExpenses` deduplicating repeated items and ignoring non-approved statuses.

---

## 2. Logic Chain

1. **Integrity Verification**:
   - Source code analysis confirmed no hardcoded values, dummy facades, or shortcuts.
   - Database operations execute genuine Prisma queries against `db.expense`.
   - `getAttributableExpenses` dynamically queries records, applies in-memory sets, and calculates sums via Decimal.js.
   - Result: **Zero integrity violations detected.**

2. **Deductibility & Exclusion Invariant**:
   - Requirement R4 states: "All approved business expenses are deducted before profit sharing. Do not count any expense twice."
   - In `getAttributableExpenses`, line 314 hardcodes `status: "APPROVED"` into the Prisma query `where` clause.
   - In `sumApprovedExpenses`, line 270 requires `if (item.status === "APPROVED")`.
   - Because no execution path permits `PENDING` or `REJECTED` expenses to enter the summation, non-approved expenses can never reduce the profit pool or distort referral commissions.

3. **Deduplication Invariant**:
   - Deduplication is implemented with triple redundancy:
     1. Pre-query conversion of `expenseIds` to a JavaScript `Set`.
     2. Database index query on primary key `id`.
     3. Post-query iteration tracking `seen.has(exp.id)`.
   - It is impossible for any expense record to be summed more than once, even if upstream callers pass duplicate ID arrays or multi-table joins produce duplicated rows.

4. **Monetary Precision Invariant**:
   - Requirement R4 requires exact decimal math without floating-point errors.
   - All amounts are routed through `Decimal.js` configured with 28 digits of precision and `ROUND_HALF_UP` to 3 decimal places (millimes).
   - Numerical values stored in Prisma use `Prisma.Decimal(amountDecimal.toFixed(3))`.
   - Zero floating-point arithmetic is present.

5. **Approval Workflow Invariant**:
   - Expenses begin in `PENDING`.
   - Transitions to `APPROVED` are idempotent and forbid approving previously `REJECTED` expenses.
   - Transitions to `REJECTED` capture audit notes.
   - Approved expenses cannot be deleted without first rejecting/reversing them.

---

## 3. Adversarial Challenges & Findings

### [Minor] Finding 1: Parameter Overload Inconsistency in `updateExpense` and `deleteExpense`
- **Observation**:
  `approveExpense`, `rejectExpense`, and `getAttributableExpenses` inspect arguments with `isDbClient()` to allow flexible invocation (e.g., passing `db` as the second argument: `approveExpense(id, db)`).
  In contrast, `updateExpense` (line 396) and `deleteExpense` (line 457) have signatures `(id, input, actorId?, db = prisma)` and `(id, actorId?, db = prisma)`.
- **Attack Scenario**:
  If a caller calls `deleteExpense(id, db)` omitting `actorId`, the Prisma client instance is assigned to `actorId` and `db` defaults to the global `prisma` singleton.
- **Blast Radius**: Low. In internal services, passing `actorId` or using the global client avoids this.
- **Mitigation Suggestion**: Add `isDbClient(actorId)` check in `updateExpense` and `deleteExpense` consistent with `approveExpense`.

### [Minor] Finding 2: Multi-Currency Expense Aggregation Assumption
- **Observation**:
  `getAttributableExpenses` sums `sum = sum.plus(d(exp.amount))` across all matching expenses, then sets `currency: uniqueExpenses[0]?.currency ?? "TND"` (line 356).
- **Attack Scenario**:
  If expenses are entered with differing currencies (e.g. 100 EUR and 100 TND), they would be summed numerically without currency conversion or validation.
- **Blast Radius**: Low. The application operates in a single currency (TND / DT) per specifications.
- **Mitigation Suggestion**: Add `currency?: string` filter in `AttributableExpensesQuery` (defaulting to `"TND"`) and enforce `where.currency = query.currency ?? "TND"`.

### [Minor] Finding 3: Concurrency Guard on Deletion
- **Observation**:
  In `deleteExpense`, the status is checked via `existing = await db.expense.findUnique(...)` before executing `db.expense.delete(...)`.
- **Attack Scenario**:
  A concurrent approval occurring between the status read and the delete command could delete an approved expense.
- **Blast Radius**: Low. Admin actions are low-concurrency.
- **Mitigation Suggestion**: Perform atomic conditional delete: `db.expense.deleteMany({ where: { id, status: { not: "APPROVED" } } })`.

### [Minor] Finding 4: Coverage Gap on `updateExpense` and `deleteExpense`
- **Observation**:
  While `createExpense`, `approveExpense`, `rejectExpense`, and `getAttributableExpenses` have direct unit tests in `tests/referrals-commissions-lifecycle.test.ts`, `updateExpense` and `deleteExpense` do not have dedicated test cases in that file.
- **Recommendation**: Add unit test cases for `updateExpense` (updating pending, blocking update on approved) and `deleteExpense` (deleting pending/rejected, blocking deletion of approved).

---

## 4. Caveats

- **Sandbox Execution Limit**: Vitest execution via `run_command` was denied by user permission constraints. Verification was performed via rigorous static analysis and tracing against the codebase and test suite.
- **Scope Limit**: Review scope is strictly limited to Milestone 4 Expenses (`src/modules/finance/expenses.ts`). Front-end UI components and API route middleware belong to Milestone 5.

---

## 5. Conclusion

**Verdict**: **APPROVE**

The implementation in `src/modules/finance/expenses.ts` is robust, mathematically precise, and fully compliant with Milestone 4 requirements:
1. CRUD operations and approval workflows are fully implemented with audit logging.
2. `getAttributableExpenses` strictly limits deductions to `APPROVED` expenses.
3. Triple-layer deduplication guarantees no expense can be double-counted.
4. Decimal.js configuration guarantees 3-decimal precision with `ROUND_HALF_UP`.
5. No integrity violations or cheating patterns exist.

---

## 6. Verification Method

To independently verify the implementation:
1. Inspect files:
   - `src/modules/finance/expenses.ts`
   - `src/lib/money.ts`
   - `prisma/schema.prisma`
   - `tests/referrals-commissions-lifecycle.test.ts`
2. Run Vitest suite:
   ```bash
   npx vitest run tests/referrals-commissions-lifecycle.test.ts
   ```
3. Type-check:
   ```bash
   npx tsc --noEmit
   ```
4. Invalidation conditions:
   - Any non-approved expense returned in `getAttributableExpenses`.
   - Any duplicate ID counted multiple times in `getAttributableExpenses` or `sumApprovedExpenses`.
   - Any monetary calculation resulting in floating-point precision drift.
