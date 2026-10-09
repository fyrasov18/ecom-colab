## 2026-10-09T06:17:26Z
You are the Worker for Milestone 5: Admin & Partner Dashboards UI.
Your working directory is: d:\e-com collab\.agents\teamwork\teamwork_preview_worker_m5
Original request path: d:\e-com collab\.agents\teamwork\ORIGINAL_REQUEST.md

You MUST read d:\e-com collab\.agents\teamwork\ORIGINAL_REQUEST.md first before proceeding.
Also read:
- d:\e-com collab\.agents\teamwork\PROJECT.md
- d:\e-com collab\.agents\teamwork\AUDIT_SUMMARY.md

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your exclusive write boundaries:
- src/app/(admin)/partenaires/parrainage/*
- src/app/(partner)/parrainage/*
- src/components/layout/app-shell.tsx
- tests/dashboards.test.ts

Task instructions:
1. Build Admin Referral & Commission Hub in `src/app/(admin)/partenaires/parrainage/`:
   - `page.tsx`: Server component calling `requireSession(["SUPER_ADMIN", "ADMIN"])`.
   - Overview metrics: active links, total attributions, qualified referrals, pending approval queue count, total paid commissions.
   - Attributions list: Referrer, Referred Partner, Status (`PENDING_QUALIFICATION`, `QUALIFIED`), Qualifying Order ID and date.
   - Promotion Queue: Partners who have reached referral thresholds (3, 10) with action button to confirm promotion.
   - Commission Approval Queue: commissions in `ELIGIBLE` or `PENDING_VERIFICATION` status with detailed breakdown modal ($R, E, P, A, B, C$), approve button, and reject button (with mandatory reason).
   - Payment Queue: commissions in `APPROVED_FOR_PAYMENT` with "Enregistrer le paiement" button requiring transaction reference.
   - Historical ledger / payout log: `PAID`, `REJECTED`, `REVERSED` commissions with full audit information.
   - `actions.ts`: Admin server actions (`approveCommissionAction`, `rejectCommissionAction`, `payCommissionAction`, `confirmPromotionAction`) strictly enforcing `requireSession(["SUPER_ADMIN", "ADMIN"])`.
2. Build Partner Referral Dashboard in `src/app/(partner)/parrainage/`:
   - `page.tsx`: Server component calling `requireSession(["PARTNER"])`.
   - IDOR immunity: strictly scopes all queries to `session.user.partnerId`.
   - Referral Link Card: displays unique referral link (`/register?ref=CODE`) and code with copy button and share details.
   - Referral Level Card: current level (1, 2, or 3), commission rate (5%, 10%, 15%), and progress bar towards next level threshold.
   - Commission Summary Cards: Pending/Eligible, Approved for payment, Paid.
   - Referred Partners Table: list of partners referred by this user, registration date, qualification status.
   - Commission History Table: chronological history of referral earnings with full calculation transparency ($R, E, P, A, B, C$) and explicit status badges.
3. Update App Navigation in `src/components/layout/app-shell.tsx`:
   - Add "Parrainage" navigation item under admin sidebar (`/partenaires/parrainage`).
   - Add "Parrainage" navigation item under partner sidebar (`/parrainage`).
4. Author comprehensive tests in `tests/dashboards.test.ts`:
   - Test admin authorization gates: non-admin access is rejected.
   - Test partner scoping: partner cannot view another partner's referrals or commissions (IDOR protection).
   - Test admin server actions: approving commission, rejecting commission (requires reason), recording payment (requires reference).
   - Test data formatting: transparent display of $R, E, P, A, B, C$ breakdown.
5. Write full handoff report to `d:\e-com collab\.agents\teamwork\teamwork_preview_worker_m5\handoff.md`.
