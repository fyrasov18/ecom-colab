# Original User Request

## Initial Request — 2026-10-08T23:51:09Z

Implement a Referral System, Partner Levels, Referral Commissions, and Profit Distribution in the existing E-commerce Collaboration platform. This is an audit-first, additive implementation: inspect the existing repository and real data model before changing any code, preserve all working functionality, and do not rebuild from scratch.

Working directory: `d:\e-com collab`
Integrity mode: development

---

## Requirements

### R1. Mandatory Pre-Implementation Audit
Inspect the repository's framework, authentication and authorization, Prisma schema and migrations, database configuration, partner approval workflow, any referral-related code, order lifecycle, delivery/COD collection data, expenses, financial records, and existing admin dashboard. Produce a concise audit summary that identifies what already exists, what is missing, gaps in required data, and risks before writing any code.

### R2. Referral Permissions and Attribution
Only partners with an explicitly Approved status may create and share referral links. Enforce this server-side in every relevant mutation, API route, server action, and database operation — hiding frontend buttons is not authorization. Prevent self-referrals, duplicate referral attribution, referral cycles, and abuse. Validate ownership and eligibility on the server at every entry point.

Two referral types:
- **Partner Referral**: an approved partner refers a new partner. A referral becomes reward-eligible only after the referred partner is approved AND has at least one qualifying order that is delivered and whose COD payment is confirmed as collected/settled, according to the actual capabilities of the existing system. Registration or approval alone is not enough.
- **Sales Referral**: attribute referred sales only if the existing order, referral attribution, and financial data support reliable tracking. Audit the current schema and order workflow first. If required source data is missing, document the gap and implement only the safely supportable parts.

### R3. Partner Levels and Direct-Referral Commission Rates
- Level 1 (starting): 5% commission rate
- Level 2: 10% commission rate
- Level 3: 15% commission rate

These percentages apply to the eligible net remaining pool (B, defined in R4), for eligible direct referrals only. Do not pay commissions on indirect/downline partners. Do not stack rates on the same profit.

Promotion thresholds (configurable business settings, not hard-coded values):
- Suggested Level 2 threshold: 3 qualified direct partner referrals
- Suggested Level 3 threshold: 10 qualified direct partner referrals

Flag these thresholds for admin confirmation before enabling automatic promotions if not already approved in project configuration. A qualified referral counts once only after the referred partner is approved and has at least one qualifying delivered and settled order. Deduplicate counts and protect against race conditions. The referrer's level at commission-calculation time determines the rate, subject to a documented effective-date rule. Do not retroactively recalculate finalized commissions. Do not automatically demote partners for inactivity.

### R4. Financial Calculation Rules
All approved business expenses are deducted before profit sharing. Do not count any expense twice.

Definitions:
- R = actual collected/settled revenue (not merely placed or confirmed order value)
- E = all approved, attributable expenses for the same accounting scope and period
- P = R − E (profit after expenses, before profit distribution)
- A = admin share = 70% × P when P > 0
- B = remaining pool = P − A = 30% × P when P > 0
- r = referrer's commission rate (5%, 10%, or 15% per level)
- C = referral commission = B × r, only for a qualified, eligible direct referral with verified underlying profit

Referral commission is calculated from the 30% remaining pool (B), not deducted from P before calculating A. Display admin share, remaining pool, referral commission, and balance after commissions separately.

If multiple eligible commissions draw from the same pool, define and enforce a consistent allocation policy — do not duplicate the full pool across referrers, and never silently pay more than the available pool.

If P ≤ 0, generate no positive commission and no positive admin profit share. Negative balances, returns after settlement, and reversals must follow an explicit documented accounting policy; never silently create unlimited negative partner balances or deduct from future commissions without an authorized record.

Use exact decimal/money-safe types and calculations (not floating-point). Store currency explicitly, defaulting to TND only if that matches the existing project.

Example: revenue 5,000 TND, expenses 3,000 TND → P = 2,000 TND, A = 1,400 TND, B = 600 TND → Level 1 commission = 30 TND, Level 2 = 60 TND, Level 3 = 90 TND (alternative rates, not cumulative).

### R5. Commission Lifecycle and Payout Safety
Use explicit, auditable commission statuses (e.g. Pending Verification → Eligible → Approved for Payment → Paid, plus Reversed and Rejected). Do not mark commissions as Paid without an actual recorded payment event. Admin approval and payment recording must be separate steps. Prevent duplicate commission creation and duplicate payouts using database constraints, transactions, idempotency checks, and authorization. Every financial adjustment, status change, and payout must record who performed it, when, why, and the relevant references.

### R6. Admin Dashboard
Provide or improve an admin-only interface covering: referral links and attribution; referring and referred partners; partner approval and qualifying-order status; partner levels and promotion eligibility; referral counts; commission rates; commission calculations with supporting revenue/expense records; pending verification; approval queue; payout history; reversals; suspicious or duplicate referrals; and audit logs. Allow authorized admins to review, approve, reject with reason, record payment, and inspect a detailed calculation breakdown. Do not expose sensitive financial or partner data to unauthorized users.

### R7. Partner Dashboard
Show each eligible partner their referral link/code, referral counts and statuses, current level, progress toward the next level, eligible/pending/approved/paid commission amounts, and transparent calculation history. Clearly distinguish estimated/pending commissions from finalized and paid ones. Users see only their own data.

### R8. Database, Security, and Migrations
- Reuse existing Prisma models when appropriate; avoid redundant tables or conflicting sources of truth.
- Add Prisma migrations for all required schema changes; never silently reset or drop production data.
- Use database transactions for multi-step financial operations.
- Add unique constraints and indexes for referral attribution, qualifying events, commission records, and payout idempotency.
- Validate all inputs server-side; apply least-privilege authorization.
- Protect against IDOR, privilege escalation, self-referrals, duplicate referrals, repeated event processing, and race conditions.
- Keep secrets in environment variables; do not hard-code credentials.

### R9. Tests and Verification
Tests are mandatory, not optional. Run existing tests before making changes to establish a baseline. Never delete, weaken, skip, or rewrite existing tests to make the suite pass.

**Unit tests** must cover:
- Revenue minus expenses equals profit; admin 70% share; remaining 30% pool; Level 1/2/3 commissions at 5%/10%/15% of B; the exact numeric example (5,000 − 3,000 = 2,000; A = 1,400; B = 600; C = 30/60/90 TND); zero/negative profit produces no positive commission; decimal precision; expenses not double-counted; refunds/reversals follow documented policy; multiple commissions cannot exceed the pool.

**Referral and level tests** must cover:
- Only approved partners can create/use referral links; unapproved users denied; self-referrals rejected; duplicate attribution rejected; cycles rejected; invalid codes rejected; registration/approval alone does not qualify; qualifying requires approval + delivered + settled order; same event counted only once including retries; configurable thresholds correctly enforced; automatic promotion disabled until admin confirms; direct referrals qualify, indirect do not; level changes follow effective-date rule; finalized historical commissions not retroactively changed.

**Integration/API tests** must cover:
- Auth/authz on all routes and actions; unauthorized users cannot read others' referral/commission/financial data; admin-only actions reject partners; commission lifecycle transitions are valid and auditable; Paid status requires recorded payment event; duplicate requests/webhook replays do not create duplicates; transaction rollback leaves no partial financial state; race conditions do not double-count or overspend the pool.

**Regression and build checks**: run unit tests, integration tests, ESLint, TypeScript type-check, Prisma schema validation, and production build. Investigate all failures and classify as pre-existing, caused by this change, or environment-related.

### R10. Delivery Report
After implementation, provide: (1) audit findings, (2) files changed, (3) schema and migration changes, (4) financial rules implemented, (5) endpoints/server actions added or changed, (6) tests executed with actual results, (7) environment variables or manual setup required, (8) remaining blockers, and (9) safe deployment and migration procedure. Clearly distinguish completed work from recommendations or unverified integrations. Do not claim success unless relevant checks actually pass.

---

## Acceptance Criteria

### Audit
- [ ] Audit summary produced before any code is written, covering existing schema, referral code, order lifecycle, COD/delivery data, expenses, and financial records
- [ ] Gaps and missing data explicitly documented; no invented integrations claimed

### Permissions and referral attribution
- [ ] Only Approved partners can generate referral links (enforced server-side)
- [ ] Self-referrals, duplicate attributions, cycles, and invalid codes are rejected with appropriate errors
- [ ] Unapproved/suspended/unauthorized users receive rejection responses from all relevant endpoints
- [ ] Referral becomes reward-eligible only after referred partner approval + qualifying delivered + settled order — verified by tests

### Financial calculations
- [ ] The exact example passes: 5,000 TND revenue, 3,000 TND expenses → P = 2,000, A = 1,400, B = 600, C₁ = 30, C₂ = 60, C₃ = 90
- [ ] Admin share is always 70% of P when P > 0; remaining pool is always 30% of P
- [ ] Zero or negative P produces no positive commission and no positive admin profit share
- [ ] Multiple commissions against the same pool never exceed total pool; allocation policy enforced
- [ ] All calculations use money-safe decimal types, not floating-point

### Partner levels
- [ ] Promotion thresholds are stored as configurable settings, not hard-coded
- [ ] Automatic promotions do not fire until admin has confirmed thresholds (or they were pre-approved in existing config)
- [ ] Level changes record an effective date; finalized historical commissions are not retroactively altered
- [ ] Indirect/downline referrals do not generate commission

### Commission lifecycle
- [ ] All commission state transitions are explicit, auditable, and recorded with actor/time/reason
- [ ] Paid status is only reachable via a recorded payment event
- [ ] Database constraints and transactions prevent duplicate commissions and duplicate payouts
- [ ] Concurrent requests or retried events do not double-count qualifying referrals or overpay from the same pool

### Admin dashboard
- [ ] Admin-only pages and actions reject non-admin sessions with appropriate HTTP status
- [ ] Admins can review, approve, reject (with reason), record payment, and view full calculation breakdown
- [ ] Audit log entries are created for every significant financial action

### Partner dashboard
- [ ] Partners see only their own referral and commission data
- [ ] IDOR is prevented — direct URL manipulation cannot expose another partner's data
- [ ] Commission amounts clearly labeled as pending/eligible/approved/paid

### Tests
- [ ] Existing test suite passes before and after changes (pre-existing failures documented separately)
- [ ] All R9 unit, referral/level, integration, and regression checks pass or are explicitly documented as blocked with reason
- [ ] No existing test was deleted, weakened, or skipped to achieve a passing suite

### Build and migration
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] ESLint passes with zero new errors
- [ ] `prisma validate` passes on the updated schema
- [ ] Prisma migrations are additive and safe for existing data
- [ ] Production build completes without errors
