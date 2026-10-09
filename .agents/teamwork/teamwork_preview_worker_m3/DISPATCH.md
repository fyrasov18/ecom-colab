## 2026-10-09T00:58:31Z
You are the Worker for Milestone 3: Qualification & Partner Levels.
Your working directory is: d:\e-com collab\.agents\teamwork\teamwork_preview_worker_m3
Original request path: d:\e-com collab\.agents\teamwork\ORIGINAL_REQUEST.md

You MUST read d:\e-com collab\.agents\teamwork\ORIGINAL_REQUEST.md first before proceeding.
Also read:
- d:\e-com collab\.agents\teamwork\PROJECT.md
- d:\e-com collab\.agents\teamwork\AUDIT_SUMMARY.md

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your exclusive write boundaries:
- src/modules/referrals/levels.ts
- src/modules/referrals/qualification.ts
- src/modules/finance/ledger.ts
- tests/referrals-levels.test.ts

Task instructions:
1. Implement qualification module in `src/modules/referrals/qualification.ts`:
   - `checkAndQualifyOrder(orderId: string, tx?: Prisma.TransactionClient)`:
     - Loads order. Validates that `order.status === "DELIVERED"` and `order.earningStatus === "AVAILABLE"`.
     - Looks up `ReferralAttribution` where `referredPartnerId === order.partnerId`.
     - If attribution has `status === "PENDING_QUALIFICATION"`:
       - Atomically updates attribution to `QUALIFIED`.
       - Sets `qualifyingOrderId = order.id`, `qualifiedAt = new Date()`.
       - Records audit log.
       - If auto-promotion is enabled, triggers level check for `referrerPartnerId`.
       - Returns `{ qualified: true, referrerPartnerId, attributionId }`.
     - If attribution is already `QUALIFIED`:
       - Returns `{ qualified: false, reason: "ALREADY_QUALIFIED" }` (idempotent, deduplicated).
     - If no attribution or order not delivered/settled: returns `{ qualified: false, reason: ... }`.
2. Connect settlement hook in `src/modules/finance/ledger.ts`:
   - In `settleDueEarnings()`: when updating order `earningStatus` to `AVAILABLE`, invoke `checkAndQualifyOrder(order.id, tx)`.
3. Implement partner levels and promotion engine in `src/modules/referrals/levels.ts`:
   - Level constants: Level 1 (5%), Level 2 (10%), Level 3 (15%).
   - Dynamic threshold evaluation: reads `referral.level2_threshold` (default 3), `referral.level3_threshold` (default 10), and `referral.auto_promotion_enabled` (default false) via system settings.
   - `getPartnerReferralLevel(partnerId: string, tx?: Prisma.TransactionClient)`:
     - Counts distinct `QUALIFIED` direct attributions (`referrerPartnerId === partnerId`, `status === "QUALIFIED"`).
     - Direct referrals only! Downline/indirect partners NEVER count.
     - Evaluates target level: Level 3 (count >= 10), Level 2 (count >= 3), Level 1 (otherwise).
     - Handles promotion state: if `auto_promotion_enabled` is false, flags promotion eligibility for admin confirmation.
     - Preserves effective date: records when a level became active. Finalized historical commissions are NEVER retroactively altered.
     - Inactivity policy: Partners are NEVER automatically demoted for inactivity.
4. Author comprehensive unit & integration tests in `tests/referrals-levels.test.ts`:
   - Qualifying order requires BOTH `DELIVERED` AND settled earning (`earningStatus === "AVAILABLE"`).
   - Registration or approval alone does NOT qualify.
   - Subsequent orders by the same partner do NOT double-qualify or double-count.
   - Configurable thresholds (3, 10) dynamically respected.
   - Auto-promotion disabled flag: stays at Level 1 pending admin confirmation; when enabled, promotes to Level 2 (at 3) and Level 3 (at 10).
   - Direct referrals qualify; indirect downline referrals do NOT qualify.
   - Effective date rule: level rate applies at commission calculation time; historical commissions unchanged.
   - No inactivity demotion.
5. Write full handoff report to `d:\e-com collab\.agents\teamwork\teamwork_preview_worker_m3\handoff.md`.
