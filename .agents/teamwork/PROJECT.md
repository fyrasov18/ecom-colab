# Project: Referral System, Partner Levels, Commissions & Profit Sharing

## Architecture
- **Framework**: Next.js 15.5 App Router, React 19, Auth.js (NextAuth v5), Prisma 6, PostgreSQL 16.
- **Financial Architecture**: Pure Decimal.js engine (`precision: 28`, `ROUND_HALF_UP`) with 3 decimal places (millimes, TND). All money stored in `@db.Decimal(12, 3)`.
- **Referral Architecture**: Server-side attribution linking referring approved partner to referred partner. Direct referrals only.
- **Commission Lifecycle**: Dedicated auditable model with stages: `PENDING_VERIFICATION` $\to$ `ELIGIBLE` $\to$ `APPROVED_FOR_PAYMENT` $\to$ `PAID`, plus `REVERSED` and `REJECTED`.
- **Security & Authorization**: Server-side checks enforcing `PartnerStatus.ACTIVE`, IDOR prevention via session-derived partner IDs, atomic database transactions with unique idempotency keys.

## Code Layout
- `prisma/schema.prisma` & `prisma/migrations/`: Database schema, indexes, additive migrations.
- `src/lib/money.ts`: Base currency and Decimal utilities.
- `src/modules/referrals/`: Referral codes, attribution, validation (self/cycle/duplicate), qualification.
- `src/modules/referrals/levels.ts`: Referral tiers (Level 1: 5%, Level 2: 10%, Level 3: 15%), promotion thresholds, effective dates.
- `src/modules/finance/referral-math.ts`: Financial calculation engine ($P = R - E, A = 70\%, B = 30\%, C = B \times r$).
- `src/modules/finance/expenses.ts`: Attributable expense tracking and approval.
- `src/modules/finance/referral-commissions.ts`: Commission lifecycle and payout safety.
- `src/app/(admin)/partenaires/`: Admin referral management, commission approval queue, payout recording.
- `src/app/(partner)/parrainage/`: Partner referral dashboard, link/code generator, downline status, commission ledger.
- `tests/`: Unit tests, referral tests, integration tests.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R1 Pre-Implementation Audit | Audit schema, auth, orders, COD, expenses, financials | Done | ORIGINAL_REQUEST §R1 |
| 2 | Schema Additions & Additive Migrations | Add ReferralLink, ReferralAttribution, ReferralCommission, Expense, reconcile drift | M1 | ORIGINAL_REQUEST §R8 |
| 3 | Exact Decimal Financial Engine | Calculate $P = R - E$, $A = 70\%$, $B = 30\%$, $C = B \times r$ with exact 3-decimal precision | M1 | ORIGINAL_REQUEST §R4 |
| 4 | Zero/Negative Profit & Pool Cap Protection | Enforce $P \le 0 \implies A=0, B=0, C=0$, pool cap allocation policy | M1 | ORIGINAL_REQUEST §R4 |
| 5 | Referral Link/Code Generation & Permissions | Server-side generation for ACTIVE partners only; reject unapproved | M2 | ORIGINAL_REQUEST §R2 |
| 6 | Referral Attribution & Registration Intake | Accept partner referral codes on register; link referrer & referred | M2 | ORIGINAL_REQUEST §R2 |
| 7 | Self-Referral, Cycle & Duplicate Prevention | Server validation rejecting self-referrals, cyclic loops, duplicate attributions | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Order Delivery & Settlement Qualification | Qualify referral when referred partner has delivered + settled order | M3 | ORIGINAL_REQUEST §R2 |
| 9 | Configurable Partner Levels & Thresholds | Levels 1 (5%), 2 (10%), 3 (15%); configurable thresholds (3, 10) in settings | M3 | ORIGINAL_REQUEST §R3 |
| 10 | Promotion Engine & Effective Date Rules | Admin confirmation before auto-promotion; effective date recorded; no retroactive changes | M3 | ORIGINAL_REQUEST §R3 |
| 11 | Expense Tracking & Approval | Record and approve attributable business expenses $E$ by period/scope | M4 | ORIGINAL_REQUEST §R4 |
| 12 | Commission Lifecycle State Machine | Manage states: PENDING_VERIFICATION $\to$ ELIGIBLE $\to$ APPROVED $\to$ PAID | M4 | ORIGINAL_REQUEST §R5 |
| 13 | Payout Safety & Separate Payment Record | Admin approval separated from payment recording; idempotency keys | M4 | ORIGINAL_REQUEST §R5 |
| 14 | Admin Referral & Commission Dashboard | Admin UI for links, attributions, qualifying orders, approval queue, payment recording | M5 | ORIGINAL_REQUEST §R6 |
| 15 | Partner Referral Dashboard | Partner UI for link/code, referred partners status, level progress, commission history | M5 | ORIGINAL_REQUEST §R7 |
| 16 | E2E Test Suite (Tiers 1-4) | Opaque-box requirement-driven tests covering all features and boundary cases | E2E Track | ORIGINAL_REQUEST §R9 |
| 17 | Final Verification & Tier 5 Hardening | Pass 100% E2E tests, adversarial coverage hardening, tsc/lint/build/prisma checks | M6 | ORIGINAL_REQUEST §R9 |
| 18 | Delivery Report | Comprehensive R10 delivery report | Final | ORIGINAL_REQUEST §R10 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Data Models, Migrations & Core Math | Prisma schema, migration, system settings, Decimal referral math engine ($P = R - E$, pool B, rates) | none | DONE |
| M2 | Referral Permissions & Attribution | Link/code generation (ACTIVE only), registration integration, self/cycle/duplicate validation | M1 | DONE |
| M3 | Qualification & Partner Levels | Qualifying order detection (delivered + settled), partner level promotion engine, configurable thresholds | M1, M2 | DONE |
| M4 | Expenses & Commission Lifecycle | Expense model & approval, commission state machine, approval & payout separation, idempotency | M1, M3 | DONE |
| M5 | Admin & Partner Dashboards | Admin review & payout UI, calculation breakdown viewer, Partner link/stats/commission UI | M2, M3, M4 | IN_PROGRESS |
| M6 | Final Verification & Hardening | Phase 1: 100% E2E test pass; Phase 2: Tier 5 adversarial hardening; typecheck, lint, build | M5, E2E Track | PLANNED |

## Interface Contracts

### M1 Math ↔ Modules
- `calculateProfitSharing(params: { revenue: Decimal, expenses: Decimal, referrerLevel: 1 | 2 | 3 }): { revenue: Decimal, expenses: Decimal, profit: Decimal, adminShare: Decimal, remainingPool: Decimal, commissionRate: Decimal, referralCommission: Decimal, balanceAfterCommission: Decimal }`
- Currency: `"TND"`, decimal places: 3.

### M2 Referral Attribution ↔ Registration
- `generateReferralCode(partnerId: string): Promise<{ code: string, url: string }>` (validates `partner.status === "ACTIVE"`).
- `validateReferralCode(code: string): Promise<{ valid: boolean, referrerPartnerId?: string, error?: string }>`
- `recordPartnerReferral(tx: PrismaTransaction, referrerPartnerId: string, newPartnerId: string): Promise<ReferralAttribution>` (verifies no self-referral, no cycle, unique constraint).

### M3 Qualification ↔ Order Settlement
- `checkAndQualifyReferral(tx: PrismaTransaction, orderId: string): Promise<QualifyResult>` (verifies order status `DELIVERED`, `earningStatus === "AVAILABLE"`, idempotency key).
- `getPartnerReferralLevel(partnerId: string): Promise<{ level: 1 | 2 | 3, rate: Decimal, qualifiedCount: number }>`

### M4 Commission Lifecycle ↔ Finance
- `createReferralCommission(tx: PrismaTransaction, attributionId: string, orderId: string): Promise<ReferralCommission>` (status: `PENDING_VERIFICATION` or `ELIGIBLE`).
- `approveReferralCommission(commissionId: string, actorId: string, reason?: string): Promise<ReferralCommission>` (status $\to$ `APPROVED_FOR_PAYMENT`).
- `payReferralCommission(commissionId: string, actorId: string, reference: string): Promise<ReferralCommission>` (status $\to$ `PAID`, creates immutable ledger record).
