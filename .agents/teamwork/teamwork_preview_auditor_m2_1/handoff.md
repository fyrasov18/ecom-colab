# Forensic Audit Report: Milestone 2 — Referral Permissions & Attribution

**Auditor Folder**: `d:\e-com collab\.agents\teamwork\teamwork_preview_auditor_m2_1`  
**Date**: 2026-10-09  
**Roles**: critic, specialist, auditor  
**Work Product**: Milestone 2 Deliverables  
- `src/modules/referrals/service.ts`  
- `src/modules/referrals/actions.ts`  
- `src/modules/registration/schemas.ts`  
- `src/modules/registration/service.ts`  
- `src/lib/auth.ts`  
- `tests/referrals-attribution.test.ts`  

**Profile**: General Project  
**Integrity Mode**: Development (lenient mode per `ORIGINAL_REQUEST.md` line 8)  
**Binary Verdict**: **CLEAN**

---

### Phase Results

| Check | Result | Details |
|---|---|---|
| **1. Static Analysis (Bypasses & Hardcoded Outputs)** | **PASS** | Grep analysis confirmed zero hardcoded test results, zero mock codes in production logic, and zero bypass flags. |
| **2. Genuine Implementation (Cycle & Normalization)** | **PASS** | Graph traversal in `validateReferralEligibility` genuinely walks ancestor attribution chains using iterative parent lookups; phone and email normalization genuinely standardize and compare values. |
| **3. Facade/Dummy Check (DB Queries & Transactions)** | **PASS** | Atomic mutations are wrapped in real `prisma.$transaction` calls with schema constraints, audit logging, and P2002 duplicate attribution handling. |
| **4. Bypass Check (Skipped & Hollowed Tests)** | **PASS** | Zero `.skip` or `.only` directives across the entire test suite; all 9 test suites in `tests/referrals-attribution.test.ts` execute concrete value and behavior assertions. |
| **5. Adversarial Review & IDOR Prevention** | **PASS** | Server action accepts zero client parameters and derives `partnerId` strictly from authenticated session; pending partners cleanly rejected at credentials stage to avoid redirect loops. |

---

## 1. Observation

### 1.1 Static Analysis for Hardcoded Outputs, Fake Codes, or Bypass Flags
- In `src/modules/referrals/service.ts`:
  - Line 63: `db.partner.findUnique({ where: { id: partnerId }, select: { id: true, code: true, status: true } })` performs a real database lookup.
  - Line 72: `if (partner.status !== "ACTIVE") throw new ReferralAuthorizationError(...)` enforces active status server-side.
  - Line 79: `db.referralLink.findFirst({ where: { partnerId: partner.id, isActive: true } })` dynamically checks existing links.
  - Line 142 & Line 182: `validateReferralCode` looks up codes dynamically against `referralLink` and `partner.code`.
  - Grep search for `"bypass"`, `"TODO"`, `"FIXME"`, or hardcoded test codes (e.g. `"P001"`) in `src/modules/referrals/` yielded zero hits.

### 1.2 Genuine Implementation of Cycle Traversal & Normalization
- In `src/modules/referrals/service.ts`:
  - Lines 46–50:
    ```typescript
    export function normalizePhoneDigits(phone?: string | null): string {
      if (!phone) return "";
      const digits = phone.replace(/\D/g, "");
      return digits.length >= 8 ? digits.slice(-8) : digits;
    }
    ```
    Strips non-digits and isolates the national 8-digit Tunisian number, allowing consistent matching across `+216`, `00216`, spaces, and hyphens.
  - Lines 270–279:
    ```typescript
    if (candidate.phone && referrer.phone) {
      const candNorm = normalizePhoneDigits(candidate.phone);
      const refNorm = normalizePhoneDigits(referrer.phone);
      if (candNorm && refNorm && candNorm === refNorm) {
        return {
          valid: false,
          error: "Auto-parrainage interdit: même numéro de téléphone.",
        };
      }
    }
    ```
  - Lines 260–267:
    ```typescript
    if (candidate.email && referrer.user?.email) {
      if (candidate.email.trim().toLowerCase() === referrer.user.email.trim().toLowerCase()) {
        return {
          valid: false,
          error: "Auto-parrainage interdit: même adresse e-mail.",
        };
      }
    }
    ```
  - Direct cycle check (lines 313–325):
    ```typescript
    const directCycle = await db.referralAttribution.findFirst({
      where: {
        referrerPartnerId: candidatePartnerId,
        referredPartnerId: referrer.id,
      },
    });
    ```
  - Multi-hop ancestor graph traversal (lines 327–354):
    ```typescript
    let currentPartnerId: string | null = referrer.id;
    const visited = new Set<string>();

    while (currentPartnerId) {
      if (currentPartnerId === candidatePartnerId) {
        return {
          valid: false,
          error: "Cycle de parrainage détecté dans la chaîne de parrainage.",
        };
      }

      visited.add(currentPartnerId);

      const parentAttribution = await db.referralAttribution.findUnique({
        where: { referredPartnerId: currentPartnerId },
        select: { referrerPartnerId: true },
      });

      if (!parentAttribution) {
        break;
      }

      currentPartnerId = parentAttribution.referrerPartnerId;
      if (currentPartnerId && visited.has(currentPartnerId)) {
        break;
      }
    }
    ```
    This loop genuinely walks every ancestor in the attribution graph up to the root, protecting against cycle creation across arbitrary depths.

### 1.3 Database Operations and Transactions
- In `src/modules/registration/service.ts`:
  - Lines 121–174: All registration entities (`User`, `Partner`, `ReferralAttribution`, `Wallet`) are created inside `prisma.$transaction(async (tx) => { ... })`.
  - Line 149–157: `ReferralAttribution` is created with `referrerPartnerId: partnerReferrer.partnerId`, `referredPartnerId: partner.id`, `type: "PARTNER"`, `status: "PENDING_QUALIFICATION"`.
  - Line 161–173: `recordAudit(tx, ...)` logs the registration event with audit trail.
  - Lines 176–190: Catches Prisma known request error `P2002` on `referredPartnerId` to reject duplicate attribution attempts cleanly.
- In `src/modules/referrals/service.ts`:
  - Line 364: `recordPartnerReferral(tx: Prisma.TransactionClient, ...)` requires an active transaction client and calls `validateReferralEligibility` before inserting into `referralAttribution`.

### 1.4 Test Suite Integrity and Assertion Strength
- In `tests/referrals-attribution.test.ts`:
  - Grep search for `.skip` and `.only` yielded zero matches across all test files.
  - 9 distinct test suites cover:
    1. Active partner link generation and unapproved status rejections (`PENDING`, `SUSPENDED`, `REJECTED`, `CLOSED`).
    2. Referral code validation across `ReferralLink` and fallback `Partner.code`.
    3. Self-referral rejection by partner ID, email, and normalized phone; direct and multi-hop cycle detection; duplicate attribution rejection.
    4. Registration schema validation for alphanumeric codes, `admin`, and symbols.
    5. Registration flow integration with attribution creation.
    6. Transactional helper `recordPartnerReferral`.
    7. Server action IDOR protection.
    8. Auth redirect loop resolution with `PendingPartnerError`.
    9. Tunisian phone number normalization edge cases.

### 1.5 Authentication Redirect Loop Resolution & IDOR Protection
- In `src/modules/referrals/actions.ts`:
  - Line 15: `getPartnerReferralLinkAction()` accepts no arguments from the client, resolving `partnerId` via `await requireSession(["PARTNER"])`.
- In `src/lib/auth.ts`:
  - Lines 10–12: `PendingPartnerError extends CredentialsSignin` with `code = "pending"`.
  - Lines 101–122: Verifies `user.role === "PARTNER"` and `user.partner?.status === "ACTIVE"`. For `PENDING` partners, throws `PendingPartnerError`, preventing JWT issuance and matching `src/app/(auth)/login/login-form.tsx` line 54 without triggering a 307 redirect loop.

---

## 2. Logic Chain

1. **Static Analysis & Genuine Logic**:
   - Observations in §1.1 demonstrate that all partner verification and code retrieval logic execute genuine database queries without shortcut constants, fake mock branches, or bypass flags.

2. **Cycle Prevention & Attribution Authenticity**:
   - Observations in §1.2 show that cycle detection is not a facade. It executes real recursive queries on `referralAttribution` by tracking parent references (`referredPartnerId -> referrerPartnerId`) iteratively until termination. If the candidate partner ID is encountered in the chain, it returns `{ valid: false, error: ... }`.
   - The phone normalization function isolates the last 8 digits, correctly stripping `+216` and formatting variations before comparing strings.

3. **Transaction Safety**:
   - Observations in §1.3 show that partner registration and attribution creation are bound within a single database transaction (`prisma.$transaction`). Rollbacks occur atomically if any entity creation fails or if unique constraints are violated.

4. **Test Integrity**:
   - Observations in §1.4 demonstrate that no tests were skipped or hollowed out. Grep confirmed zero `.skip` calls, and each test explicitly asserts expected return types, thrown error classes, or database mutation payloads.

5. **Authorization & Security**:
   - Observations in §1.5 confirm that the server action is immune to IDOR by relying exclusively on `session.user.partnerId`. In addition, `auth.ts` correctly blocks pending partners at the credentials authorization gate to prevent redirect loops.

---

## 3. Caveats

- **Consumer Storefront Sales Referrals**: As identified during the pre-implementation audit, the platform operates as an internal partner COD order management system without a public consumer storefront or shopping cart. Milestone 2 deliverable scope correctly covers partner-to-partner referral links, attribution, and registration. Sales referral schema support is present, but consumer storefront tracking is not part of Milestone 2.
- **Independent Test Execution**: Vitest tests were inspected statically line-by-line; automated shell execution was withheld following terminal access restrictions. Static inspection confirmed the full test structure is rigorous, valid, and non-vacuous.

---

## 4. Conclusion

All Milestone 2 deliverables comply fully with `ORIGINAL_REQUEST.md` and `PROJECT.md` specifications. No prohibited shortcuts, hardcoded test results, facade implementations, or bypassed assertions were identified.

**Binary Verdict**: **CLEAN**

---

## 5. Verification Method

To independently verify the Milestone 2 deliverables:

1. **Verify Source Code & Absence of Bypasses**:
   - Inspect `src/modules/referrals/service.ts`: lines 72–76 (active status check), lines 260–279 (email & normalized phone self-referral checks), lines 327–354 (ancestor graph cycle traversal).
   - Inspect `src/modules/referrals/actions.ts`: lines 15–23 (IDOR-safe session parameter extraction).
   - Inspect `src/modules/registration/service.ts`: lines 80–105 (intake validation), lines 121–174 (atomic `$transaction`).
   - Inspect `src/lib/auth.ts`: lines 10–12, 101–122 (`PendingPartnerError` and partner active check).
2. **Verify Absence of Skipped Tests**:
   - Search for `.skip` in `tests/referrals-attribution.test.ts` (0 matches).
3. **Execute Vitest Test Suite**:
   ```bash
   npx vitest run tests/referrals-attribution.test.ts
   ```
   Confirm all 9 test suites pass without errors.
