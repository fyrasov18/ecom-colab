# Handoff Report: Survey Explorer 2 (Auth & Referral Specialist)

**Working Directory**: `d:\e-com collab\.agents\teamwork\teamwork_preview_explorer_survey_2`  
**Date**: 2026-10-09  
**Scope**: Requirement R1 & R2 Pre-Implementation Audit (Authentication, Authorization, Partner Approval, Referral Architecture, Server Actions, Security & Edge Cases)

---

## 1. Observation

### 1.1 Authentication, Session Management, Roles, and User Models

1. **Framework & Auth Provider**:
   - `package.json` lines 37-38: Next.js `15.5.26`, React `19.3.0`, NextAuth `5.0.0-beta.32` (Auth.js v5), Prisma `@prisma/client` `6.19.3`, Zod `3.25.76`.
   - `src/lib/auth-config.ts` lines 62-70: Stateless JWT sessions:
     ```typescript
     session: {
       strategy: "jwt",
       maxAge: 12 * 60 * 60, // 12 hours
       updateAge: 60 * 60,   // 1 hour
     }
     ```
   - `src/lib/auth-config.ts` lines 81-101: JWT and Session callbacks map:
     ```typescript
     jwt({ token, user }) {
       if (user) {
         token.id = user.id;
         token.role = (user as { role?: string }).role;
         token.partnerId = (user as { partnerId?: string | null }).partnerId ?? null;
         token.firstName = (user as { firstName?: string }).firstName ?? "";
         token.lastName = (user as { lastName?: string }).lastName ?? "";
       }
       return token;
     }
     ```
     *Crucial Observation*: `partner.status` is **never stored** in the JWT token or the Session object (`src/types/next-auth.d.ts` lines 4-31 confirms `status` is omitted from `Session["user"]` and `JWT`).

2. **Login Verification in `src/lib/auth.ts`**:
   - Lines 61-82:
     ```typescript
     const user = await prisma.user.findUnique({
       where: { email: normalizedEmail },
       include: { partner: true },
     });
     if (!user || user.status !== "ACTIVE") {
       // returns null
     }
     ```
     *Crucial Observation*: Login checks `user.status === "ACTIVE"`. However, when a partner registers, their `User.status` is `"ACTIVE"` while their `Partner.status` is `"PENDING"`. Therefore, **a PENDING partner CAN successfully log in via `lib/auth.ts`**.

3. **Roles & Navigation Namespaces (`src/lib/roles.ts`)**:
   - Lines 5-6: `ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"]`, `ALL_ROLES = ["SUPER_ADMIN", "ADMIN", "PARTNER"]`.
   - Lines 8-12: `ROLE_HOME.PARTNER = "/tableau-de-bord"`, `ROLE_HOME.ADMIN = "/dashboard"`.
   - Lines 19-43: Strict path prefixes:
     - `ADMIN_PREFIXES`: `["/dashboard", "/commandes", "/produits", "/partenaires", "/clients", "/logistique", "/finance", "/performances", "/marketing", "/notifications", "/parametres", "/audit"]`.
     - `PARTNER_PREFIXES`: `["/tableau-de-bord", "/catalogue", "/nouvelle-commande", "/mes-commandes", "/mes-performances", "/portefeuille", "/mes-notifications"]`.

4. **Middleware (`src/middleware.ts`)**:
   - Edge-safe auth middleware running `NextAuth(authConfig)`.
   - Lines 56-70:
     - Unauthenticated users redirected to `/login`.
     - Authenticated users attempting to visit `/login` or `/register` are redirected to `home` (`ROLE_HOME[user.role]`, which is `/tableau-de-bord` for partners).
     - Non-admins blocked from `ADMIN_PREFIXES`; non-partners blocked from `PARTNER_PREFIXES`.
     - *Observation*: Middleware does **not** check `Partner.status` because Edge runtime cannot query Prisma.

5. **RBAC Gate (`src/lib/rbac.ts`)**:
   - Lines 20-36:
     ```typescript
     export async function requireSession(roles?: Role[]): Promise<SessionUser> {
       const session = await auth();
       if (!session?.user) redirect("/login");
       const user = session.user as SessionUser;
       if (roles && !roles.includes(user.role)) {
         redirect(ROLE_HOME[user.role]);
       }
       // PENDING/REJECTED partners must not reach the partner area...
       if (user.role === "PARTNER" && user.partnerId) {
         const status = await getPartnerStatus(user.partnerId);
         if (status !== "ACTIVE") {
           redirect("/login?error=pending");
         }
       }
       return user;
     }
     ```
   - *Direct Finding — Infinite Redirect Loop Bug*:
     When a partner has `Partner.status !== "ACTIVE"` (e.g., `PENDING`, `SUSPENDED`, `REJECTED`):
     1. They sign in; credentials succeed because `User.status === "ACTIVE"`.
     2. Redirected to `/tableau-de-bord`.
     3. `src/app/(partner)/layout.tsx` calls `requireSession(["PARTNER"])`.
     4. `requireSession` queries DB, sees `status !== "ACTIVE"`, calls `redirect("/login?error=pending")`.
     5. Browser sends request to `/login?error=pending` carrying the valid session cookie.
     6. `src/middleware.ts` lines 59-60 executes: `if (user) { if (pathname === "/login") return redirectTo(home); }` -> redirects back to `/tableau-de-bord`!
     7. **Browser gets caught in an infinite 307 redirect loop**.

---

### 1.2 Partner Approval Workflow

1. **Partner Registration (`src/modules/registration/`)**:
   - `src/modules/registration/schemas.ts` lines 17-43: Zod schema `registrationSchema` requires `fullName`, `email`, `phone` (Tunisian 8 digits), `password`, `confirmPassword`, `invitationCode`, `experience`, `termsAccepted`.
   - `src/modules/registration/service.ts` lines 53-69:
     ```typescript
     // Invitation: only "admin" is accepted. It is NOT a role — it resolves to an
     // existing Admin user recorded as inviter. Case-insensitive, trimmed.
     if (input.invitationCode.trim().toLowerCase() !== "admin") {
       return {
         ok: false,
         error: "Code d'invitation invalide.",
         fieldErrors: { invitationCode: "Code d'invitation invalide." },
       };
     }
     const inviter = await prisma.user.findFirst({
       where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, status: "ACTIVE" },
       orderBy: [{ role: "asc" }, { createdAt: "asc" }],
       select: { id: true },
     });
     ```
   - `src/modules/registration/service.ts` lines 84-119: Atomic transaction creates:
     - `User`: `role: "PARTNER"`, `status: "ACTIVE"`.
     - `Partner`: `code: await nextPartnerCode()` (generates `P001`, `P002`, etc.), `status: "PENDING"`, `invitedByUserId: inviter.id`.
     - `Wallet`: created with zero balances.
     - `AuditLog`: `action: "PARTNER_REGISTERED"`.

2. **Partner Status Lifecycle & State Transitions**:
   - Enum `PartnerStatus` in `prisma/schema.prisma` lines 462-468:
     - `ACTIVE` (Approved)
     - `PENDING` (Initial registration state)
     - `SUSPENDED` (Temporarily barred)
     - `REJECTED` (Refused application)
     - `CLOSED` (Terminated account)
   - `src/modules/partners/service.ts` lines 80-98: `setPartnerStatus(partnerId, status, actorId)` executes inside `prisma.$transaction`, updates `Partner.status`, and logs audit `PARTNER_STATUS_CHANGED`.
   - `src/app/(admin)/partenaires/actions.ts` lines 18-26: `changePartnerStatus(formData)` verifies session `requireSession(["SUPER_ADMIN", "ADMIN"])`, parses status with Zod `partnerStatusSchema`, and calls `setPartnerStatus`.

3. **Admin Approval UI (`src/app/(admin)/partenaires/[id]/page.tsx`)**:
   - Lines 184-220: When `partner.status === "PENDING"`, an alert card "Demande d'accès en attente" renders with two buttons:
     - "Approuver": submits `status: "ACTIVE"`.
     - "Rejeter": submits `status: "REJECTED"`.
   - Lines 159-180: Header dropdown allows changing status between all 5 enum values at any time.

4. **Where Status Is Enforced**:
   - Enforced solely in `src/lib/rbac.ts` line 30 via `getPartnerStatus(user.partnerId)`.
   - Only `status === "ACTIVE"` is granted access to the partner dashboard and partner actions.

---

### 1.3 Audit of Existing Referral Code, Tracking, and Attribution

1. **Grep across the entire repository**:
   - Full case-insensitive search for `referral`, `affiliate`, `utm`, `cookie`, `attribution` in `src/`:
     - `referral`: 0 matches in `src/`.
     - `affiliate`: 0 matches in `src/`.
     - Only matches are comments in `prisma/schema.prisma` lines 28 & 56 referencing `invitedPartners` and `invitedByUserId`.
2. **Existing Data Model Elements related to Referral**:
   - `Partner.code` (`prisma/schema.prisma` line 38): String @unique (e.g., `P001`, `P002`). Generated by `nextPartnerCode()` in `src/modules/registration/service.ts`.
   - `Partner.invitedByUserId` (`prisma/schema.prisma` lines 59-60): String? referencing `User.id` via relation `PartnerInvitedBy`.
   - `User.invitedPartners` (`prisma/schema.prisma` line 30): Relation `Partner[]`.
3. **Absence of Customer-Facing Storefront & Sales Attribution**:
   - `src/app/page.tsx` line 8: Root immediately redirects to `/login`.
   - All orders (`src/modules/orders/create.ts`, `src/app/(partner)/actions.ts` `submitOrder`) are created manually by an authenticated partner entering customer shipping info for offline COD sales.
   - There are **no public product URLs, no public shopping carts, no visitor checkout, and no browser cookies for sales tracking**.
   - **Gap Identification for R2**: "Sales Referral" tracking cannot attribute third-party customer sales via URLs/cookies because no public customer storefront exists. "Partner Referral" (partners inviting partners to register), however, directly aligns with the existing `Partner.code` and `registrationSchema.invitationCode`.

---

### 1.4 API Routes and Server Actions Audit

1. **API Route Handlers (`src/app/api/`)**:
   - `src/app/api/auth/[...nextauth]/route.ts`: Proxies standard Auth.js endpoints.
   - `src/app/api/cron/settle/route.ts`: Validates `CRON_SECRET` via query param `?key=` or `Authorization: Bearer`. Calls `settleDueEarnings()`. Fully idempotent.
   - `src/app/api/search/route.ts`: Calls `requireSession(["SUPER_ADMIN", "ADMIN", "PARTNER"])`. Rate limited by `user.id:clientIp`.
     - *Caveat*: If session is absent, `requireSession` calls `redirect("/login")`, resulting in a 307 redirect instead of a JSON 401 error.
   - `src/app/api/telegram/webhook/route.ts`: Checks `x-telegram-bot-api-secret-token`. Idempotent via `TelegramUpdate.updateId`. Only creates DRAFT products.

2. **Server Actions (`src/app/` and `src/modules/`)**:
   - `src/app/(auth)/register/actions.ts` (`registerAction`): Rate limited by client IP (`REGISTER` bucket). Validates inputs through `registerPartner`.
   - `src/app/(partner)/actions.ts` (`submitOrder`): Calls `requireSession(["PARTNER"])`. Selling price is retrieved server-side from `Product` inside `prisma.$transaction` (preventing price tampering).
   - `src/app/(partner)/actions.ts` (`cancelOwnOrder`): **VULNERABILITY IDENTIFIED (IDOR)**:
     - Line 65: `const user = await requireSession(["PARTNER"]);`
     - Line 66: `const orderId = str(formData.get("orderId"));`
     - Line 70: `await changeOrderStatus({ orderId, to: "CANCELLED", reason, actorId: user.id, role: user.role });`
     - `changeOrderStatus` (`src/modules/orders/status.ts` line 32) loads `order` by `orderId` and verifies transition roles, but **never checks `order.partnerId === user.partnerId`**! Any partner could cancel another partner's CONFIRMED order by guessing/passing its ID.
   - `src/app/(partner)/portefeuille/actions.ts` (`submitWithdrawalRequest`): Properly scopes by `user.partnerId` from session. Validates with Zod `withdrawalRequestSchema`. Rate limited.
   - `src/app/(admin)/partenaires/actions.ts`: Role-checked with `requireSession(["SUPER_ADMIN", "ADMIN"])`. `assignProduct` restricts commission override to `SUPER_ADMIN`.
   - `src/app/(admin)/finance/actions.ts`: Role-checked with `requireSession(["SUPER_ADMIN", "ADMIN"])`. Enforces multi-step withdrawal lifecycle (`startWithdrawalReview` -> `approveWithdrawalRequest` -> `payWithdrawalRequest`). Payment records immutable negative transaction with `idempotencyKey: withdrawal-pay:${id}`.

---

### 1.5 Security Gaps, Edge Cases, and Risks for R2 & R8

| Risk Area | Existing Behavior | Vulnerability / Failure Mode | Exact File & Line | Required Guard |
|---|---|---|---|---|
| **Self-Referral** | `registerPartner` only checks `invitationCode === "admin"`. | When partner codes are enabled, a user could enter their own code or existing account code. | `src/modules/registration/service.ts:55` | Reject if `inviter.userId === newUser.id` or matching email/phone. |
| **Referral Cycles** | `Partner.invitedByUserId` is an unconstrained FK to `User`. | Circular referrals (A refers B, B refers A) could cause infinite loops if traversing referrer hierarchies. | `prisma/schema.prisma:60` | Direct referrals only; validate that the referred partner has never been an ancestor of referrer. |
| **Unapproved Partners Creating / Using Referral Links** | `requireSession` only gates partner pages. If a link/code is shared externally, registration doesn't check if the inviter is `ACTIVE`. | A `PENDING`, `SUSPENDED`, or `REJECTED` partner's code could be accepted during new partner registrations. | `src/modules/registration/service.ts:62-66` | `registerPartner` must verify `referrerPartner.status === "ACTIVE"`. Link generation must require `ACTIVE`. |
| **Duplicate Attribution** | `invitedByUserId` on `Partner` has no uniqueness constraint; multiple referrals can reference the same user. | Re-registration with same email blocked by unique email, but duplicate referral events on orders/qualifications could double-count. | `prisma/schema.prisma:59` | Referral record must have unique constraint: `@@unique([referredPartnerId])` and unique idempotency keys on qualifying events. |
| **IDOR in Partner Actions** | `cancelOwnOrder` accepts arbitrary `orderId` without checking ownership. | A partner can cancel orders belonging to other partners. | `src/app/(partner)/actions.ts:66` & `src/modules/orders/status.ts:32` | Verify `order.partnerId === user.partnerId` for `PARTNER` role. All referral endpoints must strictly scope by `session.user.partnerId`. |
| **Auth Redirect Loop** | Credentials login does not check `Partner.status`. Middleware redirects `/login` to `/tableau-de-bord`. `requireSession` redirects to `/login?error=pending`. | Infinite 307 loop renders application unusable for unapproved/pending partners. | `src/lib/auth.ts:68`, `src/middleware.ts:60`, `src/lib/rbac.ts:32` | `authorize()` must check `partner.status === "ACTIVE"` for partners or middleware must handle `error=pending`. |
| **Race Conditions in Qualification & Commissions** | Order status changes call `createPartnerEarning` with idempotency `earning:order:${order.id}`. | Concurrent order updates or retried events could trigger duplicate referral promotions or overspend the 30% pool. | `src/modules/finance/ledger.ts:31-62` | Use DB transactions (`tx`), unique constraint on referral commission per order/period, and serializable/optimistic locking. |

---

## 2. Logic Chain

1. **From Observation 1.1 & 1.2 to Partner Approval Model**:
   - Observation: `Partner.status` defaults to `"PENDING"` on sign-up (`src/modules/registration/service.ts:100`).
   - Observation: An admin approves the partner by setting `status = "ACTIVE"` via `changePartnerStatus` (`src/app/(admin)/partenaires/actions.ts:23`).
   - Observation: `requireSession(["PARTNER"])` in `src/lib/rbac.ts:31` blocks any partner where `status !== "ACTIVE"`.
   - **Logical Deduction**: In this system, "Approved" status is strictly represented by `PartnerStatus.ACTIVE`. Therefore, requirement R2 ("Only partners with an explicitly Approved status may create and share referral links") translates directly to: `partner.status === PartnerStatus.ACTIVE`.

2. **From Observation 1.1 to Auth & Session Architecture**:
   - Observation: Auth.js uses stateless JWTs without database session persistence.
   - Observation: `authorize()` checks `user.status === "ACTIVE"` but ignores `partner.status`.
   - Observation: Middleware cannot read Prisma to verify partner status.
   - Observation: An authenticated PENDING partner is bounced in a loop between `requireSession` (`/login?error=pending`) and `middleware.ts` (`/tableau-de-bord`).
   - **Logical Deduction**: Any new referral endpoint or link generation action cannot rely on middleware alone for authorization. It must enforce server-side validation using `requireSession(["PARTNER"])` (which checks `getPartnerStatus`) or explicit database lookups. Furthermore, the login/session flow should either include `partnerStatus` in the JWT token or `authorize()` must validate `user.partner?.status === "ACTIVE"` for partners.

3. **From Observation 1.3 to Referral System Architecture**:
   - Observation: The system currently contains zero affiliate links, zero tracking cookies, zero public product landing pages, and zero visitor checkout workflows.
   - Observation: `Order` records are created exclusively by logged-in partners through `/nouvelle-commande` (`submitOrder`).
   - Observation: The registration workflow already contains an `invitationCode` input in `registrationSchema` (`src/modules/registration/schemas.ts:32`), currently constrained by a hardcoded string equality `input.invitationCode === "admin"`.
   - Observation: `Partner` has an auto-generated unique identifier `code` (`P001`, `P002`, ...), and `Partner` has an optional relation `invitedByUserId` to `User`.
   - **Logical Deduction**:
     - *Sales Referral*: Cannot be safely implemented as URL/cookie tracking for end-consumers without inventing an entire public storefront from scratch, which would violate the principle of additive implementation without breaking existing functionality. R2 explicitly directs: *"If required source data is missing, document the gap and implement only the safely supportable parts."*
     - *Partner Referral*: Perfectly fits the existing architecture. Approved partners (`status === "ACTIVE"`) can share their `Partner.code` or a registration link (`/register?ref=P001`). `registerPartner` can accept this code, look up the referring `Partner`, verify they are `ACTIVE`, prevent self-referrals and cycles, and link them via `invitedByUserId` (or a dedicated `PartnerReferral` model).

4. **From Observation 1.4 & 1.5 to Security & Integrity Rules (R2 & R8)**:
   - Observation: `cancelOwnOrder` demonstrated that trusting client-submitted entity IDs without asserting ownership creates critical IDOR vulnerabilities.
   - Observation: Financial operations in `src/modules/finance/ledger.ts` rely on unique `idempotencyKey` strings and `prisma.$transaction` to guarantee financial consistency and prevent double payouts.
   - **Logical Deduction**:
     - Any referral management endpoints (viewing referral links, stats, downline lists, commissions) must strictly read `partnerId` from `session.user.partnerId` and never from URL query parameters or request bodies.
     - Referral qualification (when referred partner has a delivered, COD-settled order) must be executed in a database transaction with idempotency keys (e.g. `referral:qualify:<referredPartnerId>:<orderId>`).
     - Referral commissions must be tracked with explicit states (`PENDING_VERIFICATION`, `ELIGIBLE`, `APPROVED`, `PAID`, `REJECTED`, `REVERSED`) and database constraints to prevent duplicate commissions on the same settled order/pool.

---

## 3. Caveats

1. **Public Storefront Absence**:
   - As observed, there is no public checkout or consumer-facing e-commerce portal in this codebase. If business stakeholders expect customer sales referral links (where a customer buys directly on the web and a partner earns a commission), this capability does not exist in the current system and cannot be supported without building a public checkout module.
2. **`PerformanceLevel` vs. Referral `PartnerLevel`**:
   - The existing model `PerformanceLevel` (`prisma/schema.prisma:88`) is used for a partner's direct sales profit share percentage (e.g., 60% of order contribution). R3 specifies referral tiers (Level 1 = 5%, Level 2 = 10%, Level 3 = 15% of Pool B). To avoid breaking existing order economics in `src/modules/orders/create.ts`, referral levels must either use configurable `SystemSetting` records or a distinct referral level structure, rather than overwriting `Partner.performanceLevelId`.
3. **Database Migration Environment**:
   - Direct database CLI commands (`prisma migrate dev`) require a live PostgreSQL database connection (`DATABASE_URL`). Migration files must be prepared additively so existing production tables are never dropped.

---

## 4. Conclusion

1. **Authentication & Authorization Baseline**:
   - Auth.js v5 with JWT session tokens and Edge middleware is functioning for basic role separation.
   - A critical auth defect exists where unapproved partners experience an infinite redirect loop between `/tableau-de-bord` and `/login?error=pending`.
2. **Partner Approval Workflow Baseline**:
   - Fully defined and functioning: `PENDING` -> `ACTIVE` (Approved). Admins manage this in `src/app/(admin)/partenaires/[id]/page.tsx`.
   - "Approved Partner" is conclusively identified by `PartnerStatus.ACTIVE`.
3. **Referral Foundation**:
   - There is no legacy referral code or cookie tracking to untangle.
   - Partner registration already features an `invitationCode` input, but it is currently locked to `"admin"`. Expanding this to accept partner codes is clean, direct, and non-destructive.
   - A dedicated `PartnerReferral` model (or expanding `Partner` relations) with strict unique constraints (`referredPartnerId`) and status tracking is the safe, additive path forward.
4. **Security & Permissions Enforcement for Implementation**:
   - Must enforce server-side approval check (`partner.status === "ACTIVE"`) both at referral link generation and when the referred partner signs up.
   - Must prevent self-referrals and cycle creation.
   - Must fix the IDOR vulnerability pattern observed in `cancelOwnOrder` by guaranteeing that all referral actions scope exclusively to `session.user.partnerId`.
   - Must use idempotency keys on qualifying events (`DELIVERED` + COD settled order) and commission records to prevent double-spending or race conditions.

---

## 5. Verification Method

To independently verify all findings and validate the security audit:

1. **Verify Existing Models and Enums**:
   - Inspect `prisma/schema.prisma` lines 11-72 for `User`, `Partner`, and relations `PartnerInvitedBy`.
   - Inspect `prisma/schema.prisma` lines 462-468 for `PartnerStatus` (`ACTIVE`, `PENDING`, `SUSPENDED`, `REJECTED`, `CLOSED`).
2. **Verify Registration Invite Code Constraint**:
   - Inspect `src/modules/registration/service.ts` lines 53-61: confirm hardcoded check `input.invitationCode.trim().toLowerCase() !== "admin"`.
   - Inspect `src/modules/registration/service.ts` line 100: confirm `status: "PENDING"`.
3. **Verify Auth Redirect Loop Bug**:
   - Inspect `src/lib/auth.ts` lines 68-82: confirm `user.status === "ACTIVE"` is checked, but `user.partner.status` is NOT checked.
   - Inspect `src/lib/rbac.ts` lines 29-34: confirm redirection to `/login?error=pending` when `status !== "ACTIVE"`.
   - Inspect `src/middleware.ts` lines 59-60: confirm that any authenticated user visiting `/login` is redirected to `ROLE_HOME.PARTNER` (`/tableau-de-bord`).
4. **Verify Action IDOR Vulnerability**:
   - Inspect `src/app/(partner)/actions.ts` lines 61-84 (`cancelOwnOrder`): confirm `orderId` is parsed from `formData` and passed directly to `changeOrderStatus`.
   - Inspect `src/modules/orders/status.ts` lines 32-44: confirm that `changeOrderStatus` performs no ownership comparison between `order.partnerId` and `actorId` / `user.partnerId`.
5. **Verify Absence of Storefront / Public Orders**:
   - Inspect `src/app/page.tsx` line 8: confirm root redirects to `/login`.
   - Search for public routes in `src/middleware.ts` lines 39-44: confirm only `/login`, `/register`, `/api/auth`, `/api/cron`, `/api/telegram` are public.
6. **Test Suite Verification**:
   - When running project tests (e.g. `npx vitest run`), verify that existing unit tests (`tests/auth-config.test.ts`, `tests/roles.test.ts`, `tests/transitions.test.ts`, `tests/finance-rules.test.ts`, `tests/performance-levels.test.ts`) continue to pass.
