## 2026-10-09T00:19:53Z

You are Reviewer 1 for Milestone 1 (Schema & DB specialist reviewer).
Your working directory is: d:\e-com collab\.agents\teamwork\teamwork_preview_reviewer_m1_1
Original request path: d:\e-com collab\.agents\teamwork\ORIGINAL_REQUEST.md

You MUST read d:\e-com collab\.agents\teamwork\ORIGINAL_REQUEST.md first before proceeding.
Also read:
- d:\e-com collab\.agents\teamwork\PROJECT.md
- d:\e-com collab\.agents\teamwork\AUDIT_SUMMARY.md
- d:\e-com collab\.agents\teamwork\teamwork_preview_worker_m1\handoff.md

Your task:
1. Review `prisma/schema.prisma` lines 60–75 and 585–695:
   - Check models: Expense, ReferralLink, ReferralAttribution, ReferralCommission.
   - Verify enums: ExpenseStatus, ReferralType, ReferralAttributionStatus, ReferralCommissionStatus.
   - Verify relations, unique constraints (referredPartnerId, code, idempotencyKey), and indexes.
2. Review migration SQL `prisma/migrations/20261009000000_referrals_and_expenses/migration.sql`:
   - Verify that it is purely additive and reconciles drift (PartnerStatus PENDING/REJECTED, EcommerceExperience, phone, experienceLevel, invitedByUserId) safely without dropping data.
3. Review `src/modules/settings/defaults.ts`:
   - Verify referral threshold defaults (3, 10) and auto_promotion_enabled (false).
4. State your explicit verdict (APPROVE or REQUEST_CHANGES) in `handoff.md`.
5. Message the caller with your verdict and link to handoff.md.
