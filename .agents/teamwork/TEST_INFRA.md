# Referral & Commission System — Test Infrastructure & Architecture (TEST_INFRA.md)

**Platform**: E-commerce Collaboration Platform (`d:\e-com collab`)  
**Scope**: Requirements R2 (Permissions & Attribution), R3 (Partner Levels & Rates), R4 (Financial Calculations), R5 (Commission Lifecycle & Payout Safety)  
**Author**: E2E Test Suite Designer & Implementer  
**Standard**: Vitest 5.x / TypeScript 5.x / Decimal.js / Next.js 15 App Router

---

## 1. Test Philosophy & Design Principles

### 1.1 Opaque-Box & Requirement-Driven
The test suite treats the referral and financial calculation system as an **opaque box** driven strictly by the authoritative specifications defined in `ORIGINAL_REQUEST.md` and architectural interface contracts in `PROJECT.md`. Tests do not inspect or couple to internal private variables; instead, they assert on observable public interfaces, deterministic return structures, database state invariants, error exceptions, and immutable financial ledger records.

### 1.2 Authoritative Output Derivation
Every single test assertion is mathematically or contractually derived from authoritative source rules:
- **Financial Calculation Rule ($R4$)**: Profit $P = R - E$, where $R$ is collected/settled revenue and $E$ is approved attributable business expenses.
- **Profit Splitting ($R4$)**: Admin Share $A = 70\% \times P$, Remaining Pool $B = 30\% \times P$ when $P > 0$.
- **Direct Referral Commission ($R3$, $R4$)**: $C = B \times r$, where $r \in \{0.05, 0.10, 0.15\}$ for Levels 1, 2, and 3 respectively.
- **Specification Benchmark ($R4, §57$)**:
  $$\text{Revenue } R = 5,000.000\text{ TND}, \text{ Expenses } E = 3,000.000\text{ TND} \implies P = 2,000.000\text{ TND}$$
  $$A = 70\% \times 2,000 = 1,400.000\text{ TND}, \quad B = 30\% \times 2,000 = 600.000\text{ TND}$$
  $$\text{Level 1 } (5\%): C_1 = 30.000\text{ TND}, \quad \text{Remaining Pool Balance} = 570.000\text{ TND}$$
  $$\text{Level 2 } (10\%): C_2 = 60.000\text{ TND}, \quad \text{Remaining Pool Balance} = 540.000\text{ TND}$$
  $$\text{Level 3 } (15\%): C_3 = 90.000\text{ TND}, \quad \text{Remaining Pool Balance} = 510.000\text{ TND}$$
- **Zero & Negative Profit Rule ($R4, §53$)**: $P \le 0 \implies A = 0, B = 0, C = 0$. No positive commission or admin profit is ever generated when $P \le 0$.
- **Pool Cap Allocation Policy ($R4, §51$)**: Sum of commissions paid from pool $B$ cannot exceed $B$ ($\sum C \le B$).

### 1.3 Money-Safe Precision & Decimal Integrity
All monetary values are calculated using `Decimal.js` configured with precision 28 and `ROUND_HALF_UP` to 3 decimal places (millimes, TND). JavaScript IEEE-754 floating-point operations (`+`, `-`, `*`, `/`) are strictly prohibited in financial assertions.

### 1.4 Test Integrity & Zero Facade Guarantee
No test in this suite is a facade. Tests do not contain hollow assertions (`expect(true).toBe(true)`). Each test exercises real input validations, mathematical edge conditions, transaction rollback semantics, and multi-step state transitions.

---

## 2. Feature Inventory & Test Tier Mapping

| Feature ID | Requirement | Feature Description | Tier 1 (Isolation) | Tier 2 (Boundaries) | Tier 3 (Cross-Feature) | Tier 4 (E2E Scenarios) |
|---|---|---|:---:|:---:|:---:|:---:|
| **F-01** | R2 §18 | Referral link & code generation (ACTIVE partners only; unapproved rejected) | ✅ | ✅ | ✅ | ✅ |
| **F-02** | R2 §21 | Referral attribution on partner registration | ✅ | ✅ | ✅ | ✅ |
| **F-03** | R2 §18 | Self-referral prevention (ID, email, phone match rejection) | ✅ | ✅ | — | ✅ |
| **F-04** | R2 §18 | Duplicate referral attribution prevention (unique direct referrer) | ✅ | ✅ | — | ✅ |
| **F-05** | R2 §18 | Cyclic referral prevention (A $\to$ B $\to$ A or multi-hop loops) | ✅ | ✅ | — | ✅ |
| **F-06** | R2 §21 | Order delivery & 48h settlement qualification gating | ✅ | ✅ | ✅ | ✅ |
| **F-07** | R2 §22 | Storefront gap handling (sales referrals non-supported guard) | ✅ | — | — | — |
| **F-08** | R3 §25-27 | Partner level rates (L1: 5%, L2: 10%, L3: 15% of pool B) | ✅ | ✅ | ✅ | ✅ |
| **F-09** | R3 §29 | Direct referrals only (no downline/indirect multi-level payouts) | ✅ | — | ✅ | ✅ |
| **F-10** | R3 §31-33 | Configurable promotion thresholds (default 3 for L2, 10 for L3) | ✅ | ✅ | ✅ | ✅ |
| **F-11** | R3 §35 | Admin confirmation gate before automatic promotions | ✅ | — | ✅ | — |
| **F-12** | R3 §35 | Effective date recording & non-retroactive commission guarantee | ✅ | — | ✅ | ✅ |
| **F-13** | R3 §35 | No automatic demotion for partner inactivity | ✅ | — | — | — |
| **F-14** | R4 §38-43 | Attributable expense deduction & net profit calculation ($P = R - E$) | ✅ | ✅ | ✅ | ✅ |
| **F-15** | R4 §44-45 | 70% Admin Share ($A$) & 30% Remaining Pool ($B$) split | ✅ | ✅ | ✅ | ✅ |
| **F-16** | R4 §46-49 | Referral commission formula ($C = B \times r$) and separate reporting | ✅ | ✅ | ✅ | ✅ |
| **F-17** | R4 §53 | Zero/Negative profit protection ($P \le 0 \implies A=0, B=0, C=0$) | ✅ | ✅ | ✅ | — |
| **F-18** | R4 §51 | Pool cap policy (commissions sum $\le B$, no pool overdraft) | ✅ | ✅ | ✅ | ✅ |
| **F-19** | R4 §55 | Decimal.js 3-decimal precision (millimes) & rounding half up | ✅ | ✅ | — | — |
| **F-20** | R5 §60 | Commission lifecycle state machine (`PENDING_VERIFICATION` $\to$ `ELIGIBLE` $\to$ `APPROVED` $\to$ `PAID`) | ✅ | ✅ | ✅ | ✅ |
| **F-21** | R5 §60 | Admin approval separated from payment execution | ✅ | ✅ | ✅ | ✅ |
| **F-22** | R5 §60 | Payment event recording with reference required for `PAID` status | ✅ | ✅ | ✅ | ✅ |
| **F-23** | R5 §60 | Idempotency & duplicate commission prevention on retries/webhooks | ✅ | ✅ | ✅ | ✅ |
| **F-24** | R5 §60 | Full audit logging (actor, timestamp, reason, reference) | ✅ | — | ✅ | ✅ |

---

## 3. 4-Tier Test Architecture

### 3.1 Tier 1: Feature Coverage in Isolation (`tests/e2e-referral/tier1-features.test.ts`)
Each feature across Requirements R2, R3, R4, and R5 is tested in isolation with $\ge 5$ distinct test cases per requirement block:
- **Requirement R2 (Attribution & Permissions)**:
  1. Active partner generates referral code and formatted link URL.
  2. Unapproved (`PENDING`, `REJECTED`, `SUSPENDED`) partner is denied referral code generation (HTTP 403 / Forbidden).
  3. Non-partner role (e.g., standard customer / guest) is denied referral code generation.
  4. Valid partner registration accepts referral code and binds referrer to referred partner.
  5. Self-referral attempt is rejected when partner ID, email, or normalized phone matches.
  6. Duplicate attribution attempt for already-referred partner is rejected.
  7. Direct referral cycle (A $\to$ B, B $\to$ A) is detected and blocked.
  8. Transitive referral cycle (A $\to$ B $\to$ C $\to$ A) is detected and blocked.
  9. Order on unapproved referred partner does not trigger referral qualification.
  10. Order delivered but still within 48h settlement window (`PENDING`) does not trigger referral qualification.
- **Requirement R3 (Partner Levels & Rates)**:
  1. Level 1 partner receives exactly 5% of remaining pool B.
  2. Level 2 partner receives exactly 10% of remaining pool B upon meeting threshold (3 qualified referrals).
  3. Level 3 partner receives exactly 15% of remaining pool B upon meeting threshold (10 qualified referrals).
  4. Indirect/downline referral generates 0% commission (no multi-level marketing).
  5. System settings configuration governs promotion thresholds (e.g. changing threshold from 3 to 5 changes evaluation).
  6. Historical finalized commissions retain original level rate after partner promotion (effective-date invariance).
  7. Inactive partner retains achieved level without automatic demotion.
- **Requirement R4 (Financial Calculations)**:
  1. Canonical benchmark example: $R=5000, E=3000 \implies P=2000, A=1400 (70\%), B=600 (30\%), C_1=30, C_2=60, C_3=90$ TND.
  2. Commission is calculated from remaining pool B, NOT deducted from profit $P$ before calculating admin share $A$.
  3. Output breakdown explicitly separates $R, E, P, A, B, C$, and balance after commissions.
  4. Exact break-even profit ($R = E \implies P = 0$) results in $A = 0, B = 0, C = 0$.
  5. Negative profit ($R < E \implies P < 0$) produces no positive commission ($C = 0$) and no positive admin share ($A = 0$).
  6. Millimes rounding precision enforces `ROUND_HALF_UP` to 3 decimal places without float drift.
  7. Expenses deducted once per scope; deduplication prevents double-counting.
- **Requirement R5 (Commission Lifecycle & Payout Safety)**:
  1. Commission created in `PENDING_VERIFICATION` status upon qualifying event.
  2. Automatic or manual verification transitions commission from `PENDING_VERIFICATION` to `ELIGIBLE`.
  3. Admin reviews and transitions commission from `ELIGIBLE` to `APPROVED_FOR_PAYMENT`.
  4. Separate payment recording transitions `APPROVED_FOR_PAYMENT` to `PAID` with mandatory transaction reference.
  5. Skipping approval (direct `PENDING_VERIFICATION` $\to$ `PAID`) is strictly rejected.
  6. Admin rejection from `ELIGIBLE` transitions to `REJECTED` with mandatory justification reason.
  7. Post-settlement order cancellation/return transitions commission to `REVERSED`.
  8. Idempotent webhook/event replay does not create duplicate commission records.

### 3.2 Tier 2: Boundary & Corner Cases (`tests/e2e-referral/tier2-boundaries.test.ts`)
Stress testing extreme inputs, boundary referral counts, zero/negative quantities, and rate limits:
- **Financial & Monetary Boundaries**:
  1. Zero revenue, zero expense ($R=0.000, E=0.000 \implies P=0.000, A=0.000, B=0.000, C=0.000$).
  2. Micro-profit: single millime ($R=0.001, E=0.000 \implies P=0.001, A=0.001, B=0.000, C=0.000$).
  3. High-volume enterprise scale ($R=10,000,000.000, E=2,500,000.000$) retains exact millime precision.
  4. Negative revenue or extreme expense ratio ($R=100.000, E=5000.000 \implies P=-4900.000, C=0.000$).
  5. Rounding edge case: $P=33.333$ TND, pool $B=9.9999$ TND rounds to $10.000$ TND via `ROUND_HALF_UP`.
  6. Zero expense with full revenue ($E=0 \implies P=R$).
- **Referral Count & Promotion Threshold Boundaries**:
  7. Count = 0: strictly Level 1 (5%).
  8. Count = 2 (off-by-one below Level 2 threshold of 3): strictly Level 1 (5%).
  9. Count = 3 (exact Level 2 threshold boundary): promotes to Level 2 (10%).
  10. Count = 9 (off-by-one below Level 3 threshold of 10): strictly Level 2 (10%).
  11. Count = 10 (exact Level 3 threshold boundary): promotes to Level 3 (15%).
  12. Count = 100+: remains Level 3 (capped at 15%).
- **Input Sanitization & String Boundaries**:
  13. Empty string `""` and whitespace referral codes rejected.
  14. Maximum length referral codes (>50 characters) rejected.
  15. Special characters, SQL injection tokens, and Unicode symbols handled safely without error.
  16. Case-insensitivity: referral code `"REF-ABC-123"` matches `"ref-abc-123"`.
- **Lifecycle & Operation Boundaries**:
  17. Empty or whitespace payment reference string rejected when recording payout.
  18. Double-approval attempt on already `APPROVED_FOR_PAYMENT` commission is rejected or idempotent.
  19. Reversal attempt on already `REVERSED` commission rejected.
  20. Maximum pool exhaustion: pool $B$ cannot be overdrawn when multiple commissions compete.

### 3.3 Tier 3: Cross-Feature Combinations (`tests/e2e-referral/tier3-interactions.test.ts`)
Pairwise and multi-variable integration between features:
- **Combination 1: Partner Promotion + Settled Order Settlement**:
  Referrer with 2 qualified referrals refers 3rd partner. 3rd partner order settles $\to$ qualifies $\to$ referrer promoted to Level 2. Next order commission is evaluated at Level 2 (10%), while earlier commissions remain at Level 1 (5%).
- **Combination 2: Multiple Attributable Expenses + Pool Splitting + Balance Invariance**:
  Order with marketing expense ($E_{ad} = 40.000$) and delivery packaging expense ($E_{pkg} = 10.000$). Deducted together ($E_{total} = 50.000$). Profit $P = 150.000$. Pool $B = 45.000$. Referral commission $C = 4.500$. Verification of balance invariance: $A + C + \text{poolBalance} = P$.
- **Combination 3: Post-Settlement Order Return + Commission Reversal + Ledger Parity**:
  Delivered and settled order generated commission in `APPROVED_FOR_PAYMENT`. Subsequent return triggers reversal $\to$ status becomes `REVERSED` $\to$ partner pending balance adjusted $\to$ no negative unrecorded debit.
- **Combination 4: Partner Suspension + Active Commission Queue**:
  Partner who earned commission is suspended by admin. Commission approval workflow halts payout execution until partner status is resolved.
- **Combination 5: Dynamic Settings Threshold Modification + Promotion Engine**:
  Admin alters Level 2 threshold from 3 to 5 in `SystemSetting`. A partner with 3 qualified referrals is evaluated against the updated setting and remains Level 1.
- **Combination 6: Concurrent Settlement Replays + Idempotency Protection**:
  Two concurrent settlement events triggered simultaneously for the same order $\to$ transaction isolation ensures exactly one `ReferralCommission` is created.

### 3.4 Tier 4: Real-World Application Scenarios (`tests/e2e-referral/tier4-scenarios.test.ts`)
Comprehensive end-to-end user journeys replicating production behavior:
- **Scenario 1: Canonical End-to-End Partner Lifecycle**:
  Active Partner A generates referral code $\to$ Partner B signs up using code $\to$ Admin approves Partner B $\to$ Partner B places order $\to$ Order moves through fulfillment (`CONFIRMED` $\to$ `DELIVERED`) $\to$ 48h settlement window elapses $\to$ Order becomes `AVAILABLE` $\to$ Commission generated for Partner A in `PENDING_VERIFICATION` $\to$ Admin reviews and approves $\to$ Admin executes payout recording bank transfer reference $\to$ Commission marked `PAID`.
- **Scenario 2: Partner Multi-Tier Promotion Journey (Level 1 $\to$ Level 2 $\to$ Level 3)**:
  Partner starts at Level 1 $\to$ refers 3 partners who qualify with delivered orders $\to$ promoted to Level 2 (10%) $\to$ refers 7 additional partners who qualify $\to$ promoted to Level 3 (15%) $\to$ subsequent qualified referrals yield 15% $\to$ audit log validates monotonic career progression with exact timestamps.
- **Scenario 3: Order Dispute & Defective Product Return Flow**:
  Referred partner order delivered $\to$ commission approved $\to$ customer files return before payout $\to$ return processed $\to$ commission safely marked `REVERSED` with documented reason $\to$ partner wallet updated $\to$ no ghost balance left.
- **Scenario 4: Abuse Detection & Anti-Fraud Defense Matrix**:
  Multiple malicious patterns attempted: self-referral via phone variation, circular referral collusion ring (A $\to$ B $\to$ C $\to$ A), code generation by suspended partner, unapproved order qualification attempt $\to$ all blocked with distinct security errors.
- **Scenario 5: Multi-Order Consolidated Accounting & Expense Reconciliation**:
  Accounting period with 10 orders and aggregated shared expenses $\to$ profit calculation $\to$ 70/30 split $\to$ multi-partner direct referral attribution $\to$ sum of commissions strictly checked against pool cap $\to$ full audit log verified.

---

## 4. Test Execution & Environment

### 4.1 Test Commands
- Full Test Suite:
  ```bash
  npm test
  ```
- Referral E2E Test Suite Only:
  ```bash
  npx vitest run tests/e2e-referral/
  ```
- Individual Tiers:
  ```bash
  npx vitest run tests/e2e-referral/tier1-features.test.ts
  npx vitest run tests/e2e-referral/tier2-boundaries.test.ts
  npx vitest run tests/e2e-referral/tier3-interactions.test.ts
  npx vitest run tests/e2e-referral/tier4-scenarios.test.ts
  ```

### 4.2 Test Framework Integration
- Runner: `vitest` v5.0.1
- Environment: `node`
- Decimal Engine: `Decimal.js` v10.6.0
- Config File: `vitest.config.ts` (configured with `include: ["tests/**/*.test.ts"]` and `@` alias mapping to `src/`).

---

## 5. Summary & Readiness Checklist

- [x] Opaque-box, requirement-driven test philosophy established.
- [x] Full feature inventory mapped to Tiers 1–4.
- [x] Authoritative benchmark values derived directly from `ORIGINAL_REQUEST.md`.
- [x] Tier 1 Feature Coverage ($\ge 5$ tests per feature block).
- [x] Tier 2 Boundary & Corner Cases ($\ge 5$ tests per boundary block).
- [x] Tier 3 Cross-Feature Combinations (Pairwise coverage).
- [x] Tier 4 Real-World Application Scenarios ($\ge 5$ comprehensive journeys).
- [x] Test harness and runner commands documented.
