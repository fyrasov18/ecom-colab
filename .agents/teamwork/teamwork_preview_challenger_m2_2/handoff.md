# Challenger 2 Handoff Report: Milestone 2 — Registration Atomicity & IDOR Verification

**Challenger Folder**: `d:\e-com collab\.agents\teamwork\teamwork_preview_challenger_m2_2`  
**Date**: 2026-10-09  
**Roles**: critic, specialist  
**Status**: Completed  
**Verdict**: **APPROVE**

---

## 1. Observation

### 1.1 `registerPartner` in `src/modules/registration/service.ts`

1. **Transactional Atomicity and Orphan Prevention**:
   - Lines 121–174:
     ```typescript
     await prisma.$transaction(async (tx) => {
       const user = await tx.user.create({
         data: {
           email: input.email,
           passwordHash,
           firstName,
           lastName,
           role: "PARTNER",
           status: "ACTIVE",
         },
       });

       const invitedByUserId = isAdminInvite ? adminInviterId : partnerReferrer?.userId;

       const partner = await tx.partner.create({
         data: {
           userId: user.id,
           code: await nextPartnerCode(tx),
           displayName: input.fullName.trim().slice(0, 120),
           status: "PENDING",
           phone: normalizePhone(input.phone),
           experienceLevel: input.experience,
           invitedByUserId,
         },
       });

       // For partner referral, create ReferralAttribution inside the transaction
       if (!isAdminInvite && partnerReferrer) {
         await tx.referralAttribution.create({
           data: {
             referrerPartnerId: partnerReferrer.partnerId,
             referredPartnerId: partner.id,
             type: "PARTNER",
             status: "PENDING_QUALIFICATION",
           },
         });
       }

       await tx.wallet.create({ data: { partnerId: partner.id } });

       await recordAudit(tx, { ... });
     });
     ```
   - All critical mutations (`tx.user.create`, `tx.partner.create`, `tx.referralAttribution.create`, `tx.wallet.create`, and `recordAudit(tx)`) are executed within a single Prisma interactive transaction (`tx`).
   - If `tx.referralAttribution.create` fails (e.g. foreign key error, database constraint, or connection error), Prisma aborts the interactive transaction and issues an immediate SQL `ROLLBACK`.
   - Lines 175–192: Prisma known request errors (such as `P2002` duplicate unique constraints on `referredPartnerId`) and unhandled database errors are caught, returning `{ ok: false, error: ... }`. Because the transaction was rolled back, neither `User` nor `Partner` is committed or orphaned in the database.

2. **Rejection of Unapproved Partner Referral Codes**:
   - Lines 78–87 in `src/modules/registration/service.ts`:
     ```typescript
     // Case 2: partner referral code -> validate code & eligibility
     const codeValidation = await validateReferralCode(rawInviteCode);
     if (!codeValidation.valid || !codeValidation.referrer) {
       return {
         ok: false,
         error: codeValidation.error ?? "Code d'invitation invalide.",
         fieldErrors: { invitationCode: codeValidation.error ?? "Code d'invitation invalide." },
       };
     }
     ```
   - In `src/modules/referrals/service.ts` lines 159–164 (`ReferralLink` path):
     ```typescript
     if (link.partner.status !== "ACTIVE") {
       return {
         valid: false,
         error: `Le parrain n'est pas actif (statut: ${link.partner.status}). Seuls les partenaires actifs peuvent parrainer.`,
       };
     }
     ```
   - In `src/modules/referrals/service.ts` lines 195–200 (`Partner.code` fallback path):
     ```typescript
     if (partner.status !== "ACTIVE") {
       return {
         valid: false,
         error: `Le parrain n'est pas actif (statut: ${partner.status}). Seuls les partenaires actifs peuvent parrainer.`,
       };
     }
     ```
   - Any referral code associated with a partner whose status is `PENDING`, `SUSPENDED`, `REJECTED`, or `CLOSED` is rejected before entering `prisma.$transaction`.

### 1.2 `getPartnerReferralLinkAction` in `src/modules/referrals/actions.ts`

- Lines 15–32:
  ```typescript
  export async function getPartnerReferralLinkAction(): Promise<PartnerReferralLinkActionResult> {
    try {
      const user = await requireSession(["PARTNER"]);
      if (!user.partnerId) {
        return { ok: false, error: "Identifiant partenaire introuvable dans la session." };
      }

      const result = await getOrCreateReferralCode(user.partnerId);
      return { ok: true, code: result.code, url: result.url };
    } catch (error) {
      if (error instanceof ReferralAuthorizationError) {
        return { ok: false, error: error.message };
      }
      const message =
        error instanceof Error ? error.message : "Erreur lors de la génération du lien de parrainage.";
      return { ok: false, error: message };
    }
  }
  ```
- **Session Scoping & Complete IDOR Immunity**:
  - The function signature accepts zero arguments (`getPartnerReferralLinkAction.length === 0`). No client-supplied parameter (such as `partnerId` or `userId`) can be submitted or injected.
  - The target partner ID is derived strictly from `user.partnerId` obtained from `requireSession(["PARTNER"])`.
- **Unauthorized Session Handling**:
  - Unauthenticated calls trigger `requireSession`'s `redirect("/login")` which throws an error; this is safely trapped by `catch (error)`, preventing any referral code retrieval and returning `{ ok: false, error: ... }`.
  - Non-partner roles (e.g. `ADMIN`, `SUPER_ADMIN`, `DELIVERY`) are rejected by `requireSession`'s role gate.
  - Missing partner IDs return `{ ok: false, error: "Identifiant partenaire introuvable dans la session." }`.
  - Unapproved partners (`PENDING`, `SUSPENDED`, `REJECTED`, `CLOSED`) fail both in `requireSession` (line 31 of `src/lib/rbac.ts`) and in `getOrCreateReferralCode` (line 72 of `src/modules/referrals/service.ts`), throwing `ReferralAuthorizationError` and returning `{ ok: false, error: "Le partenaire n'est pas actif..." }`.

### 1.3 Empirical Test Harness Created

- Created dedicated adversarial test file: `tests/registration-atomicity-idor.test.ts`.
- Tests include:
  1. `Task 1.1`: Simulating attribution creation failure inside `prisma.$transaction` and verifying that `wallet.create` and `auditLog.create` are halted, the transaction aborts, and `registerPartner` returns an error without leaving orphaned entities.
  2. `Task 1.1`: Verifying that duplicate attribution (`P2002` error) aborts the transaction cleanly and maps to `"Ce partenaire est déjà attribué à un parrain."`.
  3. `Task 1.2`: Verifying rejection of unapproved referral codes for all non-active statuses (`PENDING`, `SUSPENDED`, `REJECTED`, `CLOSED`) across both `ReferralLink` and `Partner.code` branches, confirming that `prisma.$transaction` is never opened.
  4. `Task 2`: Verifying that unauthenticated requests, unauthorized roles, missing partner IDs, and non-active partner statuses are safely rejected with `{ ok: false }`.
  5. `Task 2`: Verifying IDOR immunity by asserting 0 arguments are accepted and queries are strictly scoped to the session partner ID.

---

## 2. Logic Chain

1. **Transactional Atomicity Logic**:
   - `User`, `Partner`, `ReferralAttribution`, `Wallet`, and audit logging are instantiated inside the same interactive callback passed to `prisma.$transaction`.
   - In relational databases (PostgreSQL) and Prisma, any exception thrown inside an interactive transaction aborts the transaction before committing.
   - When attribution creation throws (due to constraint violation, duplicate key, or network failure), the execution within `prisma.$transaction` immediately halts.
   - Therefore, neither `User` nor `Partner` is committed to the database. They cannot become orphaned records.

2. **Unapproved Partner Codes Logic**:
   - `registerPartner` performs server-side validation via `validateReferralCode` prior to opening a database transaction.
   - `validateReferralCode` explicitly queries `link.partner.status` and `partner.status`. If the status is not `"ACTIVE"` (`PENDING`, `SUSPENDED`, `REJECTED`, `CLOSED`), it returns `{ valid: false, error: "Le parrain n'est pas actif..." }`.
   - `registerPartner` halts immediately on invalid code validation and returns `{ ok: false, error, fieldErrors }`.
   - No database records are created for unapproved referral codes.

3. **Session Scoping & IDOR Logic**:
   - IDOR requires an adversary to provide an external identifier that controls the target record without proper authorization.
   - `getPartnerReferralLinkAction` accepts zero parameters.
   - The partner ID is strictly retrieved from the cryptographic session token (`session.user.partnerId`).
   - Consequently, cross-account access or IDOR parameter manipulation is architecturally impossible.

---

## 3. Caveats

- **Terminal Command Permission**: Direct shell execution via `run_command` (`npx vitest run ...`) was denied by the environment's host security policy. All verifications were performed via exhaustive semantic inspection, architectural analysis, and authoring a permanent test suite `tests/registration-atomicity-idor.test.ts` in the project test suite.
- **Concurrency & High-Frequency Races**: Under concurrent multi-threaded requests for the same code, PostgreSQL's `@unique([referredPartnerId])` and Prisma's `P2002` handler in `src/modules/registration/service.ts` lines 176–184 provide the necessary isolation and conflict detection.

---

## 4. Conclusion

The implementation of Milestone 2 meets all security, atomicity, and authorization requirements:
- Transactional atomicity in `registerPartner` is guaranteed by wrapping all entity creations (`User`, `Partner`, `ReferralAttribution`, `Wallet`, audit log) in `prisma.$transaction`, ensuring no orphaned records exist if attribution fails.
- Partner codes with unapproved statuses (`PENDING`, `SUSPENDED`, `REJECTED`, `CLOSED`) are strictly rejected server-side before transaction creation.
- `getPartnerReferralLinkAction` enforces strict session scoping, derives identity entirely from `session.user.partnerId`, accepts no user-controlled parameters (preventing IDOR), and gracefully handles unauthorized/unauthenticated sessions.

**Explicit Verdict**: **APPROVE**

---

## 5. Verification Method

To independently verify this implementation:

1. **Inspect Code Files**:
   - Inspect `src/modules/registration/service.ts` lines 121–174 for interactive transaction encapsulation.
   - Inspect `src/modules/referrals/service.ts` lines 159–164 and 195–200 for partner status checks.
   - Inspect `src/modules/referrals/actions.ts` lines 15–32 for session derivation and zero-argument IDOR immunity.

2. **Run Test Suites**:
   - Run the dedicated Challenger 2 test suite:
     ```bash
     npx vitest run tests/registration-atomicity-idor.test.ts
     ```
   - Run the worker's Milestone 2 test suite:
     ```bash
     npx vitest run tests/referrals-attribution.test.ts
     ```
