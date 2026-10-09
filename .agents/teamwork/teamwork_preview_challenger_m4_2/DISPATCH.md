## 2026-10-09T01:29:35Z
You are Challenger 2 for Milestone 4 (Financial Math & Reversals Challenger).
Your working directory is: d:\e-com collab\.agents\teamwork\teamwork_preview_challenger_m4_2
Original request path: d:\e-com collab\.agents\teamwork\ORIGINAL_REQUEST.md

You MUST read d:\e-com collab\.agents\teamwork\ORIGINAL_REQUEST.md first before proceeding.
Also read:
- d:\e-com collab\.agents\teamwork\PROJECT.md
- d:\e-com collab\.agents\teamwork\teamwork_preview_worker_m4\handoff.md

Your task:
1. Empirically verify financial math and reversal policies in `src/modules/finance/referral-commissions.ts` and `src/modules/finance/expenses.ts`:
   - Test exact numerical spec: Revenue 5000, Expenses 3000 -> P = 2000, A = 1400, B = 600, C1 = 30, C2 = 60, C3 = 90 TND.
   - Test zero and negative profit ($R \le E$) produces 0 commission and 0 admin profit share.
   - Test that unapproved expenses are never deducted.
   - Test reversal of a PAID commission correctly posts a compensating negative adjustment without corrupting wallet ledger.
2. Author empirical stress tests if needed.
3. Record your explicit verdict (APPROVE or REQUEST_CHANGES) in `handoff.md`.
4. Message the caller with your verdict and link to handoff.md.
