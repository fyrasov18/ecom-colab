# Survey Report: Orders, Financials, Commission Lifecycle & Dashboards

- **Specialist**: Survey Explorer 3 (Orders, Financials & Dashboard Specialist)
- **Working Directory**: `d:\e-com collab\.agents\teamwork\teamwork_preview_explorer_survey_3`
- **Scope**: Requirements R1, R4, R5, R6, R7 against existing code in `d:\e-com collab`
- **Date**: 2026-10-09

---

## 1. Observation

### 1.1 Order Lifecycle & Statuses
- **Prisma Schema (`prisma/schema.prisma:535-547`)**:
  ```prisma
  enum OrderStatus {
    CONFIRMED
    VALIDATED
    ON_HOLD
    PREPARING
    PACKAGED
    SHIPPED
    IN_DELIVERY
    DELIVERED
    REFUSED
    RETURNED
    CANCELLED
  }
  ```
  *Key Observation*: There is **no `PLACED` status**. Order creation starts directly at `CONFIRMED` (`prisma/schema.prisma:205` `@default(CONFIRMED)`).

- **Order Creation (`src/modules/orders/create.ts:31-39`, `88-190`)**:
  - Offline customer confirmation is collected upfront (`partnerConfirmedAt: new Date()`).
  - Unit selling price is validated from the product table (`product.sellingPrice`), never from client input (`src/modules/orders/create.ts:88-91`).
  - Order-level snapshot fields frozen upon creation:
    - `unitSellingPrice: Decimal(12, 3)`
    - `productCost: Decimal(12, 3)` (`purchaseCost * quantity`)
    - `packagingCost: Decimal(12, 3)` (`packagingCost * quantity`)
    - `deliveryCost: Decimal(12, 3)` (flat delivery cost per order)
    - `contribution: Decimal(12, 3)` = `revenue - productCost - packagingCost - deliveryCost`
    - `commissionType: CommissionType`, `commissionValue: Decimal`, `commissionSource: CommissionSource`
    - `partnerEarning: Decimal(12, 3)`
    - `platformShare: Decimal(12, 3)`
    - `performanceLevelName: String?`, `partnerSharePercentage: Decimal(5, 2)?`
  - Stock is decremented inside transaction: `stockQuantity: { decrement: quantity }` (`src/modules/orders/create.ts:192-195`).

- **State Machine Transitions (`src/modules/orders/transitions.ts:27-68`)**:
  - `CONFIRMED` → `VALIDATED` (Admin/Ops) or `CANCELLED` (Admin or Partner, `restock: true`, reason required).
  - `VALIDATED` → `PREPARING` | `ON_HOLD` | `CANCELLED`.
  - `ON_HOLD` → dynamic `RESUME` back to `statusBeforeHold` (Admin/Ops only) or `CANCELLED`.
  - `PREPARING` → `PACKAGED` | `ON_HOLD` | `CANCELLED`.
  - `PACKAGED` → `SHIPPED` | `ON_HOLD` | `CANCELLED`.
  - `SHIPPED` → `IN_DELIVERY`.
  - `IN_DELIVERY` → `DELIVERED` | `REFUSED` | `RETURNED` | `ON_HOLD`.
  - `DELIVERED` → `REFUSED` | `RETURNED` (*Delivered is intentionally NOT terminal* to allow post-delivery returns during settlement period; `src/modules/orders/transitions.ts:61-64`, `132-137`).
  - Terminal statuses: `REFUSED`, `RETURNED`, `CANCELLED` (`src/modules/orders/transitions.ts:133-137`).

- **Transition Execution & Side Effects (`src/modules/orders/status.ts:57-193`)**:
  - Optimistic locking: `tx.order.updateMany({ where: { id: orderId, status: order.status }, data })` (`src/modules/orders/status.ts:103-111`).
  - `to === "SHIPPED"`: creates `Shipment` record if not present (`src/modules/orders/status.ts:67-69`).
  - `to === "DELIVERED"`:
    - Sets `data.deliveredAt = now`.
    - Reads settlement window: `hours = await getSettlementPeriodHours(tx)` (default: 48h).
    - Sets `data.settlementDueAt = now + hours * 3600000` (`src/modules/orders/status.ts:58-64`).
    - Upserts `Shipment.deliveredAt = now`.
    - Calls `createPartnerEarning(tx, ...)` to create pending ledger earning for the selling partner (`src/modules/orders/status.ts:128-139`).
  - `to === "REFUSED"` or `"RETURNED"`:
    - Upserts `Return` record with `kind: to, reason: trimmedReason`.
    - Calls `applyReturnCostRule(tx, ...)` (`src/modules/orders/status.ts:141-169`).
  - Status history: creates `OrderStatusHistory` row (`src/modules/orders/status.ts:113-121`).
  - Audit: calls `recordAudit(tx, ...)` (`src/modules/orders/status.ts:171-183`).
  - Notifications: calls `notifyPartnerAccount(tx, ...)` (`src/modules/orders/status.ts:187-192`).

---

### 1.2 Delivery & COD Collection Tracking
- **Shipment Model (`prisma/schema.prisma:274-284`)**:
  ```prisma
  model Shipment {
    id             String    @id @default(cuid())
    orderId        String    @unique
    carrier        String?
    trackingNumber String?
    shippedAt      DateTime?
    deliveredAt    DateTime?
    createdAt      DateTime  @default(now())
    updatedAt      DateTime  @updatedAt
    order          Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  }
  ```
- **Order Model Delivery & Settlement Fields (`prisma/schema.prisma:221-224`)**:
  - `deliveredAt`: `DateTime?`
  - `settlementDueAt`: `DateTime?`
  - `earningStatus`: `EarningStatus @default(NONE)` (`NONE`, `PENDING`, `AVAILABLE`, `REVERSED`)
- **Settlement Execution (`src/modules/finance/ledger.ts:156-207`, `src/app/api/cron/settle/route.ts`)**:
  - `settleDueEarnings` queries `financialTransaction` where `status: "PENDING", availableAt: { lte: now }`.
  - Updates matching transactions to `status: "AVAILABLE"`.
  - Updates matching orders `earningStatus: "AVAILABLE"`.
  - Recomputes wallets and notifies partners.
  - Can be triggered by cron GET `/api/cron/settle` (secured by `CRON_SECRET`) or manual button in `/finance`.
- **Absence of Courier COD Collection Tracking**:
  - Neither `Order` nor `Shipment` has any fields for COD cash collection, courier remittance, or courier payment receipt (e.g., no `isCodCollected`, `codAmountCollected`, `courierRemittanceId`, `courierSettledAt`).
  - "Settlement" in the current codebase strictly means: *the elapsed time holding window (`settlementDueAt = deliveredAt + 48h`) has expired*. There is no courier settlement verification.

---

### 1.3 Expenses Tracking
- **Absence of `Expense` Model**:
  - Verified across `prisma/schema.prisma` lines 1 to 589: **No `Expense` model exists**.
  - Grep search for `Expense` across `src/` yielded **0 results**.
- **Existing Cost Fields (strictly order-level COGS)**:
  - Product model: `purchaseCost`, `packagingCost`, `deliveryCost` (`prisma/schema.prisma:112-114`).
  - Order model: `productCost`, `packagingCost`, `deliveryCost`, `contribution` (`prisma/schema.prisma:211-214`).
  - Return model: `costCharged` (`prisma/schema.prisma:291`).
- **Attributable Period/Scope Expenses**:
  - There is no model, table, or interface to record platform expenses $E$ (e.g. ad spend, operational costs, carrier charges, marketing, period overhead).

---

### 1.4 Existing Financial Records & Commission Logic
- **FinancialTransaction Model (`prisma/schema.prisma:310-333`)**:
  - Fields: `id`, `partnerId`, `orderId?`, `withdrawalId?`, `type`, `amount`, `currency ("TND")`, `status ("PENDING"|"AVAILABLE")`, `availableAt?`, `description?`, `idempotencyKey @unique`, `createdById?`, `createdAt`.
  - Enum `FinancialTransactionType` (`prisma/schema.prisma:556-561`):
    - `PARTNER_EARNING`
    - `RETURN_COST`
    - `WITHDRAWAL`
    - `ADJUSTMENT`
  - *Key Observation*: Does not contain any referral commission type (e.g., `REFERRAL_COMMISSION`).
- **Wallet Model (`prisma/schema.prisma:298-309`, `src/modules/finance/rules.ts:70-97`)**:
  - Cached balances derived from ledger: `availableBalance`, `pendingBalance`, `totalEarned`, `totalWithdrawn`.
- **Withdrawal Lifecycle (`prisma/schema.prisma:334-355`, `src/modules/finance/withdrawals.ts:22-327`)**:
  - Statuses: `REQUESTED` → `UNDER_REVIEW` → `APPROVED` → `PAID` (or `REJECTED`).
  - Partner creates request: `requestWithdrawal` (one active request allowed, checks `withdrawableAmount`).
  - Admin reviews & approves: `approveWithdrawal` (no ledger change).
  - Admin records payment: `payWithdrawal` (creates `FinancialTransaction` of type `WITHDRAWAL` with negative amount and `idempotencyKey: withdrawal-pay:${id}`).
- **PerformanceLevel Model (`prisma/schema.prisma:88-105`, `src/modules/finance/performance-levels.ts`)**:
  - Fields: `id`, `name`, `description?`, `sharePercentage Decimal(5, 2)`, `criteria Json?`, `isActive Boolean`, `sortOrder Int`.
  - Role in existing system:
    - Used strictly in `createOrder` (`src/modules/orders/create.ts:109-133`) to determine the *selling* partner's share percentage of `Order.contribution`.
    - It is **not** a referral tier ladder (Level 1 = 5%, Level 2 = 10%, Level 3 = 15%).
- **Existing Commission Resolution (`src/modules/finance/commission.ts:21-47`)**:
  - Resolution chain: `PartnerProduct` override → `Partner` default → `Product` default → `GlobalSetting (finance.global_commission)`.
  - Determines selling partner's earnings on direct order sales.

---

### 1.5 Existing UI Routes and Components
- **Architecture**: Next.js App Router with server components, server actions, and React client components. Shared layout `AppShell` (`src/components/layout/app-shell.tsx`).
- **Admin Dashboard (`src/app/(admin)/dashboard/page.tsx`)**:
  - Real-time KPIs: active partners, orders today, delivered orders, in-delivery orders, refused/returned, awaiting validation, pending partner earnings, total available balance.
  - Operational alert banners (low stock, pending withdrawals, on-hold orders, returns to process).
  - Recent orders table.
- **Admin Finance (`src/app/(admin)/finance/page.tsx`)**:
  - Overview cards: available total, pending total, total earned, total withdrawn, return costs, active withdrawal requests.
  - Settlement queue banner (`queue.dueNowCount`, `queue.scheduledCount`).
  - Withdrawal requests queue with `WithdrawalActions` (review, approve, pay with transaction reference, reject with reason).
  - Top 10 partner wallets table.
  - Paginated immutable ledger transactions journal.
- **Admin Partners (`src/app/(admin)/partenaires/page.tsx` & `[id]/page.tsx`)**:
  - Partner list with status filtering (`ACTIVE`, `PENDING`, `SUSPENDED`, `REJECTED`, `CLOSED`).
  - Partner detail: profile info, "Invité par" (`partner.invitedBy`), status changer, finance summary card, social accounts, assigned performance level, assigned products with custom commission overrides.
- **Admin Settings (`src/app/(admin)/parametres/page.tsx`)**:
  - Global finance settings form (settlement period hours, min withdrawal amount, return cost rule, global commission).
  - Performance levels section (create/update/delete/activate tiers).
- **Partner Dashboard (`src/app/(partner)/tableau-de-bord/page.tsx`)**:
  - KPIs: available balance, delivery rate %, in delivery count, return rate %.
  - Financial summary: total earned, total withdrawn, assigned products count.
  - Recent orders card.
- **Partner Wallet (`src/app/(partner)/portefeuille/page.tsx`)**:
  - Available balance, pending balance, total earned, total withdrawn.
  - Withdrawal request form (`WithdrawForm`).
  - Pending earnings table with scheduled availability dates (`availableAt`).
  - Active and historical withdrawal requests table.
  - Immutable ledger history table.
- **Partner Performance (`src/app/(partner)/mes-performances/page.tsx`)**:
  - Total orders, delivery rate, return rate, turnover, basket size, total earned.
  - Performance by product table (`PartnerProductPerfTable`).
- **Partner Orders (`src/app/(partner)/mes-commandes/page.tsx` & `[id]/page.tsx`)**:
  - Pipeline progression tracker (`CONFIRMED` → `VALIDATED` → `PREPARING` → `PACKAGED` → `SHIPPED` → `IN_DELIVERY` → `DELIVERED`).
  - Order cancellation form (allowed only while `CONFIRMED`).

---

## 2. Logic Chain

1. **Order Lifecycle Analysis**:
   - *Observation*: `OrderStatus` does not contain `PLACED`. Orders enter the system as `CONFIRMED`.
   - *Logic*: In this platform's business model, customer orders are captured offline by partners and created directly as `CONFIRMED`. Any requirement referring to "placed" corresponds to `CONFIRMED`.
   - *Observation*: `DELIVERED` status is non-terminal (`src/modules/orders/transitions.ts:61-64`) and can transition to `REFUSED` or `RETURNED`.
   - *Logic*: This design intentionally enables returns during the 48-hour settlement window. Thus, qualifying referral events must not only check `status === "DELIVERED"`, but ensure the settlement window has expired and the earning remains valid (or explicitly verify settlement).

2. **Delivery & COD Settlement Analysis**:
   - *Observation*: `Shipment` tracks only carrier and tracking number. There is no courier remittance or cash collection tracking.
   - *Observation*: Order settlement occurs exclusively when `order.settlementDueAt <= now` via `settleDueEarnings()`.
   - *Logic*: Under the current capabilities of the system, a "delivered and settled order" is an order where:
     a) `order.status === "DELIVERED"`,
     b) `order.deliveredAt` is not null, and
     c) `order.earningStatus === "AVAILABLE"` (i.e. the holding window has elapsed and `settleDueEarnings` has run) without being `REVERSED`.
   - Any external courier COD reconciliation feature is not present in the current schema. To support R2 ("according to the actual capabilities of the existing system"), the existing settlement holding window + `earningStatus === "AVAILABLE"` provides the authoritative signal.

3. **Expenses Tracking Analysis**:
   - *Observation*: No `Expense` model exists in `schema.prisma`.
   - *Observation*: Orders record unit-level costs (`productCost`, `packagingCost`, `deliveryCost`).
   - *Logic*: To compute $P = R - E$ as required by R4:
     - If $E$ is calculated at the order scope: $E_{order} = \text{productCost} + \text{packagingCost} + \text{deliveryCost}$, then $P_{order} = R_{order} - E_{order}$ (which corresponds exactly to `Order.contribution`).
     - If $E$ represents period-level or platform-level approved attributable expenses (e.g., ad spend, platform charges), a dedicated `Expense` model (or periodic expense ledger) must be introduced in the schema. Without it, platform-wide profit sharing for a period cannot account for non-order expenses.

4. **Existing Financial Records vs Referral Requirements**:
   - *Observation*: Currently, `FinancialTransaction` only handles `PARTNER_EARNING` (the selling partner's cut), `RETURN_COST`, `WITHDRAWAL`, and `ADJUSTMENT`.
   - *Observation*: The current `PerformanceLevel` model is used for the selling partner's order contribution share, not referral tiers.
   - *Logic*: R3 and R4 define referral commissions ($C = B \times r$) on the 30% remaining pool $B$ for approved referring partners at Level 1 (5%), Level 2 (10%), Level 3 (15%). This is an entirely distinct financial concept that requires:
     - Referral tracking between partners (referrer and referred partner).
     - Referral tier ladder / promotion configuration.
     - A referral commission lifecycle and transaction model.

5. **Dashboard Gaps**:
   - *Observation*: Admin UI has no referral management, no qualifying referral tracker, no commission approval queue, and no display of the $R, E, P, A, B, C$ profit split.
   - *Observation*: Partner UI has no referral link generation, no referred partner list, no referral tier ladder, and no referral commission tracking.
   - *Logic*: Both Admin and Partner dashboards require additive sections to fulfill R6 and R7 without disrupting existing order, logistics, and wallet functionality.

---

## 3. Caveats

1. **Courier API & COD Settlement**:
   - There are no third-party courier webhook integrations (e.g. Aramex, Yalidine). The system relies on manual operator status updates to `DELIVERED` and an automated 48-hour settlement window (`settlementDueAt`).
2. **Accounting Scope for $E$**:
   - R4 defines $E$ as "all approved, attributable expenses for the same accounting scope and period". The existing platform only records per-order COGS (`productCost`, `packagingCost`, `deliveryCost`). Whether $E$ should be computed per-order ($E_{order}$) or per-period ($E_{period}$) requires an explicit schema design decision.
3. **Existing `PerformanceLevel` Name Collision**:
   - The database already contains a model called `PerformanceLevel` used for the selling partner's percentage share of an order. R3 refers to "Partner Levels" (Level 1, 2, 3) for referral commissions. Care must be taken not to confuse or break the existing `PerformanceLevel` table; a distinct model (such as `ReferralLevel` or `PartnerReferralLevel`) avoids collisions.
4. **Registration Invitation Code**:
   - In `src/modules/registration/service.ts`, the registration form currently accepts only `"admin"` as the invitation code and sets `invitedByUserId` to an Admin user. Partners cannot invite other partners with their own code without updating the registration logic.

---

## 4. Conclusion

### Summary of Audit Findings
1. **Order Lifecycle**: Robust, transactional, and audit-logged state machine (`src/modules/orders/transitions.ts`). Statuses start at `CONFIRMED` (no `PLACED`). Fulfilment goes through `VALIDATED` → `PREPARING` → `PACKAGED` → `SHIPPED` → `IN_DELIVERY` → `DELIVERED`. `DELIVERED` is non-terminal to accommodate returns during the settlement window.
2. **Delivery & COD**: Tracked via `Shipment` and `Order` timestamps (`deliveredAt`, `settlementDueAt`). No courier COD remittance tracking exists. Settlement is enforced via time window (`settlementDueAt = deliveredAt + 48h`) and `earningStatus: "AVAILABLE"`.
3. **Expenses**: No `Expense` model exists in the database. Only per-order costs (`productCost`, `packagingCost`, `deliveryCost`) are tracked.
4. **Financial Records**: Immutable ledger in `FinancialTransaction`, cached in `Wallet`, with two-phase withdrawal (`REQUESTED` → `APPROVED` → `PAID`). No referral commission records exist.
5. **Dashboards**: Well-structured Admin and Partner dashboards exist for orders, logistics, sales performance, and direct sales wallet. Neither dashboard contains any referral or referral commission UI.

### Identified Gaps Matrix

| Requirement | Description | Current State in Repository | Implementation Gap |
|---|---|---|---|
| **R1** | Pre-implementation audit | Completed herein | None |
| **R2** | Referral Permissions & Attribution | Only `"admin"` accepted; `invitedByUserId` set to Admin | Need server-side partner referral link/code generation for approved partners; referral attribution; self-referral/cycle prevention |
| **R3** | Partner Levels (L1: 5%, L2: 10%, L3: 15%) | `PerformanceLevel` exists but is used for sales share | Need dedicated referral tier model/config with configurable promotion thresholds (3 & 10 qualified referrals) |
| **R4** | Financial Calculation Rules ($R - E = P$, $A = 70\%$, $B = 30\%$, $C = B \times r$) | Per-order contribution = $R - E_{order}$, split directly between partner & platform | Need formal calculation engine for $P, A, B, C$, handling pool allocation, negative profit protection, and attributable expenses |
| **R5** | Commission Lifecycle (Pending Verification → Eligible → Approved → Paid) | Only exists for general withdrawals | Need dedicated Commission model and auditable lifecycle transitions |
| **R6** | Admin Dashboard | Covers orders, logistics, finance, partners, settings | Missing referral management, attribution view, qualifying order review, commission approval queue, and audit breakdown |
| **R7** | Partner Dashboard | Covers orders, sales stats, direct wallet | Missing referral link/code display, referred partner counts/statuses, level progress bar, and referral commission history |

---

## 5. Verification Method

To independently verify these findings, inspect the following exact files:

1. **Order Lifecycle & Transitions**:
   - Inspect `prisma/schema.prisma:535-547` for `OrderStatus` enum values.
   - Inspect `src/modules/orders/transitions.ts:27-68` for transition mappings and terminal statuses.
   - Inspect `src/modules/orders/status.ts:57-193` for `changeOrderStatus` execution, optimistic locking, and side effects.
2. **Delivery & COD Settlement**:
   - Inspect `prisma/schema.prisma:274-284` for `Shipment` schema fields.
   - Inspect `src/modules/finance/ledger.ts:156-207` for `settleDueEarnings` logic.
   - Inspect `src/modules/settings/defaults.ts:23-29` for default 48-hour settlement period.
3. **Expenses**:
   - Inspect `prisma/schema.prisma` lines 1 to 589 — confirm absence of `model Expense`.
   - Inspect `src/modules/orders/create.ts:88-104` for order cost computation.
4. **Existing Finance & Withdrawals**:
   - Inspect `prisma/schema.prisma:310-355` for `FinancialTransaction`, `Wallet`, and `Withdrawal` models.
   - Inspect `src/modules/finance/withdrawals.ts:280-327` for `payWithdrawal` recording.
5. **Dashboards**:
   - Inspect `src/app/(admin)/dashboard/page.tsx` and `src/app/(admin)/finance/page.tsx` for Admin views.
   - Inspect `src/app/(partner)/tableau-de-bord/page.tsx` and `src/app/(partner)/portefeuille/page.tsx` for Partner views.
   - Inspect `src/components/layout/app-shell.tsx:58-120` for navigation links.

### Invalidation Conditions
- If an `Expense` model or migration was added in another branch.
- If courier API integration files exist in an untracked directory.
- If any referral commission calculation functions already exist outside `src/modules/finance`.
*(All verified as non-existent in this workspace)*.
