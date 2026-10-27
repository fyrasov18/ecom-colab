# Handoff Report — Survey Explorer 1 (Schema & DB Specialist)

**Date**: 2026-10-09  
**Role**: Survey Explorer 1 (Schema & DB Specialist)  
**Task**: R1 Pre-Implementation Audit (Framework, Prisma Schema, Migrations, DB Configuration, Money/Data Types, Gaps & Risks for R1–R8)  
**Target File**: `d:\e-com collab\.agents\teamwork\teamwork_preview_explorer_survey_1\handoff.md`

---

## 1. Observation

### 1.1 Repository Framework, Dependencies, and Scripts
From `d:\e-com collab\package.json` (lines 1–66):
- **Web Framework**: Next.js 15.5.26 (`next`: `^15.5.26`), React 19.3.0 (`react`: `^19.3.0`, `react-dom`: `^19.3.0`), App Router architecture (`src/app/(admin)`, `src/app/(partner)`, `src/app/(auth)`, `src/app/api`).
- **Authentication**: NextAuth 5.0.0-beta.32 (`next-auth`: `^5.0.0-beta.32`) with JWT session strategy, Edge-safe middleware (`src/middleware.ts`), and Credentials provider (`src/lib/auth.ts`).
- **Database / ORM**: Prisma 6.19.3 (`@prisma/client`: `^6.19.3`, `prisma`: `^6.19.3`).
- **Math & Decimals**: Decimal.js 10.6.0 (`decimal.js`: `^10.6.0`).
- **Validation**: Zod 3.25.76 (`zod`: `^3.25.76`).
- **Security & Cryptography**: Bcrypt.js 3.0.3 (`bcryptjs`: `^3.0.3`).
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss`: `^4.3.3`, `tailwindcss`: `^4.3.3`, `postcss`: `^8.5.28`).
- **Testing Engine**: Vitest 5.0.1 (`vitest`: `^5.0.1`), tsx 4.23.15 (`tsx`: `^4.23.15`).
- **Linting**: ESLint 9.39.5 (`eslint`: `^9.39.5`, `eslint-config-next`: `^16.3.6`).
- **CLI Scripts**:
  - `"dev"`: `"next dev"`
  - `"build"`: `"prisma generate && next build"`
  - `"lint"`: `"eslint ."`
  - `"db:generate"`: `"prisma generate"`
  - `"db:push"`: `"prisma db push"`
  - `"db:migrate"`: `"prisma migrate dev"`
  - `"db:migrate:deploy"`: `"prisma migrate deploy"`
  - `"db:migrate:status"`: `"prisma migrate status"`
  - `"db:seed"`: `"tsx prisma/seed.ts"`
  - `"db:orders-seed"`: `"tsx scripts/seed-orders.ts"`
  - `"db:finance-seed"`: `"tsx scripts/seed-finance.ts"`
  - `"test"`: `"vitest run"`
  - `"test:int"`: `"vitest run --config vitest.integration.config.ts"`

### 1.2 Database Configuration & Engine
- **Database Engine**: PostgreSQL 16 Alpine (`postgres:16-alpine` in `d:\e-com collab\docker-compose.yml`, lines 1–23).
- **Network / Port**: Mapped to host port `5433:5432` to avoid collisions with local default PostgreSQL installations.
- **Connection Configuration** (`d:\e-com collab\.env.example`, lines 4–16, and `prisma/schema.prisma`, lines 5–9):
  - `DATABASE_URL`: pooled connection string (used at runtime by the Next.js app).
  - `DIRECT_URL`: direct connection string (used by Prisma migrate to bypass poolers).
  - Both strings default locally to `postgresql://ecomcolab:ecomcolab@localhost:5433/ecomcolab?schema=public`.
- **Prisma Configuration** (`d:\e-com collab\prisma.config.ts`, lines 1–33):
  - Defines schema path `"prisma/schema.prisma"`, migrations path `"prisma/migrations"`, seed command `"tsx prisma/seed.ts"`.
  - CLI loads `.env` via `process.loadEnvFile(".env")`.

### 1.3 Prisma Schema Models, Enums, Indexes, and Constraints
From `d:\e-com collab\prisma\schema.prisma` (lines 1–589), the database currently defines 17 models and 17 enums:

#### Models
1. **`User`** (lines 11–33):
   - Fields: `id` (cuid), `email` (unique), `passwordHash`, `firstName`, `lastName`, `role` (`Role`: `SUPER_ADMIN`, `ADMIN`, `PARTNER`), `status` (`UserStatus`: `ACTIVE`, `DISABLED`), `createdAt`, `updatedAt`.
   - Relations: `partner` (`Partner?`), `invitedPartners` (`Partner[]` via `"PartnerInvitedBy"`), `auditLogs`, `createdTransactions`, `notifications`, `createdOrders`, `orderStatusChanges`, `reviewedWithdrawals`.
   - Index: `@@index([role, status])`.
2. **`Partner`** (lines 35–72):
   - Fields: `id` (cuid), `userId` (unique FK $\to$ `User`), `code` (unique text, e.g. `"P001"`), `displayName`, `status` (`PartnerStatus`: `ACTIVE`, `PENDING`, `SUSPENDED`, `REJECTED`, `CLOSED`), `defaultCommissionType` (`CommissionType`: `PERCENTAGE`, `FIXED`), `defaultCommissionValue` (`Decimal(12, 3)` default 60), `notes`, `performanceLevelId` (FK $\to$ `PerformanceLevel`), `phone` (String?), `experienceLevel` (`EcommerceExperience?`), `invitedByUserId` (FK $\to$ `User`), `createdAt`, `updatedAt`.
   - Relations: `user`, `performanceLevel`, `invitedBy` (`User`), `customers`, `transactions`, `orders`, `assignedProducts`, `socialAccounts`, `wallet`, `withdrawals`.
   - Index: `@@index([status])`.
3. **`PartnerSocialAccount`** (lines 74–86):
   - Platform handles (`FACEBOOK`, `INSTAGRAM`, `TIKTOK`, `OTHER`), label, URL.
4. **`PerformanceLevel`** (lines 88–105):
   - Fields: `id`, `name` (unique), `description`, `sharePercentage` (`Decimal(5, 2)`), `criteria` (`Json?`), `isActive` (boolean default true), `sortOrder` (Int default 0), timestamps.
   - Index: `@@index([isActive, sortOrder])`.
   - **Note**: Used for direct order contribution splits (e.g. 60% partner / 40% platform), NOT for referral commission rates.
5. **`Product`** (lines 107–135):
   - Costs & Pricing: `purchaseCost` (`Decimal(12, 3)`), `packagingCost` (`Decimal(12, 3)`), `deliveryCost` (`Decimal(12, 3)`), `sellingPrice` (`Decimal(12, 3)`).
   - Stock: `stockQuantity`, `lowStockThreshold`.
   - Commission overrides: `commissionType`, `commissionValue` (`Decimal(12, 3)`).
6. **`ProductMedia`** & **`ProductMarketingAsset`** (lines 137–163):
   - Media links (Google Drive URL) and ad copy/creative assets.
7. **`PartnerProduct`** (lines 165–179):
   - Explicit assignment link between Partner and Product.
   - Constraint: `@@unique([partnerId, productId])`.
   - Overrides: `commissionType`, `commissionValue` (`Decimal(12, 3)`).
8. **`Customer`** (lines 181–197):
   - Customer records owned by a partner.
   - Constraint: `@@unique([ownerPartnerId, phone])`, index `@@index([phone])`.
9. **`Order`** (lines 199–243):
   - Identification: `id` (cuid), `orderNumber` (Int unique from PostgreSQL sequence `order_number_seq`).
   - Links: `partnerId`, `createdById`, `customerId`.
   - Status & Timing: `status` (`OrderStatus`: `CONFIRMED`, `VALIDATED`, `ON_HOLD`, `PREPARING`, `PACKAGED`, `SHIPPED`, `IN_DELIVERY`, `DELIVERED`, `REFUSED`, `RETURNED`, `CANCELLED`), `deliveredAt`, `settlementDueAt`, `earningStatus` (`EarningStatus`: `NONE`, `PENDING`, `AVAILABLE`, `REVERSED`).
   - Financial Snapshot (frozen at creation): `unitSellingPrice` (`Decimal(12, 3)`), `productCost` (`Decimal(12, 3)`), `packagingCost` (`Decimal(12, 3)`), `deliveryCost` (`Decimal(12, 3)`), `contribution` (`Decimal(12, 3)`), `partnerEarning` (`Decimal(12, 3)`), `platformShare` (`Decimal(12, 3)`), `adjustmentsTotal` (`Decimal(12, 3)`), `currency` (default `"TND"`).
   - Direct Level Snapshot: `partnerSharePercentage` (`Decimal(5, 2)`), `performanceLevelName`.
   - Indexes: `@@index([status, createdAt])`, `@@index([partnerId, createdAt])`, `@@index([customerId])`, `@@index([deliveredAt])`, `@@index([settlementDueAt])`.
10. **`OrderItem`** (lines 245–258):
    - `unitPrice` (`Decimal(12, 3)`), `quantity`, `productName`, `productSlug`.
11. **`OrderStatusHistory`** (lines 260–272):
    - Immutable status transition log with `oldStatus`, `newStatus`, `changedById`, `reason`.
12. **`Shipment`** (lines 274–284):
    - 1-to-1 with Order: `carrier`, `trackingNumber`, `shippedAt`, `deliveredAt`.
13. **`Return`** (lines 286–296):
    - 1-to-1 with Order: `kind` (`REFUSED`, `RETURNED`), `reason`, `costCharged` (`Decimal(12, 3)`), `currency` (`"TND"`).
14. **`Wallet`** (lines 298–308):
    - 1-to-1 cache for Partner derived from `FinancialTransaction`.
    - Fields: `availableBalance`, `pendingBalance`, `totalEarned`, `totalWithdrawn` (`Decimal(12, 3)`), `currency` (`"TND"`).
15. **`FinancialTransaction`** (lines 310–332):
    - Immutable ledger table.
    - Fields: `partnerId`, `orderId` (optional), `withdrawalId` (optional unique), `type` (`FinancialTransactionType`: `PARTNER_EARNING`, `RETURN_COST`, `WITHDRAWAL`, `ADJUSTMENT`), `amount` (`Decimal(12, 3)`), `currency` (`"TND"`), `status` (`PENDING`, `AVAILABLE`), `availableAt`, `description`, `idempotencyKey` (unique), `createdById`.
    - Indexes: `@@index([partnerId, status])`, `@@index([status, availableAt])`, `@@index([orderId])`.
16. **`Withdrawal`** (lines 334–355):
    - Payout requests: `partnerId`, `amount` (`Decimal(12, 3)`), `status` (`WithdrawalStatus`: `REQUESTED`, `UNDER_REVIEW`, `APPROVED`, `PAID`, `REJECTED`), `transactionReference`, `reviewedById`, `rejectionReason`.
17. **`AuditLog`** (lines 371–387):
    - Immutable audit: `actorId`, `action`, `entityType`, `entityId`, `before` (Json), `after` (Json), `ip`, `userAgent`, `createdAt`.
18. **`SystemSetting`** (lines 389–400):
    - Configuration store: `key` (unique), `value` (Json), `category`, `description`, `updatedById`, timestamps.
19. **Telegram Models** (`TelegramAuthorizedUser`, `TelegramSession`, `TelegramUpdate`, lines 402–449):
    - Bot ingestion tracking with unique `updateId`.

#### Enums
`Role`, `UserStatus`, `PartnerStatus`, `EcommerceExperience`, `SocialPlatform`, `ProductStatus`, `ProductSource`, `MediaType`, `MarketingAssetKind`, `PartnerProductStatus`, `CommissionType`, `CommissionSource`, `OrderStatus`, `EarningStatus`, `FinancialTransactionType`, `FinancialTransactionStatus`, `WithdrawalStatus`, `ReturnKind`, `NotificationType`.

### 1.4 Migration History & Existing Migration Drift
Existing migrations in `d:\e-com collab\prisma\migrations`:
1. `20260926120000_init`: Created baseline schema.
2. `20260927234204_product_media_google_drive`: Added `googleDriveUrl` and `title` to `ProductMedia`.
3. `20260928222342_performance_levels`: Added `PerformanceLevel` table, `Partner.performanceLevelId`, `Order.partnerSharePercentage`, `Order.performanceLevelName`.
4. `20260928224357_telegram_ingestion`: Added `Telegram*` tables, `ProductSource` enum, `MarketingAssetKind` values.

**CRITICAL SCHEMA DRIFT OBSERVED**:
- In `prisma/schema.prisma` lines 462–468, `enum PartnerStatus` contains `{ ACTIVE, PENDING, SUSPENDED, REJECTED, CLOSED }`.
  - In `20260926120000_init/migration.sql` line 11: `CREATE TYPE "PartnerStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');` — `PENDING` and `REJECTED` are NOT in any migration file.
- In `prisma/schema.prisma` lines 50–60, `Partner` has `phone`, `experienceLevel`, and `invitedByUserId` (relation `"PartnerInvitedBy"` to `User`).
  - In `prisma/schema.prisma` lines 472–476, `enum EcommerceExperience` is defined.
  - Neither `EcommerceExperience` nor these three fields exist in any migration file in `prisma/migrations/`.
- This proves that these changes were either applied directly via `prisma db push` in dev or are pending migration. Any new migration added for R1–R8 must safely incorporate these additions without generating a conflicting migration or resetting the dev database.

### 1.5 Monetary and Data Type Handling
- **Currency**: Tunisian Dinar (TND), displayed as `"DT"`, with database default `"TND"`.
- **Sub-unit**: 1 TND = 1,000 millimes. Therefore, money amounts require **3 decimal places** (`MONEY_PLACES = 3`).
- **Database precision**: Every monetary column is configured as `@db.Decimal(12, 3)` in Prisma.
- **Percentage precision**: Configured as `@db.Decimal(5, 2)`.
- **Runtime implementation**:
  - `d:\e-com collab\src\lib\money.ts` lines 1–37:
    - `Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP })`
    - `roundMoney(val)`: rounds to 3 decimal places with `ROUND_HALF_UP`.
    - `d(val)`: wraps input in `Decimal`.
  - Floating-point numbers are strictly forbidden for financial arithmetic across the codebase.
  - `d:\e-com collab\tests\money.test.ts` lines 1–27 verifies millimes precision, exact contribution math, and lack of float drift.

### 1.6 Existing Order, Delivery, Settlement, and Finance Flow
- **Order creation** (`src/modules/orders/create.ts`, lines 86–133):
  - Revenue $R = \text{unitSellingPrice} \times \text{quantity}$.
  - Costs: $\text{productCost} = \text{purchaseCost} \times \text{quantity}$, $\text{packagingCost} = \text{packagingCost} \times \text{quantity}$, $\text{deliveryCost} = \text{product.deliveryCost}$.
  - $\text{contribution} = R - \text{productCost} - \text{packagingCost} - \text{deliveryCost}$.
  - Direct partner share: $\text{partnerEarning} = \text{contribution} \times \text{partnerSharePercentage}$ (default 60% or PerformanceLevel share).
  - Platform share: $\text{platformShare} = \text{contribution} - \text{partnerEarning}$.
- **Order delivery & settlement** (`src/modules/orders/status.ts`, lines 58–64, 128–139, and `src/modules/finance/ledger.ts`, lines 109–146, 156–207):
  - Order status transitions to `DELIVERED`.
  - Sets `deliveredAt = now` and `settlementDueAt = now + hours` (from setting `finance.settlement_period_hours`, default 48h).
  - Creates append-only `FinancialTransaction` (`type: "PARTNER_EARNING"`, `status: "PENDING"`, `availableAt: settlementDueAt`, `idempotencyKey: "earning:order:<orderId>"`).
  - Order `earningStatus` becomes `PENDING`.
  - When settlement period elapses, `settleDueEarnings()` updates `FinancialTransaction` status to `AVAILABLE` and `Order.earningStatus` to `AVAILABLE`.
  - **COD Tracking Reality**: The codebase does not have separate courier remittance tracking tables. In this platform, an order reaching `DELIVERED` with `earningStatus: "AVAILABLE"` (settlement date passed) represents that the COD delivery was completed and settled.

### 1.7 Existing Test Framework and Inventory
- **Vitest**: Configured in `vitest.config.ts` (unit tests in `tests/**/*.test.ts`) and `vitest.integration.config.ts` (integration tests in `tests/integration/**/*.int.test.ts`).
- **Existing Test Files (23 files total)**:
  - Unit tests (19): `analytics.test.ts`, `auth-config.test.ts`, `bulk.test.ts`, `commission.test.ts`, `finance-rules.test.ts`, `google-drive.test.ts`, `money.test.ts`, `notifications.test.ts`, `order-schema.test.ts`, `performance-levels.test.ts`, `product-schema.test.ts`, `rate-limit.test.ts`, `roles.test.ts`, `settings-defaults.test.ts`, `settings-validation.test.ts`, `storage.test.ts`, `telegram-parser.test.ts`, `telegram-webhook.test.ts`, `transitions.test.ts`.
  - Integration tests (4): `integration/finance.int.test.ts`, `integration/logistics.int.test.ts`, `integration/notifications.int.test.ts`, `integration/orders.int.test.ts`.

---

## 2. Logic Chain

1. **Premise 1 (R1 & Architecture)**:
   - The application is a production-grade Next.js App Router application with PostgreSQL, Prisma ORM, NextAuth JWT authentication, and strict Decimal.js financial calculations.
   - All monetary amounts in the database are stored as `@db.Decimal(12, 3)` in Tunisian Dinars (TND / DT).

2. **Premise 2 (R2 Referral Permissions & Attribution)**:
   - Observation shows `PartnerStatus` has `ACTIVE` and `PENDING`. A newly registered partner enters `PENDING`. Admin status change to `ACTIVE` constitutes approval.
   - Currently, partner registration (`src/modules/registration/service.ts`) hard-codes the invitation code to `"admin"` and links `invitedByUserId` to an Admin `User` (not a `Partner`).
   - There is NO mechanism for partners to create or share referral links/codes.
   - There is NO entity or table tracking referral links, partner attributions, or sales attributions.
   - To satisfy R2:
     - Only partners with `status === "ACTIVE"` must be allowed to create referral links.
     - A dedicated attribution model is required to link the referring partner to the referred entity.
     - Validation must check against self-referral (`referrerId === referredId`), cycle referral (A $\to$ B $\to$ A), and duplicate referral attribution (`@@unique([referredPartnerId])`).
     - A partner referral must only become eligible for rewards when the referred partner is `ACTIVE` (Approved) AND has at least 1 order with status `DELIVERED` and settled earning (`earningStatus === "AVAILABLE"`).

3. **Premise 3 (R3 Partner Levels & Promotion)**:
   - Observation shows `PerformanceLevel` exists in the database, but it represents the direct order profit split (e.g. 60% partner / 40% platform), NOT the referral commission level ladder.
   - Re-purposing `PerformanceLevel` for referral levels would break existing order calculations (`createOrder` and `performance-levels.ts`), because `PerformanceLevel.sharePercentage` is 60%, whereas referral levels in R3 are Level 1: 5%, Level 2: 10%, Level 3: 15%.
   - Therefore, a dedicated `PartnerReferralLevel` / `ReferralTier` model or explicit partner referral level fields (`referralLevel`: 1, 2, or 3, with `referralLevelEffectiveAt`) are required.
   - Promotion thresholds (3 for Level 2, 10 for Level 3) must be configured in `SystemSetting` (`SETTING_KEYS` in `src/modules/settings/defaults.ts`), with `auto_promotion_enabled` defaulting to `false` pending admin confirmation.
   - Rate calculations apply to direct referrals only; no downline or multi-level commission is permitted.

4. **Premise 4 (R4 Financial Calculation Rules & Expense Absence)**:
   - Observation shows grep search for "Expense" across the codebase yielded zero matches.
   - There is NO `Expense` model or table in Prisma.
   - To calculate $P = R - E$, $A = 70\% \times P$, $B = 30\% \times P$, and $C = B \times r$:
     - A business `Expense` model must be added to Prisma (with amount `@db.Decimal(12, 3)`, category, description, approved status, accounting period/date, createdById).
     - Revenue $R$ must be derived from actual settled orders (`status === "DELIVERED"`, COD settled).
     - Profit $P = R - E$.
     - When $P > 0$: $A = 70\% \times P$, $B = 30\% \times P$.
     - Referral commission $C = B \times r$, where $r \in \{0.05, 0.10, 0.15\}$.
     - Numeric spec validation: $R = 5,000\text{ TND}, E = 3,000\text{ TND} \implies P = 2,000\text{ TND}, A = 1,400\text{ TND}, B = 600\text{ TND} \implies C_1 = 30\text{ TND}, C_2 = 60\text{ TND}, C_3 = 90\text{ TND}$.
     - When $P \le 0$: No positive commission and no positive admin share ($A = 0, B = 0, C = 0$).
     - The sum of referral commissions against pool $B$ must never exceed $B$.

5. **Premise 5 (R5 Commission Lifecycle & Payout Safety)**:
   - Existing `FinancialTransactionType` enum (`PARTNER_EARNING`, `RETURN_COST`, `WITHDRAWAL`, `ADJUSTMENT`) does not include referral commissions.
   - A dedicated `ReferralCommission` model is required with explicit auditable statuses:
     `PENDING_VERIFICATION` $\to$ `ELIGIBLE` $\to$ `APPROVED_FOR_PAYMENT` $\to$ `PAID`, plus `REVERSED` and `REJECTED`.
   - Transitions must record `actorId`, `timestamp`, `reason`, and reference IDs.
   - Marking as `PAID` must be separate from admin approval and requires a recorded payment event (e.g. payout reference or ledger credit).
   - Idempotency keys (`@@unique` constraints) must prevent double-paying commissions for the same referral/order.

6. **Premise 6 (R8 Schema Additions & Migration Safety)**:
   - Schema additions must be purely additive:
     - Add `ReferralLink` (or referral code on Partner)
     - Add `ReferralAttribution`
     - Add `Expense`
     - Add `ReferralCommission`
     - Add referral settings to `SystemSetting`
   - Because existing migrations did not include `phone`, `experienceLevel`, `invitedByUserId`, and `PartnerStatus` enum values `PENDING`/`REJECTED`, the new migration script must reconcile these cleanly to prevent migration drift or data loss.

---

## 3. Caveats

1. **Permission Check Denial for CLI execution**:
   - `git status` execution was blocked by the environment permission prompt. All findings were extracted through read-only inspection of source code files, configuration files, and migration directories.
2. **PostgreSQL Container Runtime**:
   - Integration tests in `tests/integration/` require a live PostgreSQL container running on localhost:5433. If Docker is offline, unit tests in Vitest (`npm test`) run fine as pure unit tests without a database.
3. **PerformanceLevel vs Referral Level Distinction**:
   - The existing `PerformanceLevel` model and `/performances` admin page handle direct partner order contribution splits. Referral levels must be kept conceptually and architecturally distinct to prevent breaking the existing order profit engine.

---

## 4. Conclusion

### Summary of What Exists
1. Solid base architecture: Next.js 15 App Router, React 19, NextAuth v5, PostgreSQL, Prisma 6, and Vitest.
2. Exact money architecture already in place: `decimal.js`, 3 decimal places (millimes), `@db.Decimal(12, 3)` storage, strict ban on floating-point arithmetic.
3. Order lifecycle state machine with optimistic locking and financial snapshots frozen at creation.
4. Partner status management (`ACTIVE` = Approved, `PENDING` = Awaiting approval).
5. Immutable ledger (`FinancialTransaction`) and `AuditLog` patterns already established.

### Summary of What is Missing & Required Schema Changes
| Requirement | Missing Element | Solution / Required Schema Entity |
|---|---|---|
| **R2** Referral Permissions & Attribution | No referral link or attribution model; registration only accepts `"admin"` | Model `ReferralLink` (partnerId, code, clicks, isActive) and `ReferralAttribution` (referrerPartnerId, referredPartnerId, type, status, qualifyingOrderId, qualifiedAt). Server-side check for `Partner.status === 'ACTIVE'`. |
| **R3** Partner Levels & Promotion | No referral tier model; existing `PerformanceLevel` is for direct order contribution | Fields on `Partner` (`referralLevel`: Int default 1, `referralLevelEffectiveAt`) or model `ReferralTier`; promotion thresholds stored in `SystemSetting` (`referral.level2_threshold: 3`, `referral.level3_threshold: 10`, `referral.auto_promotion_enabled: false`). |
| **R4** Financial Calculation Rules ($P = R - E$) | No `Expense` model in database; no profit pool calculation engine ($A=70\%, B=30\%, C=B\times r$) | Model `Expense` (id, title, category, amount Decimal(12,3), status, period, approvedAt, approvedById); pure calculation module implementing the $R-E$ pool distribution with exact decimal precision and allocation cap. |
| **R5** Commission Lifecycle & Payout | No referral commission entity; `FinancialTransactionType` lacks referral commission | Model `ReferralCommission` (attributionId, referrerPartnerId, amount Decimal(12,3), status: `PENDING_VERIFICATION`, `ELIGIBLE`, `APPROVED_FOR_PAYMENT`, `PAID`, `REVERSED`, `REJECTED`, idempotencyKey, approval and payout audit fields). |
| **R6 & R7** Admin & Partner Dashboards | No referral or commission UI views in admin or partner dashboards | Add referral management & queue to admin; add referral link, status, and commission breakdown to partner dashboard. |
| **R8** Database Migrations | Unmigrated fields exist in `schema.prisma` (`phone`, `experienceLevel`, `invitedByUserId`, `PENDING`/`REJECTED`) | Prepare an additive migration that bundles the unmigrated fields alongside the new referral and expense models without dropping existing data. |

---

## 5. Verification Method

To independently verify all findings in this report:

1. **Verify package dependencies and scripts**:
   - Inspect `d:\e-com collab\package.json` lines 6–22 and lines 23–58.
2. **Verify Prisma schema and existing models**:
   - Inspect `d:\e-com collab\prisma\schema.prisma` lines 11–450.
3. **Verify existing migrations**:
   - Inspect `d:\e-com collab\prisma\migrations\20260926120000_init\migration.sql` line 11 (enum `PartnerStatus`) vs. `schema.prisma` line 462.
   - Inspect `d:\e-com collab\prisma\migrations\20260928222342_performance_levels\migration.sql` lines 8–21 (confirms `PerformanceLevel` model).
4. **Verify currency and precision**:
   - Inspect `d:\e-com collab\src\lib\money.ts` lines 7–18.
   - Run unit tests: `npm test tests/money.test.ts`.
5. **Verify existing test suite**:
   - Inspect all 23 test files listed in Section 1.7.
   - Run existing unit test suite: `npx vitest run`.
6. **Verify absence of Expense model**:
   - Run ripgrep for exact string: `rg "model Expense" prisma/`.
7. **Invalidation Conditions**:
   - If `Expense` or `ReferralAttribution` already exists under another name in `prisma/schema.prisma` (verified: they do not).
   - If currency uses 2 decimals instead of 3 (verified: 3 decimal places millimes is enforced everywhere).
