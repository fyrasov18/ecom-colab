## 2026-10-09T00:06:30Z
You are the E2E Test Suite Designer & Implementer for the Referral & Commission Project.
Your working directory is: d:\e-com collab\.agents\teamwork\teamwork_preview_test_writer_e2e
Original request path: d:\e-com collab\.agents\teamwork\ORIGINAL_REQUEST.md

You MUST read d:\e-com collab\.agents\teamwork\ORIGINAL_REQUEST.md first before proceeding.
Also read:
- d:\e-com collab\.agents\teamwork\PROJECT.md
- d:\e-com collab\.agents\teamwork\AUDIT_SUMMARY.md

DO NOT CHEAT. All implementations must be genuine. Write real tests that assert required behaviors.

Your exclusive write boundaries:
- .agents/teamwork/TEST_INFRA.md
- tests/e2e-referral/**/*.test.ts
- .agents/teamwork/TEST_READY.md

Task instructions:
1. Create `.agents/teamwork/TEST_INFRA.md` following the template in Project Pattern:
   - Detail Test Philosophy: Opaque-box, requirement-driven, derived from ORIGINAL_REQUEST.md.
   - Feature Inventory mapping to test tiers.
   - 4-Tier Test Architecture:
     - Tier 1: Feature Coverage (>=5 per feature)
     - Tier 2: Boundary & Corner Cases (>=5 per feature)
     - Tier 3: Cross-Feature Combinations (pairwise coverage)
     - Tier 4: Real-World Application Scenarios (>=5 comprehensive flows)
2. Create test suites in `tests/e2e-referral/`:
   - `tier1-features.test.ts`: Test each feature from R2, R3, R4, R5 in isolation.
   - `tier2-boundaries.test.ts`: Empty inputs, zero profit, negative profit, boundary referral counts (0, 2, 3, 9, 10), max amounts, rate limit bounds.
   - `tier3-interactions.test.ts`: Combinations: partner promotion + settled order + expense deductions + pool splitting.
   - `tier4-scenarios.test.ts`: End-to-end realistic lifecycle scenarios (partner registers with ref code -> admin approves -> referred partner places order -> delivery & 48h settlement -> commission generated -> admin reviews and approves -> payout recorded).
3. Verify test runner execution.
4. When test cases are in place, create `.agents/teamwork/TEST_READY.md` summarizing the test runner command, tiers, and feature checklist.
5. Write your handoff report to `d:\e-com collab\.agents\teamwork\teamwork_preview_test_writer_e2e\handoff.md` and message the caller.
