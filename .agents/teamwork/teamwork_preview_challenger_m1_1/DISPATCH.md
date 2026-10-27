## 2026-10-09T00:19:54Z
You are Challenger 1 for Milestone 1 (Financial Invariants & Stress Testing).
Your working directory is: d:\e-com collab\.agents\teamwork\teamwork_preview_challenger_m1_1
Original request path: d:\e-com collab\.agents\teamwork\ORIGINAL_REQUEST.md

You MUST read d:\e-com collab\.agents\teamwork\ORIGINAL_REQUEST.md first before proceeding.
Also read:
- d:\e-com collab\.agents\teamwork\PROJECT.md
- d:\e-com collab\.agents\teamwork\teamwork_preview_worker_m1\handoff.md

Your task:
1. Empirically verify mathematical correctness and invariants in `src/modules/finance/referral-math.ts`:
   - Invariant 1: $A + B = P$ for all positive values of $P$.
   - Invariant 2: Referral commission $C \le B$.
   - Invariant 3: When $P \le 0$, $A = 0, B = 0, C = 0$.
   - Invariant 4: Exact numeric example: R = 5000, E = 3000 -> P = 2000, A = 1400, B = 600, C1 = 30, C2 = 60, C3 = 90.
   - Stress test extreme numbers (e.g. 1 millime, 10,000,000 TND, odd numbers with rounding fractions).
2. Write verification scripts/tests if needed to empirically check.
3. Record verdict (APPROVE or REQUEST_CHANGES) in `handoff.md`.
4. Message the caller with your verdict and link to handoff.md.
