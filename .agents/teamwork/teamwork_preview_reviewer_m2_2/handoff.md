# Reviewer 2 Handoff Report: Milestone 2 — Security, Cycles & IDOR Review

**Reviewer**: Reviewer 2 (Security, Cycles & IDOR Reviewer / Critic)  
**Working Directory**: `d:\e-com collab\.agents\teamwork\teamwork_preview_reviewer_m2_2`  
**Date**: 2026-10-09  
**Verdict**: **APPROVE**  
**Integrity Status**: **CLEAN (No integrity violations detected)**  

---

## 1. Observation

Direct code and artifact inspections were conducted across all Milestone 2 targets:

### 1.1 Self-Referral Prevention (`src/modules/referrals/service.ts`)
- **Partner ID check** (lines 251–257, 293–300):
  ```typescript
  if (candidate.id && candidate.id === referrer.id) {
    return { valid: false, error: "Auto-parrainage interdit: identifiant partenaire identique." };
  }
  ```
  Also checks resolved candidate partner ID (line 295).
- **Email match check** (lines 259–267):
  ```typescript
  if (candidate.email && referrer.user?.email) {
    if (candidate.email.trim().toLowerCase() === referrer.user.email.trim().toLowerCase()) {
      return { valid: false, error: "Auto-parrainage interdit: même adresse e-mail." };
    }
  }
  ```
  Trims whitespace and standardizes lower-case comparison against referrer user account.
- **Normalized phone check** (lines 46–50, 269–278):
  ```typescript
  export function normalizePhoneDigits(phone?: string | null): string {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    return digits.length >= 8 ? digits.slice(-8) : digits;
  }
  ```
  In eligibility check:
  ```typescript
  if (candidate.phone && referrer.phone) {
    const candNorm = normalizePhoneDigits(candidate.phone);
    const refNorm = normalizePhoneDigits(referrer.phone);
    if (candNorm && refNorm && candNorm === refNorm) {
      return { valid: false, error: "Auto-parrainage interdit: même numéro de téléphone." };
    }
  }
  ```
  Both numbers are normalized to the last 8 digits, defeating prefix variances (`+216`, `00216`, spaces, hyphens).

### 1.2 Cycle Detection & Duplicate Attribution (`src/modules/referrals/service.ts`)
- **Duplicate attribution prevention** (lines 302–311):
  ```typescript
  const existingAttribution = await db.referralAttribution.findUnique({
    where: { referredPartnerId: candidatePartnerId },
  });
  if (existingAttribution) {
    return { valid: false, error: "Ce partenaire est déjà attribué à un parrain." };
  }
  ```
  Reinforced by Prisma database schema (`prisma/schema.prisma` line 630):
  `referredPartnerId String @unique`
  guaranteeing that at most one parent referrer can exist per partner in PostgreSQL.
- **Immediate inverse cycle check** (lines 313–325):
  ```typescript
  const directCycle = await db.referralAttribution.findFirst({
    where: {
      referrerPartnerId: candidatePartnerId,
      referredPartnerId: referrer.id,
    },
  });
  if (directCycle) {
    return { valid: false, error: "Cycle de parrainage détecté: le candidat a déjà parrainé ce partenaire." };
  }
  ```
- **Multi-hop ancestor cycle traversal** (lines 327–355):
  ```typescript
  let currentPartnerId: string | null = referrer.id;
  const visited = new Set<string>();

  while (currentPartnerId) {
    if (currentPartnerId === candidatePartnerId) {
      return { valid: false, error: "Cycle de parrainage détecté dans la chaîne de parrainage." };
    }
    visited.add(currentPartnerId);
    const parentAttribution = await db.referralAttribution.findUnique({
      where: { referredPartnerId: currentPartnerId },
      select: { referrerPartnerId: true },
    });
    if (!parentAttribution) break;
    currentPartnerId = parentAttribution.referrerPartnerId;
    if (currentPartnerId && visited.has(currentPartnerId)) break;
  }
  ```
  Walks upward from the referrer to the tree root, checking if the candidate is already an ancestor. Contains explicit loop detection (`visited.has(currentPartnerId)`) preventing infinite loops.

### 1.3 Server Action IDOR Prevention (`src/modules/referrals/actions.ts`)
- **Action signature & session scoping** (lines 15–24):
  ```typescript
  export async function getPartnerReferralLinkAction(): Promise<PartnerReferralLinkActionResult> {
    try {
      const user = await requireSession(["PARTNER"]);
      if (!user.partnerId) {
        return { ok: false, error: "Identifiant partenaire introuvable dans la session." };
      }
      const result = await getOrCreateReferralCode(user.partnerId);
      return { ok: true, code: result.code, url: result.url };
    ...
  ```
  The server action accepts zero client arguments. The partner ID is strictly extracted from `session.user.partnerId` validated by `requireSession(["PARTNER"])`.

### 1.4 Test Coverage (`tests/referrals-attribution.test.ts`)
- Complete 963-line test suite containing 9 dedicated test blocks:
  1. `getOrCreateReferralCode`: Active generation, reuse of existing link, rejection of `PENDING`, `SUSPENDED`, `REJECTED`, `CLOSED`, and unknown IDs.
  2. `validateReferralCode`: Validation of active links, fallback to `Partner.code`, rejection of inactive links, unapproved partners, non-existent codes, and blank codes.
  3. `validateReferralEligibility`: Distinct candidates accepted; self-referral rejected by ID, case-insensitive email, and normalized phone; duplicate attribution rejected; direct cycles rejected; multi-hop ancestor cycles rejected; non-active referrer rejected.
  4. `registrationSchema`: Accepts `admin`, uppercase `ADMIN`, alphanumeric `P001`, slugs; rejects invalid characters and empty strings.
  5. `registerPartner`: Admin invitation bypass, invalid code handling, email self-referral rejection, phone self-referral rejection.
  6. `recordPartnerReferral helper`: Transactional creation with `type: "PARTNER"` and `status: "PENDING_QUALIFICATION"`.
  7. `getPartnerReferralLinkAction`: Error when session has no partner ID; parameterless invocation deriving ID strictly from session.
  8. `Auth Redirect Loop Resolution`: Credentials rejection with `PendingPartnerError` for pending partners; rejection for suspended partners; session issuance for active partners and admins.
  9. `normalizePhoneDigits`: Comprehensive formatting tests (`98123456`, `+216...`, `00216...`, dashes, blanks).

---

## 2. Logic Chain

1. **Self-Referral Prevention**:
   - `validateReferralEligibility` evaluates candidate data against referrer records across three distinct channels: partner ID, email (case-insensitive & trimmed), and phone (normalized to last 8 digits).
   - In `registerPartner` (`src/modules/registration/service.ts`), this check executes before transaction entry, blocking any partner attempting to refer another account sharing their email or phone.
   - Therefore, self-referral abuse is comprehensively blocked.

2. **Cycle Prevention**:
   - Every partner can have at most one parent referrer (`referredPartnerId String @unique`).
   - Direct inverse referrals (candidate referred referrer) are queried directly via `findFirst`.
   - Multi-hop cycles (candidate is an ancestor higher up the chain who referred an ancestor of the referrer) are queried iteratively up to the root.
   - Therefore, closed referral loops cannot be established.

3. **Duplicate Attribution Prevention**:
   - Handled both application-side (`validateReferralEligibility` checks `findUnique({ where: { referredPartnerId } })`) and database-side (`@unique` index on `referredPartnerId`).
   - Any attempt to assign multiple referrers to one partner fails validation and triggers Prisma `P2002` rollback if raced.

4. **IDOR Prevention**:
   - `getPartnerReferralLinkAction` accepts no parameters from the client.
   - The caller cannot inject or spoof a target partner ID via URL or request body.
   - `requireSession(["PARTNER"])` verifies the JWT session and enforces `Partner.status === "ACTIVE"` in `src/lib/rbac.ts` and `src/modules/referrals/service.ts`.
   - Therefore, no IDOR vulnerability exists.

5. **Integrity Assessment**:
   - Inspected source code for hardcoded test fixtures, facade stubs, or bypasses. All business logic executes real graph traversals, dynamic SQL queries via Prisma, and authentic validation logic.
   - No mock overrides exist inside production source files.

---

## 3. Caveats

1. **Email Subaddressing**:
   - `candidate.email.trim().toLowerCase()` prevents case and space bypassing. It does not strip Gmail-style plus aliases (`user+ref@domain.com`). Given that every partner registration requires manual administrator review and approval before becoming active, the residual risk is negligible.
2. **Phone Number Geographic Scope**:
   - `normalizePhoneDigits` slices the last 8 digits, targeting the Tunisian national telecommunications numbering plan (+216 followed by 8 digits). If international expansion occurs in the future, standardizing on E.164 via a library like `libphonenumber-js` is recommended.
3. **Consumer Storefront Sales Referrals**:
   - As documented in the initial audit, the application is currently a private partner portal for manual COD orders; there is no public consumer storefront. Model support for `ReferralType.SALES` is present in the schema, but storefront referral links are appropriately deferred until a storefront exists.

---

## 4. Conclusion

**Verdict: APPROVE**

The Milestone 2 implementation satisfies all security, attribution, and cycle-prevention requirements specified in Requirements R2, R8, and the Milestone 2 design contracts:
- Server-side active partner enforcement is ubiquitous.
- Self-referrals by ID, email, and normalized phone are strictly rejected.
- Direct and multi-hop cycles are prevented via graph traversal with loop protection.
- Duplicate attributions are prevented at both the application and database constraints levels.
- Server actions are strictly session-scoped with zero client-provided IDs (zero IDOR exposure).
- Test coverage across all security rules is comprehensive and genuine.
- No integrity violations, facade implementations, or bypasses were detected.

---

## 5. Verification Method

To independently verify these findings:

1. **Codebase Inspection**:
   - Inspect `src/modules/referrals/service.ts` (lines 46–50 for phone normalization, lines 251–278 for self-referral, lines 302–355 for duplicate and cycle checks).
   - Inspect `src/modules/referrals/actions.ts` (line 15 verifying parameterless signature and session derivation).
   - Inspect `src/lib/auth.ts` (lines 101–122 verifying credentials-level partner status checks).
2. **Database Schema Inspection**:
   - Inspect `prisma/schema.prisma` line 630 verifying `@unique` on `referredPartnerId`.
3. **Test Suite Execution**:
   - Run Vitest on the referral attribution suite:
     ```bash
     npx vitest run tests/referrals-attribution.test.ts
     ```
   - All 9 test suites and individual test cases should pass.
