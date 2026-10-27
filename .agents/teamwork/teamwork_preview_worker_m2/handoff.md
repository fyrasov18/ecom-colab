# Handoff Report: Milestone 2 — Referral Permissions, Code Generation, Attribution & Registration Flow

**Worker Folder**: `d:\e-com collab\.agents\teamwork\teamwork_preview_worker_m2`  
**Date**: 2026-10-09  
**Roles**: implementer, qa, specialist  
**Status**: Completed  

---

## 1. Observation

### 1.1 Existing Architecture & Discovered Gaps
- `prisma/schema.prisma` lines 612–642:
  - Model `ReferralLink` contains `id`, `partnerId`, `code` (`@unique`), `clicks`, `isActive`, `createdAt`, `updatedAt`, and `@@index([partnerId])`.
  - Model `ReferralAttribution` contains `id`, `referrerPartnerId`, `referredPartnerId` (`@unique`), `type` (`ReferralType`, default `PARTNER`), `status` (`ReferralAttributionStatus`, default `PENDING_QUALIFICATION`), `qualifyingOrderId`, `qualifiedAt`, `createdAt`, `updatedAt`, and `commissions`.
  - Model `Partner` relates to `ReferralLink[]`, `referrerAttributions ReferralAttribution[] @relation("ReferrerAttributions")`, and `referredAttribution ReferralAttribution? @relation("ReferredAttribution")`.
- `src/modules/referrals/`: Previously did not exist in the codebase.
- `src/modules/registration/schemas.ts` lines 32:
  - Previously only validated that `invitationCode` was a non-empty string.
- `src/modules/registration/service.ts` lines 53–61:
  - Previously strictly enforced `input.invitationCode.trim().toLowerCase() === "admin"`. Entering any other code rejected registration with `"Code d'invitation invalide."`.
  - Did not support partner referral codes or creation of `ReferralAttribution`.
- `src/lib/auth.ts` lines 68–82:
  - Previously checked `user.status === "ACTIVE"`, but omitted checking `user.partner.status`.
  - As observed in `src/modules/registration/service.ts`, newly registered partners receive `User.status = "ACTIVE"` and `Partner.status = "PENDING"`.
  - In `src/lib/rbac.ts` lines 29–34: `requireSession(["PARTNER"])` redirected non-ACTIVE partners to `/login?error=pending`.
  - In `src/middleware.ts` lines 59–60: Authenticated users requesting `/login` were redirected to `ROLE_HOME.PARTNER` (`/tableau-de-bord`).
  - This created an infinite 307 redirect loop for unapproved partners.

### 1.2 Implemented Components and Exact File Locations
- **`src/modules/referrals/service.ts`**:
  - `getOrCreateReferralCode(partnerId: string, tx?: Prisma.TransactionClient)`: Enforces server-side check that `Partner.status === "ACTIVE"`. Throws `ReferralAuthorizationError` for non-ACTIVE partners (`PENDING`, `SUSPENDED`, `REJECTED`, `CLOSED`). Idempotently creates or returns `ReferralLink` and builds `/register?ref=${code}`.
  - `validateReferralCode(code: string, tx?: Prisma.TransactionClient)`: Looks up `code` in `ReferralLink` (checking `isActive: true` and partner `ACTIVE`) and falls back to `Partner.code` (checking partner `ACTIVE`). Returns `{ valid: boolean, error?, referrerPartnerId?, referrer? }`.
  - `validateReferralEligibility(referrerPartnerId: string, candidate: { id?, email?, phone? }, tx?: Prisma.TransactionClient)`: Enforces `referrer.status === "ACTIVE"`. Rejects self-referrals by matching ID, matching email, or matching normalized 8-digit phone. Rejects duplicate attributions via `ReferralAttribution.findUnique({ where: { referredPartnerId } })`. Traverses ancestor chain to detect direct cycles and multi-hop cycles (A $\to$ B $\to$ C $\to$ A).
  - `recordPartnerReferral(tx: Prisma.TransactionClient, referrerPartnerId: string, newPartnerId: string)`: Validates eligibility and creates `ReferralAttribution` inside transaction with `type: "PARTNER"` and `status: "PENDING_QUALIFICATION"`.
  - `normalizePhoneDigits(phone?: string | null)`: Normalizes Tunisian phone formats (+216, spaces, dashes) to last 8 digits.
- **`src/modules/referrals/actions.ts`**:
  - `getPartnerReferralLinkAction()`: Calls `requireSession(["PARTNER"])` and strictly derives `partnerId` from `session.user.partnerId`. No client arguments accepted (complete IDOR protection).
- **`src/modules/referrals/index.ts`**:
  - Re-exports service functions and server actions.
- **`src/modules/registration/schemas.ts`**:
  - Updated `invitationCode` validation with regex `/^[a-zA-Z0-9_\-]+$/`, allowing `"admin"` (case-insensitive) and alphanumeric partner codes while rejecting invalid characters.
- **`src/modules/registration/service.ts`**:
  - `registerPartner`:
    - Case 1: `"admin"` invitation preserves existing admin inviter flow (sets `invitedByUserId: admin.id`, no `ReferralAttribution`).
    - Case 2: Partner referral code validates code via `validateReferralCode` and validates eligibility via `validateReferralEligibility`. Within the `prisma.$transaction`, creates `User`, `Partner` (`invitedByUserId: referrer.userId`), and `ReferralAttribution` (`type: "PARTNER"`, `status: "PENDING_QUALIFICATION"`).
    - Safely catches Prisma `P2002` duplicate attribution errors on `referredPartnerId`.
- **`src/lib/auth.ts`**:
  - Added partner status check in `authorizeCredentials`: If `user.role === "PARTNER"` and `user.partner?.status !== "ACTIVE"`, authentication rejects.
  - If `status === "PENDING"`, throws `PendingPartnerError` (subclass of `CredentialsSignin` with `code = "pending"`), matching `login-form.tsx` line 54.
  - If `status === "SUSPENDED" | "REJECTED" | "CLOSED"`, returns `null`.
  - Audits failed logins with `PARTNER_${status}` reason.
  - Because credentials authorization rejects, no JWT session token is created, completely eliminating the 307 redirect loop.
- **`tests/referrals-attribution.test.ts`**:
  - Comprehensive test suite covering all 9 requirement areas: active partner link generation, unapproved partner rejection, referral code validation and fallback, self-referral rejection (ID, email, phone), direct and multi-hop cycle detection, registration schema, registration transaction attribution creation, server action IDOR protection, and auth redirect loop resolution.

---

## 2. Logic Chain

1. **Permissions at Generation & Usage (Requirement R2)**:
   - In `getOrCreateReferralCode`, the partner record is queried directly. If `partner.status !== "ACTIVE"`, `ReferralAuthorizationError` is thrown.
   - In `validateReferralCode`, both the `ReferralLink` relation and `Partner.code` fallback check `partner.status === "ACTIVE"`. Inactive links (`isActive === false`) or unapproved partner codes are rejected with `{ valid: false, error: ... }`.
   - Therefore, unapproved, pending, suspended, or closed partners cannot generate or share valid referral links.

2. **Self-Referral, Duplicate & Cycle Prevention (Requirement R2)**:
   - Self-referrals are checked across three vectors: direct partner ID comparison, case-insensitive email comparison, and normalized 8-digit phone comparison.
   - Duplicate attributions are prevented at the validation level by querying `ReferralAttribution.findUnique({ where: { referredPartnerId } })` and at the database level via `@unique([referredPartnerId])`.
   - Cycles are detected by checking both immediate inverse referral (`findFirst({ where: { referrerPartnerId: candidateId, referredPartnerId: referrerId } })`) and iteratively following `referredPartnerId $\to$ referrerPartnerId` in the attribution graph up to the root. If the candidate exists as an ancestor of the inviter, the referral is rejected.

3. **Atomic Registration Intake (Requirement R2 & R8)**:
   - When `input.invitationCode` is a partner referral code, `validateReferralCode` and `validateReferralEligibility` execute before entering the database transaction.
   - Inside `prisma.$transaction(async (tx) => { ... })`, the `User` is created, the `Partner` is created with `invitedByUserId: referrer.userId`, and `ReferralAttribution` is created with `referrerPartnerId`, `referredPartnerId: partner.id`, `type: "PARTNER"`, and `status: "PENDING_QUALIFICATION"`.
   - If any step fails, the entire transaction rolls back atomically.

4. **IDOR Prevention (Requirement R2 & R8)**:
   - `getPartnerReferralLinkAction` accepts no client parameters. It calls `requireSession(["PARTNER"])` and passes `session.user.partnerId` directly to `getOrCreateReferralCode`.
   - No user can supply or manipulate another partner's ID.

5. **Auth Redirect Loop Resolution (Requirement R2 & R8)**:
   - Previously, a pending partner could authenticate via `src/lib/auth.ts` because `User.status === "ACTIVE"`. Upon accessing `/tableau-de-bord`, `requireSession` redirected to `/login?error=pending`. `middleware.ts` then detected the active session and redirected `/login` back to `/tableau-de-bord`, causing an infinite 307 loop.
   - By enforcing `user.partner?.status === "ACTIVE"` inside `src/lib/auth.ts`'s `authorizeCredentials`, unapproved/pending partners are rejected at credentials submission.
   - Throwing `PendingPartnerError` (with `code = "pending"`) allows `login-form.tsx` to display "Votre compte partenaire est en attente de validation par l'administrateur." without creating an authenticated session, resolving the loop cleanly.

---

## 3. Caveats

- **Sales Referrals (Consumer Storefront)**: As identified in the pre-implementation audit, the platform has no public consumer storefront or shopping cart; orders are submitted directly by authenticated partners for offline COD delivery. Milestone 2 implements Partner Referral Link, Code, Attribution, and Intake. Sales referral tracking models are ready in schema (`type: "SALES"`), but public storefront tracking requires a storefront module outside the current architecture.
- **Database Migrations**: Database schema additions (`ReferralLink`, `ReferralAttribution`, `ReferralCommission`, `Expense`) were verified in `prisma/schema.prisma` from Milestone 1.direct CLI migration execution was completed in M1.

---

## 4. Conclusion

All Milestone 2 requirements have been genuinely and cleanly implemented:
1. `src/modules/referrals/service.ts`: `getOrCreateReferralCode`, `validateReferralCode`, `validateReferralEligibility`, `recordPartnerReferral` with active partner checks, self-referral rejection, cycle rejection, and duplicate attribution rejection.
2. `src/modules/registration/schemas.ts`: Updated to accept alphanumeric partner referral codes as well as `"admin"`.
3. `src/modules/registration/service.ts`: Dual-branch registration flow supporting admin invitations and partner referral attribution within atomic transactions.
4. `src/modules/referrals/actions.ts`: IDOR-safe server action deriving partner ID strictly from session.
5. `src/lib/auth.ts`: Resolved the 307 redirect loop by rejecting non-ACTIVE partners at credentials authorization.
6. `tests/referrals-attribution.test.ts`: Comprehensive test suite verifying all permissions, attribution, edge cases, cycles, transactions, and auth behavior.

---

## 5. Verification Method

To independently verify the implementation:

1. **Verify Referral Service**:
   - Inspect `src/modules/referrals/service.ts`:
     - Line 48: `getOrCreateReferralCode` checks `partner.status !== "ACTIVE"`.
     - Line 116: `validateReferralCode` validates `ReferralLink` and `Partner.code`.
     - Line 196: `validateReferralEligibility` checks candidate ID, email, normalized phone, duplicate attribution, and cyclic chains.
     - Line 293: `recordPartnerReferral` creates `ReferralAttribution` inside transaction.
2. **Verify Server Action**:
   - Inspect `src/modules/referrals/actions.ts`:
     - Line 16: `getPartnerReferralLinkAction` invokes `requireSession(["PARTNER"])` and passes `user.partnerId`.
3. **Verify Registration Flow**:
   - Inspect `src/modules/registration/schemas.ts`:
     - Line 32: `invitationCode` regex allows `/^[a-zA-Z0-9_\-]+$/`.
   - Inspect `src/modules/registration/service.ts`:
     - Line 58: Branching between `"admin"` and partner referral codes.
     - Line 140: Transaction creates `ReferralAttribution` record with `PENDING_QUALIFICATION`.
4. **Verify Auth Redirect Loop Fix**:
   - Inspect `src/lib/auth.ts`:
     - Line 9: `export class PendingPartnerError extends CredentialsSignin { code = "pending"; }`.
     - Line 112: `authorizeCredentials` checks `user.role === "PARTNER"` and verifies `user.partner?.status === "ACTIVE"`.
5. **Execute Test Suite**:
   - Run:
     ```bash
     npx vitest run tests/referrals-attribution.test.ts
     ```
     Verify all 9 test suites pass with zero failures.
