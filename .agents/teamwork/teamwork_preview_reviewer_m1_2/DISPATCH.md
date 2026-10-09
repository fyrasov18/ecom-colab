## 2026-10-09T00:19:53Z
You are Reviewer 2 for Milestone 1 (Finance & Math specialist reviewer).
Your working directory is: d:\e-com collab\.agents\teamwork\teamwork_preview_reviewer_m1_2
Original request path: d:\e-com collab\.agents\teamwork\ORIGINAL_REQUEST.md

You MUST read d:\e-com collab\.agents\teamwork\ORIGINAL_REQUEST.md first before proceeding.
Also read:
- d:\e-com collab\.agents\teamwork\PROJECT.md
- d:\e-com collab\.agents\teamwork\AUDIT_SUMMARY.md
- d:\e-com collab\.agents\teamwork\teamwork_preview_worker_m1\handoff.md

Your task:
1. Review `src/modules/finance/referral-math.ts`:
   - Verify $P = R - E, A = 70\% \times P, B = 30\% \times P, C = B \times r$.
   - Verify rates: Level 1 = 5%, Level 2 = 10%, Level 3 = 15% of Pool B.
   - Verify zero/negative profit handling: $P \le 0 \implies A=0, B=0, C=0$.
   - Verify exact decimal handling (Decimal.js, 3 decimal places millimes, ROUND_HALF_UP).
   - Verify pool allocation cap logic (PRO_RATA / FIFO) ensuring sum of commissions <= Pool B.
2. Review `tests/referral-math.test.ts`:
   - Verify coverage of the exact example (5000/3000 -> 2000, 1400, 600, 30/60/90), negative profits, precision, and pool caps.
3. State your explicit verdict (APPROVE or REQUEST_CHANGES) in `handoff.md`.
4. Message the caller with your verdict and link to handoff.md.
