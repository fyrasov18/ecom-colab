## 2026-10-09T00:29:24Z
You are the Worker for Milestone 2: Referral Permissions, Code Generation, Attribution & Registration Flow.
Your working directory is: d:\e-com collab\.agents\teamwork\teamwork_preview_worker_m2
Original request path: d:\e-com collab\.agents\teamwork\ORIGINAL_REQUEST.md

You MUST read d:\e-com collab\.agents\teamwork\ORIGINAL_REQUEST.md first before proceeding.
Also read:
- d:\e-com collab\.agents\teamwork\PROJECT.md
- d:\e-com collab\.agents\teamwork\AUDIT_SUMMARY.md
- d:\e-com collab\.agents\teamwork\teamwork_preview_explorer_survey_2\handoff.md

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your exclusive write boundaries:
- src/modules/referrals/*
- src/modules/registration/*
- src/lib/auth.ts
- tests/referrals-attribution.test.ts

Task instructions:
1. Implement referral link & code service in `src/modules/referrals/`:
   - `getOrCreateReferralCode(partnerId: string)`:
     - Enforces server-side check that `Partner.status === "ACTIVE"`. Rejects unapproved, pending, suspended, or closed partners with an authorization error.
     - Creates or fetches `ReferralLink` linked to the partner (`code` based on `Partner.code` or unique slug).
     - Returns `{ code, url }`.
   - `validateReferralCode(code: string)`:
     - Looks up code in `ReferralLink` or `Partner.code`.
     - Validates that the owning partner has `status === "ACTIVE"`.
     - Returns valid boolean and referrer details.
   - `validateReferralEligibility(referrerPartnerId: string, candidate: { id?: string, email?: string, phone?: string })`:
     - Checks and rejects self-referrals (candidate matching referrer partner ID, email, or phone).
     - Checks and rejects referral cycles (candidate must not be an ancestor referrer of the inviter).
2. Update partner registration in `src/modules/registration/`:
   - In `src/modules/registration/schemas.ts`:
     - Update `invitationCode` validation: accepts `"admin"` OR valid alphanumeric partner referral code.
   - In `src/modules/registration/service.ts`:
     - Case 1: `"admin"` -> preserves existing admin inviter flow.
     - Case 2: partner referral code ->
       - Validates code via `validateReferralCode`.
       - Validates eligibility via `validateReferralEligibility` (rejects self-referral, cycle, unapproved referrer).
       - Within the registration transaction:
         - Creates `User` and `Partner`.
         - Creates `ReferralAttribution` record (`referrerPartnerId`, `referredPartnerId`, `type: "PARTNER"`, `status: "PENDING_QUALIFICATION"`).
         - Sets `Partner.invitedByUserId = referrer.userId`.
3. Provide partner server action in `src/modules/referrals/actions.ts`:
   - `getPartnerReferralLinkAction()`:
     - Strictly derives `partnerId` from `session.user.partnerId` via `requireSession(["PARTNER"])`. Enforces complete IDOR protection.
4. Auth redirect loop resolution in `src/lib/auth.ts`:
   - Ensure that if a partner account is not `ACTIVE`, authentication handles it cleanly without infinite 307 loop.
5. Create comprehensive tests in `tests/referrals-attribution.test.ts`:
   - Verify only `ACTIVE` partners can create/have valid referral links.
   - Verify unapproved partners (`PENDING`, `SUSPENDED`, `REJECTED`) are rejected.
   - Verify self-referral by ID, email, or phone is rejected.
   - Verify referral cycles (A -> B -> A) are detected and rejected.
   - Verify duplicate attribution is rejected (`@@unique([referredPartnerId])`).
   - Verify invalid referral codes are rejected.
   - Verify valid referral creates attribution record inside transaction.
6. Write full handoff report to `d:\e-com collab\.agents\teamwork\teamwork_preview_worker_m2\handoff.md` and send completion message to caller.
