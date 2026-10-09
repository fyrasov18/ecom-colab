## 2026-10-09T01:17:24Z
You are the Worker for Milestone 4: Expenses Management, Commission Lifecycle & Payout Safety.
Your working directory is: d:\e-com collab\.agents\teamwork\teamwork_preview_worker_m4
Original request path: d:\e-com collab\.agents\teamwork\ORIGINAL_REQUEST.md

You MUST read d:\e-com collab\.agents\teamwork\ORIGINAL_REQUEST.md first before proceeding.
Also read:
- d:\e-com collab\.agents\teamwork\PROJECT.md
- d:\e-com collab\.agents\teamwork\AUDIT_SUMMARY.md

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your exclusive write boundaries:
- src/modules/finance/expenses.ts
- src/modules/finance/referral-commissions.ts
- tests/referrals-commissions-lifecycle.test.ts

Task instructions:
1. Implement `src/modules/finance/expenses.ts`:
   - CRUD and approval workflow for attributable business expenses $E$.
   - Functions: `createExpense`, `approveExpense`, `rejectExpense`, `getAttributableExpenses`.
   - Strictly deducts only `APPROVED` expenses for the period/scope. Pending or rejected expenses are excluded.
   - Enforce that no expense is counted twice. Exact Decimal.js summation with 3 decimal places.
2. Implement `src/modules/finance/referral-commissions.ts`:
   - Multi-stage auditable commission lifecycle:
     `PENDING_VERIFICATION` -> `ELIGIBLE` -> `APPROVED_FOR_PAYMENT` -> `PAID`, plus `REVERSED` and `REJECTED`.
   - `createReferralCommission`:
     - Checks attribution is qualified.
     - Takes collected revenue $R$ and approved attributable expenses $E$.
     - Computes profit $P = R - E$.
     - When $P \le 0$: generates zero commission ($C = 0$).
     - When $P > 0$: Admin share $A = 70\%$, pool $B = 30\%$, rate $r \in \{0.05, 0.10, 0.15\}$, $C = B \times r$.
     - Sets status `ELIGIBLE` (or `PENDING_VERIFICATION`), unique `idempotencyKey`, and stores breakdown in `calculationDetails`.
   - `approveReferralCommission`:
     - Verifies status is `ELIGIBLE` or `PENDING_VERIFICATION`.
     - Atomically updates status to `APPROVED_FOR_PAYMENT`.
     - Records `approvedAt`, `approvedById`.
     - DOES NOT mark as `PAID`. (Explicit separation of approval and payment).
   - `payReferralCommission`:
     - Verifies status is `APPROVED_FOR_PAYMENT`.
     - Strictly requires recorded payment reference (`transactionReference`).
     - Atomically updates status to `PAID`, records `paidAt`, `paidById`.
     - Updates financial records / wallet.
   - `rejectReferralCommission`:
     - Requires non-empty rejection reason.
     - Transitions status to `REJECTED`.
   - `reverseReferralCommission`:
     - Requires non-empty reversal reason.
     - Transitions status to `REVERSED` with documented accounting policy.
   - Prevent duplicate creation and duplicate payouts using unique idempotency keys and atomic transactions.
3. Author comprehensive unit tests in `tests/referrals-commissions-lifecycle.test.ts`:
   - Expense creation, approval, and exclusion of pending/rejected expenses from $E$.
   - Commission calculation formula with $R - E = P, A = 70\%, B = 30\%, C = B \times r$.
   - Exact numerical spec: 5000 - 3000 = 2000 -> A = 1400, B = 600, C1 = 30, C2 = 60, C3 = 90 TND.
   - Zero/negative profit produces zero commission and zero admin profit share.
   - Lifecycle progression: `PENDING_VERIFICATION` -> `ELIGIBLE` -> `APPROVED_FOR_PAYMENT` -> `PAID`.
   - `APPROVED_FOR_PAYMENT` does NOT set status to `PAID`.
   - `PAID` transition strictly requires recorded payment event/reference.
   - Rejection requires reason and sets `REJECTED`.
   - Reversal requires reason and sets `REVERSED`.
   - Duplicate commission creation blocked by idempotency key.
   - Concurrent/repeated payment requests blocked.
4. Write full handoff report to `d:\e-com collab\.agents\teamwork\teamwork_preview_worker_m4\handoff.md`.
