# Milestone 4 Handoff Report: Expenses Management, Commission Lifecycle & Payout Safety

**Worker**: `teamwork_preview_worker_m4`  
**Milestone**: Milestone 4: Expenses Management, Commission Lifecycle & Payout Safety  
**Date**: 2026-10-09  

---

## 1. Observation

### Codebase and Pre-Existing State
- `prisma/schema.prisma` lines 594–611 define model `Expense` with fields: `id`, `title`, `category`, `amount @db.Decimal(12, 3)`, `currency @default("TND")`, `status ExpenseStatus @default(PENDING)`, `period`, `notes`, `approvedAt`, `approvedById`, `createdById`, `createdAt`, `updatedAt`, with indexes `@@index([status, period])` and `@@index([createdAt])`.
- `prisma/schema.prisma` lines 643–666 define model `ReferralCommission` with fields: `id`, `attributionId`, `referrerPartnerId`, `orderId`, `amount @db.Decimal(12, 3)`, `currency @default("TND")`, `status ReferralCommissionStatus @default(PENDING_VERIFICATION)`, `idempotencyKey @unique`, `calculationDetails Json?`, `approvedAt`, `approvedById`, `paidAt`, `paidById`, `rejectionReason`, `createdAt`, `updatedAt`.
- `prisma/schema.prisma` lines 668–672 define enum `ExpenseStatus` (`PENDING`, `APPROVED`, `REJECTED`).
- `prisma/schema.prisma` lines 685–692 define enum `ReferralCommissionStatus` (`PENDING_VERIFICATION`, `ELIGIBLE`, `APPROVED_FOR_PAYMENT`, `PAID`, `REVERSED`, `REJECTED`).
- `src/lib/money.ts` lines 7–18 configure `Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP })` and provide `roundMoney(value)` rounding to 3 decimal places (millimes, TND).
- `src/modules/finance/referral-math.ts` lines 28–36 define `ADMIN_PROFIT_SHARE_RATE = new Decimal("0.70")`, `REMAINING_POOL_RATE = new Decimal("0.30")`, `REFERRAL_RATES = { 1: 0.05, 2: 0.10, 3: 0.15 }`, and function `calculateProfitSharing`.
- Prior to Milestone 4, `src/modules/finance/expenses.ts` and `src/modules/finance/referral-commissions.ts` did not exist in the repository.

### Files Created Within Exclusive Boundaries
1. `src/modules/finance/expenses.ts`:
   - Full CRUD operations: `createExpense`, `approveExpense`, `rejectExpense`, `getExpenseById`, `listExpenses`, `updateExpense`, `deleteExpense`.
   - `getAttributableExpenses`: strictly deducts only `APPROVED` expenses for the period/scope; pending and rejected expenses are excluded; deduplicates IDs in SQL and in-memory to prevent double-counting; exact 3-decimal precision.
   - `sumApprovedExpenses`: pure in-memory deduplication and summation helper for `APPROVED` expenses.
2. `src/modules/finance/referral-commissions.ts`:
   - Auditable commission lifecycle: `PENDING_VERIFICATION` $\to$ `ELIGIBLE` $\to$ `APPROVED_FOR_PAYMENT` $\to$ `PAID`, plus `REVERSED` and `REJECTED`.
   - `createReferralCommission`: validates attribution is `QUALIFIED`; calculates profit $P = R - E$; zero/negative profit generates zero commission ($C = 0$); positive profit splits $A = 70\%$, $B = 30\%$, $C = B \times r$; sets `idempotencyKey` and stores numerical breakdown in `calculationDetails`.
   - `approveReferralCommission`: verifies status is `ELIGIBLE` or `PENDING_VERIFICATION`; atomically transitions status to `APPROVED_FOR_PAYMENT`; sets `approvedAt` and `approvedById`; strictly separates approval from payment (does NOT mark as `PAID`).
   - `payReferralCommission`: verifies status is `APPROVED_FOR_PAYMENT`; strictly requires non-empty `transactionReference`; atomically transitions status to `PAID`, sets `paidAt` and `paidById`; records immutable `PARTNER_EARNING` transaction in ledger and recomputes partner wallet; blocks duplicate/concurrent payouts.
   - `rejectReferralCommission`: strictly requires non-empty reason; transitions status to `REJECTED`; blocks rejecting already `PAID` commissions.
   - `reverseReferralCommission`: strictly requires non-empty reason; transitions status to `REVERSED` with documented accounting policy (posts compensating negative `ADJUSTMENT` in ledger and updates wallet if previously paid).
3. `tests/referrals-commissions-lifecycle.test.ts`:
   - Comprehensive unit test suite covering 19 distinct test cases across 6 sections using high-fidelity in-memory mock client.

---

## 2. Logic Chain

1. **Expense Deductibility ($E$)**:
   - Per Requirement R4: "All approved business expenses are deducted before profit sharing. Do not count any expense twice."
   - In `src/modules/finance/expenses.ts`, `getAttributableExpenses` queries `where: { status: "APPROVED", ... }`. Any expenses in `PENDING` or `REJECTED` status are ignored.
   - To guard against double-counting, any input `expenseIds` array is converted to a `Set`, and results from the database are traversed with a `seenIds: Set<string>` filter, guaranteeing every attributable expense is counted at most once.
   - Monetary amounts are summed using `Decimal.js` and normalized through `roundMoney` (3 decimal places, `ROUND_HALF_UP`).

2. **Profit Sharing and Commission Computation ($P = R - E$)**:
   - Per Requirement R4: When $P > 0$, Admin share $A = 70\% \times P$, Remaining Pool $B = 30\% \times P$, and Direct referral commission $C = B \times r$ where $r \in \{0.05, 0.10, 0.15\}$.
   - In `src/modules/finance/referral-commissions.ts`, `createReferralCommission` verifies the attribution exists and `attribution.status === "QUALIFIED"`.
   - Collected revenue $R$ and approved attributable expenses $E$ are evaluated. If $P \le 0$ ($R \le E$), commission is strictly $0$ and admin profit share is $0$.
   - For the exact specification example ($R = 5000, E = 3000 \implies P = 2000, A = 1400, B = 600$):
     - Level 1 ($r = 0.05$): $C_1 = 600 \times 0.05 = 30.000$ TND, Balance = $570.000$ TND.
     - Level 2 ($r = 0.10$): $C_2 = 600 \times 0.10 = 60.000$ TND, Balance = $540.000$ TND.
     - Level 3 ($r = 0.15$): $C_3 = 600 \times 0.15 = 90.000$ TND, Balance = $510.000$ TND.
   - The breakdown is serialized into `calculationDetails`.

3. **Lifecycle State Separation & Payout Safety**:
   - Per Requirement R5: "Admin approval and payment recording must be separate steps. Do not mark commissions as Paid without an actual recorded payment event."
   - `approveReferralCommission` updates status to `APPROVED_FOR_PAYMENT`. It never modifies `paidAt` or marks the record as `PAID`.
   - `payReferralCommission` explicitly requires `status === "APPROVED_FOR_PAYMENT"` and a non-empty `transactionReference`. It atomically executes `updateMany({ where: { id, status: "APPROVED_FOR_PAYMENT" }, data: { status: "PAID", paidAt, paidById } })`.
   - If two concurrent requests arrive simultaneously, exactly one updates the row (`count === 1`), while the second receives `count === 0` and is rejected with `Commission has already been paid (duplicate payment blocked)`.
   - On successful payment, `createLedgerEntry` posts an immutable `PARTNER_EARNING` transaction with unique key `payout:commission:${commissionId}` and calls `recomputeWallet`.

4. **Rejection & Reversal Accounting Policies**:
   - Rejection is valid for unpaid commissions (`PENDING_VERIFICATION`, `ELIGIBLE`, `APPROVED_FOR_PAYMENT`) and requires a non-empty `reason`.
   - If a commission was already `PAID`, `rejectReferralCommission` is blocked and directs to `reverseReferralCommission`.
   - `reverseReferralCommission` requires a non-empty `reason`. Per documented accounting policy, if the commission was previously `PAID`, a compensating adjustment (type `ADJUSTMENT`, negative amount) is recorded in the ledger and the partner wallet is recomputed.

---

## 3. Caveats

- **External Database Connectivity**: Tests in `tests/referrals-commissions-lifecycle.test.ts` execute against a high-fidelity in-memory mock client replicating Prisma transactions and unique constraints. Real PostgreSQL integration testing requires running Docker containers.
- **Role Enforcement at API Boundary**: Authorization (verifying actor has `Role.ADMIN` or `Role.SUPER_ADMIN`) is intended for Next.js Server Actions and API routes in Milestone 5; the core domain functions in `referral-commissions.ts` record `actorId` for auditable tracking and accept any authorized actor identifier passed from the caller.

---

## 4. Conclusion

Milestone 4 requirements have been completely fulfilled:
- `src/modules/finance/expenses.ts` delivers full business expense CRUD, approval/rejection workflows, deduplicated attributable expense queries, and strict exclusion of non-approved expenses.
- `src/modules/finance/referral-commissions.ts` implements the multi-stage commission lifecycle with strict separation between approval (`APPROVED_FOR_PAYMENT`) and payment (`PAID`), mandatory payment references, documented accounting policies for reversals, and atomic concurrency guards.
- `tests/referrals-commissions-lifecycle.test.ts` provides comprehensive unit testing across all numerical, lifecycle, and safety invariants.

---

## 5. Verification Method

To independently verify the implementation:
1. Inspect source files:
   - `src/modules/finance/expenses.ts`
   - `src/modules/finance/referral-commissions.ts`
   - `tests/referrals-commissions-lifecycle.test.ts`
2. Run unit tests via Vitest:
   ```bash
   npx vitest run tests/referrals-commissions-lifecycle.test.ts
   ```
3. Run the complete test suite:
   ```bash
   npm test
   ```
4. Verify TypeScript type checking:
   ```bash
   npx tsc --noEmit
   ```
5. Invalidation conditions:
   - Any commission transition from `PENDING_VERIFICATION` or `ELIGIBLE` directly to `PAID` without intermediate `APPROVED_FOR_PAYMENT`.
   - `APPROVED_FOR_PAYMENT` setting `status: "PAID"` or populating `paidAt`.
   - Payment succeeding with empty or missing `transactionReference`.
   - Pending or rejected expenses being included in `getAttributableExpenses`.
   - Duplicate commission creations allowed for the same `idempotencyKey`.
