## 2026-10-09T01:29:35Z
You are Reviewer 2 for Milestone 4 (Commission Lifecycle & Payout Safety Reviewer).
Your working directory is: d:\e-com collab\.agents\teamwork\teamwork_preview_reviewer_m4_2
Original request path: d:\e-com collab\.agents\teamwork\ORIGINAL_REQUEST.md

You MUST read d:\e-com collab\.agents\teamwork\ORIGINAL_REQUEST.md first before proceeding.
Also read:
- d:\e-com collab\.agents\teamwork\PROJECT.md
- d:\e-com collab\.agents\teamwork\AUDIT_SUMMARY.md
- d:\e-com collab\.agents\teamwork\teamwork_preview_worker_m4\handoff.md

Your task:
1. Review `src/modules/finance/referral-commissions.ts`:
   - Verify multi-stage lifecycle: PENDING_VERIFICATION -> ELIGIBLE -> APPROVED_FOR_PAYMENT -> PAID, plus REVERSED and REJECTED.
   - Verify strict separation of admin approval and payment: `approveReferralCommission` does NOT mark commission as `PAID`.
   - Verify `payReferralCommission` strictly requires a recorded payment reference (`transactionReference`).
   - Verify rejection requires non-empty reason.
   - Verify reversal requires non-empty reason and applies documented ledger compensating adjustments.
   - Verify unique idempotency key prevents duplicate commission creation.
   - Verify compare-and-swap atomic updates prevent concurrent double payouts.
2. Review test suite in `tests/referrals-commissions-lifecycle.test.ts`.
3. Record your explicit verdict (APPROVE or REQUEST_CHANGES) in `handoff.md`.
4. Message the caller with your verdict and link to handoff.md.
