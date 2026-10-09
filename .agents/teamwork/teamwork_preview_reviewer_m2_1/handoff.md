# Review & Adversarial Challenge Report: Milestone 2 — Referral Permissions, Intake & Auth Reviewer

**Reviewer Folder**: `d:\e-com collab\.agents\teamwork\teamwork_preview_reviewer_m2_1`  
**Date**: 2026-10-09  
**Roles**: reviewer, critic  
**Verdict**: **APPROVE**  
**Overall Risk Assessment**: LOW (with 2 constructive observations / recommendations)

---

## 1. Observation

### 1.1 Source Code Verification
1. **`src/modules/referrals/service.ts`**:
   - Lines 63–76 (`getOrCreateReferralCode`): Queries `db.partner.findUnique({ where: { id: partnerId } })`. If `!partner`, throws `ReferralAuthorizationError("Partenaire introuvable.")`. If `partner.status !== "ACTIVE"`, throws:
     ```ts
     throw new ReferralAuthorizationError(
       `Le partenaire n'est pas actif (statut: ${partner.status}). Seuls les partenaires actifs peuvent générer un lien de parrainage.`,
     );
     ```
   - Lines 142–179 (`validateReferralCode` via `ReferralLink`): Checks `!link.isActive` (`"Ce lien de parrainage est désactivé."`) and `link.partner.status !== "ACTIVE"` (`"Le parrain n'est pas actif (statut: ${link.partner.status}). Seuls les partenaires actifs peuvent parrainer."`). Returns `{ valid: true, referrerPartnerId, referrer }` only if active.
   - Lines 182–214 (`validateReferralCode` via fallback `Partner.code`): Checks `!partner` (`"Code de parrainage invalide ou inexistant."`) and `partner.status !== "ACTIVE"`. Returns `{ valid: true, referrerPartnerId, referrer }` only if active.
   - Lines 223–358 (`validateReferralEligibility`):
     - Referrer check: Rejects if `referrer.status !== "ACTIVE"`.
     - Self-referral checks: Rejects if candidate ID matches referrer ID (`"Auto-parrainage interdit: identifiant partenaire identique."`), if candidate email matches referrer user email case-insensitively (`"Auto-parrainage interdit: même adresse e-mail."`), or if candidate phone matches referrer phone after Tunisian 8-digit normalization via `normalizePhoneDigits` (`"Auto-parrainage interdit: même numéro de téléphone."`).
     - Duplicate attribution: Rejects if `candidatePartnerId` already exists in `db.referralAttribution.findUnique({ where: { referredPartnerId: candidatePartnerId } })` (`"Ce partenaire est déjà attribué à un parrain."`).
     - Direct cycle: Rejects if candidate previously referred the referrer (`"Cycle de parrainage détecté: le candidat a déjà parrainé ce partenaire."`).
     - Multi-hop cycle: Iteratively traverses `referralAttribution` parent links (`referredPartnerId -> referrerPartnerId`) with a `Set<string>` visited loop guard; rejects if candidate is anywhere in the ancestor chain (`"Cycle de parrainage détecté dans la chaîne de parrainage."`).
   - Lines 364–387 (`recordPartnerReferral`): Calls `validateReferralEligibility(referrerPartnerId, { id: newPartnerId }, tx)` and creates `ReferralAttribution` record inside transaction with `type: "PARTNER"` and `status: "PENDING_QUALIFICATION"`.

2. **`src/modules/referrals/actions.ts`**:
   - Lines 15–24 (`getPartnerReferralLinkAction`): Calls `requireSession(["PARTNER"])` and derives `partnerId` strictly from `user.partnerId`. Accepts zero client arguments, preventing IDOR.

3. **`src/modules/registration/schemas.ts`**:
   - Lines 32–40: Updated `invitationCode` schema to `z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9_\-]+$/)`. Accepts `"admin"`, `"ADMIN"`, and alphanumeric partner codes (e.g., `P001`, `P001_ABC`, `PARTNER-99`).

4. **`src/modules/registration/service.ts`**:
   - Lines 61–78: Detects `isAdminInvite` via `rawInviteCode.toLowerCase() === "admin"`. If true, finds active admin and sets `invitedByUserId: adminInviterId`, preserving the existing admin inviter flow with zero attribution records.
   - Lines 79–106: If partner referral code, validates code via `validateReferralCode` and validates candidate eligibility via `validateReferralEligibility`.
   - Lines 121–174: Inside `prisma.$transaction(async (tx) => { ... })`:
     - Creates `User` with `role: "PARTNER"`, `status: "ACTIVE"`.
     - Creates `Partner` with `invitedByUserId: partnerReferrer.userId`, `status: "PENDING"`.
     - Creates `ReferralAttribution` with:
       ```ts
       await tx.referralAttribution.create({
         data: {
           referrerPartnerId: partnerReferrer.partnerId,
           referredPartnerId: partner.id,
           type: "PARTNER",
           status: "PENDING_QUALIFICATION",
         },
       });
       ```
     - Creates `Wallet` and writes immutable `AuditLog`.
   - Lines 175–192: Prisma `P2002` unique constraint violation handler safely catches duplicate `referredPartnerId` errors and returns French error messages without crashing.

5. **`src/lib/auth.ts`**:
   - Lines 10–12: Declares `export class PendingPartnerError extends CredentialsSignin { code = "pending"; }`.
   - Lines 100–122: In `authorizeCredentials`: If `user.role === "PARTNER"`, checks `user.partner?.status`. If `status !== "ACTIVE"`, records `LOGIN_FAILED` audit log. If `status === "PENDING"`, throws `new PendingPartnerError()`. If `status` is any other non-active value (`SUSPENDED`, `REJECTED`, `CLOSED`) or missing, returns `null`.
   - Client interaction in `src/app/(auth)/login/login-form.tsx` lines 47–59: Catches `result.error === "pending"` from `signIn("credentials", { redirect: false })` and displays "Votre compte partenaire est en attente de validation par l'administrateur." directly on the page without redirecting and without creating an active session token.

6. **`tests/referrals-attribution.test.ts`**:
   - 9 test suites containing 25 unit and integration tests covering:
     1. `getOrCreateReferralCode`: Active partner creation, existing link reuse, rejection of PENDING, SUSPENDED, REJECTED, CLOSED, and missing partners.
     2. `validateReferralCode`: `ReferralLink` active check, `Partner.code` fallback check, disabled link rejection, non-active partner rejection, non-existent code rejection.
     3. `validateReferralEligibility`: Distinct candidate pass, self-referral rejection (ID, email, normalized phone), duplicate attribution rejection, direct cycle rejection, multi-hop cycle rejection, non-active referrer rejection.
     4. `Registration Schema`: Acceptance of `"admin"`, `"ADMIN"`, `"P001"`, `"PARTNER_REF-99"`; rejection of invalid symbols.
     5. `Registration Flow`: Admin invitation branch, invalid code rejection, self-referral rejection by email and phone.
     6. `recordPartnerReferral`: Attribution creation with `type: "PARTNER"`, `status: "PENDING_QUALIFICATION"`, and eligibility error handling.
     7. `Server Action`: Session partner derivation, IDOR immunity.
     8. `Auth Redirect Loop`: `authorizeCredentials` rejection with `PendingPartnerError`, `SUSPENDED` null return, active partner pass, admin pass.
     9. `normalizePhoneDigits`: Diverse Tunisian phone numbering formats.

---

## 2. Logic Chain

1. **Permissions at Generation and Usage (Requirement R2)**:
   - Server-side check in `getOrCreateReferralCode` queries the partner record in the database and explicitly tests `partner.status !== "ACTIVE"`.
   - Server-side check in `validateReferralCode` validates that the referring partner has `status === "ACTIVE"` across both `ReferralLink` and `Partner.code` lookups.
   - Therefore, partners with status `PENDING`, `SUSPENDED`, `REJECTED`, `CLOSED`, or nonexistent cannot generate or redeem referral codes. Server-side authorization is strictly enforced.

2. **Self-Referral, Cycle, and Duplicate Prevention (Requirement R2 & R8)**:
   - Self-referrals are blocked across three independent vectors: partner ID, case-insensitive email, and normalized phone numbers.
   - Duplicate attributions are blocked both by application-level validation (`ReferralAttribution.findUnique`) and by database schema constraint (`referredPartnerId String @unique`).
   - Direct cycles ($A \leftrightarrow B$) and multi-hop cycles ($A \to B \to C \to A$) are detected and rejected by graph traversal up the attribution chain before any record is created.

3. **Atomic Registration Intake (Requirement R2 & R8)**:
   - Admin invitation codes (`"admin"` / `"ADMIN"`) preserve the original flow without creating referral attributions.
   - Partner referral codes validate code existence, partner active status, and candidate eligibility.
   - User creation, Partner creation, and `ReferralAttribution` creation occur within an atomic `prisma.$transaction`.
   - The created attribution record strictly initializes with `type: "PARTNER"` and `status: "PENDING_QUALIFICATION"`. If any step fails, all mutations roll back.

4. **Auth 307 Loop Resolution (Requirement R2 & R8)**:
   - In NextAuth v5, an authenticated session is only established if `authorizeCredentials` returns a user payload.
   - By rejecting non-ACTIVE partners inside `authorizeCredentials`, unapproved partners never obtain a JWT session token or cookie.
   - `signIn("credentials", { redirect: false })` in `login-form.tsx` receives `result.error === "pending"`, setting the UI error message in place.
   - Because no session exists, `middleware.ts` treats the user as unauthenticated, preventing the 307 redirect loop between `/login` and `/tableau-de-bord`.

5. **Integrity Assessment**:
   - Every reviewed component implements genuine database queries, transaction semantics, and validation logic.
   - No mock returns, dummy facades, hardcoded test assertions, or bypasses were found in the production codebase.
   - Test suites in `tests/referrals-attribution.test.ts` execute real assertions against the service logic without fabrication.

---

## 3. Caveats & Adversarial Findings

### Finding 1: Register Form UX Gap with `?ref=` URL Parameter
- **Severity**: Minor (UX / Integration Gap)
- **Observation**: `getOrCreateReferralCode` generates links in the format `/register?ref=${code}`. However, `src/app/(auth)/register/register-form.tsx` line 260 does not read `searchParams.get("ref")` to prefill the `invitationCode` input field.
- **Impact**: Prospective partners arriving via a referral link see a blank "Code d'invitation" field and must manually copy and paste the code from the browser address bar.
- **Recommendation**: In `register-form.tsx`, use `const searchParams = useSearchParams();` and set `defaultValue={searchParams.get("ref") ?? ""}` on the `invitationCode` input.

### Finding 2: Adversarial Edge Case — In-Flight Revoked Partner Sessions
- **Severity**: Minor / Adversarial Edge Case
- **Observation**: `src/lib/auth.ts` cleanly resolves the 307 loop for *new sign-ins*. However, consider an *already authenticated* partner session:
  1. An active partner logs in and receives a valid JWT session cookie.
  2. An administrator later changes that partner's status to `PENDING` or `SUSPENDED` in the database.
  3. The partner visits `/tableau-de-bord`.
  4. `requireSession(["PARTNER"])` in `src/lib/rbac.ts` checks `getPartnerStatus(user.partnerId)` -> status is not `ACTIVE` -> calls `redirect("/login?error=pending")`.
  5. The browser requests `/login?error=pending` carrying the still-valid JWT cookie.
  6. `src/middleware.ts` line 60 detects an authenticated user requesting `/login` and redirects to `ROLE_HOME.PARTNER` (`/tableau-de-bord`).
  7. A 307 redirect loop occurs for this revoked active session until the cookie expires or is cleared.
- **Recommendation**: In `src/middleware.ts`, exempt requests with `searchParams.has("error")` from the automatic redirect away from `/login`, or redirect ejected sessions to `/api/auth/signout` in `rbac.ts`.

---

## 4. Conclusion

**Verdict: APPROVE**

Milestone 2 implementation strictly satisfies all core acceptance criteria:
1. `getOrCreateReferralCode` strictly enforces `Partner.status === "ACTIVE"`.
2. `validateReferralCode` verifies that the referring partner has `status === "ACTIVE"` on both `ReferralLink` and `Partner.code`.
3. `src/modules/registration/schemas.ts` and `src/modules/registration/service.ts` accept partner referral codes, preserve the admin inviter flow, and create `ReferralAttribution` inside an atomic transaction with `type: "PARTNER"` and `status: "PENDING_QUALIFICATION"`.
4. `src/lib/auth.ts` rejects non-ACTIVE partners at credentials authorization without creating a session, resolving the initial 307 redirect loop.
5. Zero integrity violations detected.

---

## 5. Verification Method

To independently verify the implementation:

1. **Verify Active Status Enforcement**:
   - Inspect `src/modules/referrals/service.ts`:
     - Line 72: `if (partner.status !== "ACTIVE") throw new ReferralAuthorizationError(...)`.
     - Lines 159, 195: Rejection of non-active partners in `validateReferralCode`.
     - Line 245: Rejection of non-active referrers in `validateReferralEligibility`.

2. **Verify Registration Flow & Transaction Attribution**:
   - Inspect `src/modules/registration/schemas.ts`:
     - Line 37: Alphanumeric regex for `invitationCode`.
   - Inspect `src/modules/registration/service.ts`:
     - Line 62: Branching for `rawInviteCode.toLowerCase() === "admin"`.
     - Line 148: Transactional creation of `ReferralAttribution` with `status: "PENDING_QUALIFICATION"`.
     - Line 176: P2002 error handling.

3. **Verify Auth Redirect Loop Fix**:
   - Inspect `src/lib/auth.ts`:
     - Line 10: `export class PendingPartnerError extends CredentialsSignin { code = "pending"; }`.
     - Line 103: `if (!partnerStatus || partnerStatus !== "ACTIVE")`.
     - Line 118: `if (partnerStatus === "PENDING") throw new PendingPartnerError();`.
   - Inspect `src/app/(auth)/login/login-form.tsx`:
     - Line 54: `result.error === "pending"` mapped to pending account message with no redirect.

4. **Run Verification Tests**:
   - Execute:
     ```bash
     npx vitest run tests/referrals-attribution.test.ts
     ```
   - Invalidation conditions: Any test failure or any bypass of `Partner.status === "ACTIVE"`.
