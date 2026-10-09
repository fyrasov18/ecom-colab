# Review & Adversarial Challenge Report — Milestone 1 (Finance & Math)

**Date**: 2026-10-09  
**Reviewer**: Reviewer 2 (Finance & Math Specialist & Adversarial Critic)  
**Target Path**: `d:\e-com collab\.agents\teamwork\teamwork_preview_reviewer_m1_2\handoff.md`  
**Parent Agent ID**: `db106b0c-f803-4d56-a9c9-8c21473550c1`  
**Verdict**: **APPROVE**

---

## 1. Observation

Direct observations from source inspection and execution attempts:

1. **Terminal Command Execution**:
   - Tool call: `run_command` with `npx vitest run tests/referral-math.test.ts` in `d:\e-com collab`.
   - Tool result: `Permission check failed for command "npx vitest run tests/referral-math.test.ts": Permission prompt for action 'command' on target 'npx vitest run tests/referral-math.test.ts' was denied.`
   - Verbatim observation confirms Worker M1 and Explorer 1's caveat that the platform environment denies automated terminal execution. Verification proceeded via rigorous formal algebraic, boundary, and static code analysis.

2. **Source Code Implementation (`src/modules/finance/referral-math.ts`)**:
   - **Formula Invariants**:
     - Line 102: `const profit = roundMoney(revenue.minus(expenses));` ($\implies P = R - E$).
     - Line 132: `const adminShare = roundMoney(profit.times(ADMIN_PROFIT_SHARE_RATE));` where `ADMIN_PROFIT_SHARE_RATE = new Decimal("0.70")` ($\implies A = 70\% \times P$).
     - Line 135: `const remainingPool = roundMoney(profit.minus(adminShare));` ($\implies B = P - A = 30\% \times P$).
     - Line 138: `let referralCommission = roundMoney(remainingPool.times(commissionRate));` ($\implies C = B \times r$).
     - Line 144: `const balanceAfterCommission = roundMoney(remainingPool.minus(referralCommission));` ($\implies \text{Balance} = B - C$).
   - **Rate Definitions**:
     - Lines 32–36:
       ```ts
       export const REFERRAL_RATES: Record<ReferralLevel, Decimal> = {
         1: new Decimal("0.05"), // 5%
         2: new Decimal("0.10"), // 10%
         3: new Decimal("0.15"), // 15%
       };
       ```
   - **Zero and Negative Profit Guard**:
     - Lines 115–128:
       ```ts
       if (profit.lessThanOrEqualTo(0)) {
         return {
           revenue,
           expenses,
           profit,
           adminShare: d(0),
           remainingPool: d(0),
           commissionRate,
           referralCommission: d(0),
           balanceAfterCommission: d(0),
           isProfitable: false,
           currency,
         };
       }
       ```
     - Lines 169–171:
       ```ts
       if (poolAmount.lessThanOrEqualTo(0)) {
         return d(0);
       }
       ```
   - **Monetary Precision & Decimal Standards**:
     - Import from `src/lib/money.ts`: `d` and `roundMoney`.
     - `src/lib/money.ts` line 7: `Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP })`.
     - `src/lib/money.ts` line 9 & 17: `MONEY_PLACES = 3`, rounding to 3 decimal places using `ROUND_HALF_UP`.
   - **Pool Allocation Cap Logic**:
     - Lines 219–377 implement `allocateCommissionsFromPool(pool, requests, policy)`.
     - Lines 309–320 implement `FIFO` with decremented available balance.
     - Lines 321–364 implement `PRO_RATA` scaling with an iterative millime decrement loop (`sumAllocated.greaterThan(totalPool)`) ensuring sum of allocations never exceeds totalPool even under repeated fractional rounding up.

3. **Test Suite Coverage (`tests/referral-math.test.ts`)**:
   - Lines 43–98: Exact specification test case ($R = 5,000, E = 3,000 \implies P = 2,000, A = 1,400, B = 600 \implies C_1 = 30, C_2 = 60, C_3 = 90$ TND).
   - Lines 83–97: Double conservation invariant checks: $A + B = P$ and $B = C + \text{balanceAfterCommission}$.
   - Lines 100–135: Zero and negative profit tests ($P = 0$, $P = -1,000$, $R = 0, E = 450.5$, pool $\le 0$).
   - Lines 137–202: 3-decimal precision, fractional millimes round-half-up ($0.0005 \implies 0.001$), floating-point drift avoidance ($0.1 + 0.2$), and type polymorphism (Decimal, string, number).
   - Lines 204–310: Multi-commission pool caps (within pool, pro-rata cap exceeding pool, FIFO cap, repeating fractions, zero pool).

---

## 2. Logic Chain

1. **Integrity Violation Analysis**:
   - Evaluated `src/modules/finance/referral-math.ts` for hardcoded test results (e.g. `if (revenue === 5000)`). No shortcuts or facade logic exist; pure mathematical formulas are executed for arbitrary inputs.
   - Verified that the implementation is not a stub: it handles arbitrary revenue, expenses, tier levels, custom rates, pool caps, and policies.
   - Verified that the worker did not fabricate test runner logs; the lack of terminal execution was truthfully reported.
   - Result: **Zero integrity violations detected.**

2. **Mathematical Precision and Invariant Proofs**:
   - **Invariant 1: $A + B = P$ for $P > 0$**:
     $A = \text{roundMoney}(0.70 \times P)$. $B = \text{roundMoney}(P - A)$.
     Since $P$ and $A$ are rounded to 3 decimal places, $P - A$ has at most 3 decimal places.
     Therefore, $A + B = A + (P - A) = P$ is guaranteed with zero rounding discrepancy.
     *Observation*: Calculating $B = P - A$ rather than independent rounding $roundMoney(0.30 \times P)$ eliminates the well-known 1-millime split discrepancy ($0.70 + 0.30 \neq 1.00$ after independent rounding).
   - **Invariant 2: $C + \text{balanceAfterCommission} = B$**:
     $C = \text{roundMoney}(B \times r)$ capped at $B$.
     $\text{balance} = \text{roundMoney}(B - C) = B - C$.
     $C + \text{balance} = B$ holds unconditionally.
   - **Invariant 3: Zero/Negative Profit Safety**:
     When $P \le 0$, $A = 0$, $B = 0$, $C = 0$, $\text{balance} = 0$.
     No positive admin share is distributed, and no negative partner balances or positive referral payouts are generated.
   - **Invariant 4: Pool Cap Guarantee ($\sum \text{Allocated} \le B$)**:
     In `allocateCommissionsFromPool`:
     - Under `FIFO`: `available` starts at $B$ and decreases by each non-negative grant. The sum cannot exceed $B$.
     - Under `PRO_RATA`: Each share is initially computed as $\frac{\text{req}}{\sum \text{req}} \times B$. If rounding-up causes $\sum \text{share} > B$, lines 346–364 execute a while loop that deducts 0.001 TND from the largest allocations until $\sum \text{share} \le B$.
     - Thus, under both policies, $\sum \text{Allocated} \le B$ is algebraically and algorithmically guaranteed.

3. **Adversarial Stress-Testing & Failure Modes**:
   - **Scenario A (Repeating Decimal Pro-Rata)**: 3 partners requesting 50 TND each against a pool of 100 TND.
     $\frac{50}{150} \times 100 = 33.3333\dots \implies 33.333$ TND each.
     $33.333 \times 3 = 99.999$ TND. $\sum \text{allocated} = 99.999 \le 100.000$.
     The safety invariant is maintained. The remaining 0.001 TND stays in `remainingPool`.
   - **Scenario B (Negative custom rate override)**:
     If a caller passes a negative custom `commissionRate` (e.g. `-0.10`), line 138 produces a negative commission because line 139 only clamps the upper bound (`greaterThan(remainingPool)`). While standard usage via `referrerLevel` is immune (protected by `REFERRAL_RATES`), custom rates should ideally clamp lower bound $\ge 0$.
   - **Scenario C (Negative requestedAmount in pool allocation)**:
     If a caller passes a negative `requestedAmount`, it could distort `totalRequested`. In practice, commissions are non-negative, but defensive clamping (`Decimal.max(0, ...)`) is recommended.

---

## 3. Findings

### [Minor / Defensive] Finding 1: Unclamped lower bound on custom `commissionRate`
- **What**: In `calculateProfitSharing()`, if a caller supplies an explicit negative `commissionRate` (e.g. `-0.05`), the calculated commission can be negative.
- **Where**: `src/modules/finance/referral-math.ts`, lines 138–141.
- **Why**: The code caps `referralCommission` against `remainingPool` on the upper bound, but does not clamp to 0 on the lower bound.
- **Suggestion**: Add `referralCommission = Decimal.max(0, Decimal.min(referralCommission, remainingPool));` or validate `if (commissionRate.lessThan(0)) throw new Error("Commission rate cannot be negative");`. Note: This does not affect normal operation via `referrerLevel` (which strictly yields 0.05, 0.10, or 0.15).

### [Minor / Defensive] Finding 2: Unsanitized negative `requestedAmount` in pool allocation
- **What**: In `allocateCommissionsFromPool()`, `req.requestedAmount` is not clamped to $\ge 0$.
- **Where**: `src/modules/finance/referral-math.ts`, lines 270–272.
- **Why**: If an invalid negative amount is passed, it reduces `totalRequested` and may skew pro-rata shares.
- **Suggestion**: Sanitize input with `Decimal.max(0, roundMoney(d(req.requestedAmount)))`.

### [Note / Architecture] Finding 3: Pro-Rata Rounding Residuals in Milestone 4
- **What**: When allocating under heavy contention with repeating fractions, sum of allocated amounts can be 0.001–0.002 DT less than `totalPool` due to half-up/floor discretization.
- **Where**: `src/modules/finance/referral-math.ts`, lines 321–344.
- **Why**: This is mathematically sound and conservative (guarantees platform solvency by never overpaying), but Milestone 4 consumers must not expect `remainingPool` to be strictly zero when `isExceeded === true`.

---

## 4. Verified Claims

| Claim | Verified Via | Status |
|---|---|---|
| $P = R - E, A = 70\% \cdot P, B = 30\% \cdot P, C = B \cdot r$ | Static inspection & algebraic proof (`referral-math.ts:101-145`) | PASS |
| Tier rates: Level 1 = 5%, Level 2 = 10%, Level 3 = 15% | Const inspection (`referral-math.ts:32-36`) | PASS |
| Exact spec: 5000/3000 $\implies$ 2000, 1400, 600, 30/60/90 | Test assertions check (`referral-math.test.ts:47-81`) | PASS |
| Conservation invariants: $A + B = P$ and $B = C + \text{balance}$ | Algebraic proof & test review (`referral-math.test.ts:83-97`) | PASS |
| Zero & negative profits: $P \le 0 \implies A=0, B=0, C=0$ | Logic branch check (`referral-math.ts:115-128, 169-171`) | PASS |
| Millimes precision (3 decimal places, `ROUND_HALF_UP`) | `@/lib/money.ts` & `roundMoney()` usage check | PASS |
| Multi-commission pool allocation cap $\sum \text{allocated} \le B$ | FIFO and PRO_RATA loop analysis (`referral-math.ts:309-365`) | PASS |
| Configurable promotion thresholds (3, 10, auto=false) | `src/modules/settings/defaults.ts` inspection | PASS |
| Additive Prisma Schema with `@db.Decimal(12, 3)` | `prisma/schema.prisma` lines 598, 650 inspection | PASS |
| Absence of integrity violations (no hardcoded cheats) | Full source audit of `referral-math.ts` | PASS |

---

## 5. Caveats

1. **Terminal Command Execution**: Automated shell execution via `run_command` was rejected by the environment security policy. The verification was conducted via line-by-line static inspection, algebraic invariant proofs, and test assertion verification.
2. **Database Migration Application**: The additive migration script `prisma/migrations/20261009000000_referrals_and_expenses/migration.sql` is ready and verified syntactically, but pending live database connection deployment.

---

## 6. Conclusion

**Verdict**: **APPROVE**

Milestone 1 satisfies all Finance & Math requirements set forth in Requirements R3, R4, and R8 of `ORIGINAL_REQUEST.md`:
1. The financial math engine correctly calculates $P = R - E$, splits profit into 70% Admin Share and 30% Pool B, and calculates direct commissions at 5%, 10%, and 15% of Pool B.
2. The core invariants $A + B = P$ and $B = C + \text{balanceAfterCommission}$ are preserved with zero rounding drift.
3. Zero and negative profit states ($P \le 0$) generate strictly zero admin shares, zero commissions, and zero negative partner balances.
4. Precision is strictly managed with Decimal.js at 3 decimal places (millimes) using `ROUND_HALF_UP`.
5. Multi-commission pool allocation capping is implemented under both `PRO_RATA` and `FIFO` policies, mathematically preventing any pool overspend.
6. The test suite provides 14 distinct test cases covering the exact numerical specification, edge cases, negative profits, precision, and pool caps.
7. Zero integrity violations or hardcoded facades were found.

---

## 7. Verification Method

To independently verify the implementation:
1. **Formula & Logic Inspection**:
   - Inspect `src/modules/finance/referral-math.ts` lines 96–158 for `calculateProfitSharing()`.
   - Inspect `src/modules/finance/referral-math.ts` lines 219–377 for `allocateCommissionsFromPool()`.
2. **Precision & Money Utils**:
   - Inspect `src/lib/money.ts` lines 7–18 for `Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP })` and `MONEY_PLACES = 3`.
3. **Unit Tests**:
   - Inspect `tests/referral-math.test.ts` lines 43–310.
4. **Independent Test Execution** (when run in terminal with execution permissions):
   ```bash
   npx vitest run tests/referral-math.test.ts
   ```
