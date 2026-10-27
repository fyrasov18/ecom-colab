# Requirement R1: Mandatory Pre-Implementation Audit Summary

**Date**: 2026-10-09  
**Platform**: E-commerce Collaboration Platform (`d:\e-com collab`)  
**Status**: Completed by 3 Specialist Explorers (Schema/DB, Auth/Referral, Orders/Financials)

---

## 1. Executive Summary
This audit inspects the entire repository prior to any code modifications to establish a verified baseline for implementing Requirements R1 through R10 (Referral System, Partner Levels, Referral Commissions, and Profit Distribution). The platform is a Next.js 15 App Router application with PostgreSQL 16, Prisma ORM, Auth.js v5, and Decimal.js. The implementation will be purely additive and safe for existing data.

---

## 2. Component Audits

### 2.1 Framework, Database & Migrations
- **Tech Stack**: Next.js 15.5.26 (App Router), React 19.3.0, Prisma 6.19.3, NextAuth 5.0.0-beta.32, Decimal.js 10.6.0, Vitest 5.0.1.
- **Database**: PostgreSQL 16 Alpine mapped to port `5433:5432` (Docker compose).
- **Money Handling**: Tunisian Dinar (TND / DT) with 3 decimal places (millimes). All monetary columns use `@db.Decimal(12, 3)`. All calculations use `decimal.js` with `ROUND_HALF_UP` (`src/lib/money.ts`). Floating-point math is strictly forbidden.
- **Existing Models**: 17 Prisma models (`User`, `Partner`, `Product`, `Order`, `OrderItem`, `Shipment`, `Return`, `Wallet`, `FinancialTransaction`, `Withdrawal`, `PerformanceLevel`, `AuditLog`, `SystemSetting`, etc.).
- **Schema & Migration Drift**:
  - `PartnerStatus` enum in `schema.prisma` contains `PENDING` and `REJECTED`, and `Partner` model contains `phone`, `experienceLevel`, and `invitedByUserId`.
  - These are not present in baseline migration files in `prisma/migrations/`.
  - *Action*: New migrations must safely reconcile these unmigrated fields alongside new models without data loss.

### 2.2 Authentication, Authorization & Partner Approval Workflow
- **Auth Strategy**: Stateless JWT sessions in NextAuth v5.
- **Partner Approval**:
  - Registered partners default to `PartnerStatus.PENDING`.
  - Admin approves partner by changing status to `PartnerStatus.ACTIVE`.
  - "Approved Partner" is conclusively identified by `PartnerStatus.ACTIVE`.
- **Identified Defect**:
  - Infinite 307 redirect loop: Unapproved partners (`PENDING`) can log in because `User.status === "ACTIVE"`. `requireSession` redirects to `/login?error=pending`, but `middleware.ts` redirects authenticated users on `/login` to `/tableau-de-bord`. Needs clean handling.

### 2.3 Referral Code, Attribution & Storefront Gaps
- **Current State**: No referral links, codes, or tracking cookies exist. Registration currently accepts only hardcoded `"admin"` as the invitation code (`src/modules/registration/service.ts`).
- **Storefront Gap ("Sales Referrals")**:
  - The platform is a private partner workspace where authenticated partners input orders manually for offline COD delivery. There is **no public consumer storefront, no visitor shopping cart, and no consumer checkout**.
  - As directed by R2, Sales Referrals cannot be reliably attributed via browser cookies without creating a public consumer storefront from scratch.
  - **Partner Referrals** (an approved partner referring a new partner via referral code or registration link) fit the existing architecture perfectly and can be reliably tracked.

### 2.4 Order Lifecycle & Delivery / COD Settlement
- **Order States**: Orders start at `CONFIRMED` (there is no `PLACED` status). Full state machine: `CONFIRMED` $\to$ `VALIDATED` $\to$ `PREPARING` $\to$ `PACKAGED` $\to$ `SHIPPED` $\to$ `IN_DELIVERY` $\to$ `DELIVERED`.
- `DELIVERED` is non-terminal to accommodate returns during the 48-hour settlement window.
- **Delivery & COD Reality**: There is no courier cash collection API integration. Settlement occurs when the 48-hour holding window (`settlementDueAt = deliveredAt + 48h`) elapses and `settleDueEarnings()` transitions `order.earningStatus` to `AVAILABLE`.
- *Definition of Qualifying Order*: An order where `order.status === "DELIVERED"` and `order.earningStatus === "AVAILABLE"`.

### 2.5 Expenses & Financial Records
- **Expense Model Gap**: No `Expense` model exists in the database. Only per-order costs (`productCost`, `packagingCost`, `deliveryCost`) are tracked.
- *Action*: Introduce an `Expense` model to record approved business expenses $E$ for calculating profit $P = R - E$.
- **Financial Records**:
  - Immutable ledger in `FinancialTransaction`, cached in `Wallet`, with two-phase withdrawal (`REQUESTED` $\to$ `APPROVED` $\to$ `PAID`).
  - Existing `PerformanceLevel` model is used for direct order contribution sharing, NOT referral tiers.
  - *Action*: Introduce dedicated referral levels (Level 1: 5%, Level 2: 10%, Level 3: 15% of pool B) and promotion thresholds (3 for Level 2, 10 for Level 3) stored as configurable settings.

### 2.6 Security & Integrity Vulnerabilities to Guard Against
1. **Self-Referral**: Prevent a partner from referring themselves (matching email, phone, or partner ID).
2. **Referral Cycles**: Enforce direct referrals only; reject cyclic attributions (A $\to$ B $\to$ A).
3. **Unapproved Partners**: Enforce server-side check that only `PartnerStatus.ACTIVE` partners can generate or redeem referral links.
4. **Duplicate Attribution**: Enforce `@@unique([referredPartnerId])`.
5. **IDOR Prevention**: Fix existing pattern in `cancelOwnOrder` by verifying `order.partnerId === session.user.partnerId`. All referral actions must strictly read `session.user.partnerId`.
6. **Double-Counting & Race Conditions**: Wrap qualification checks and commission calculations in database transactions with unique idempotency keys.

---

## 3. Pre-Implementation Audit Sign-Off
All 6 areas required by Requirement R1 have been thoroughly audited with exact file lines and evidence verified. Architectural plans and feature inventories are ready to be formulated in `PROJECT.md`.
