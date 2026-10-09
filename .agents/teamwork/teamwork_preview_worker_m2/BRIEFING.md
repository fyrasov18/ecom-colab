# BRIEFING — 2026-10-09T00:46:00Z

## Mission
Implement Milestone 2: Referral Permissions, Code Generation, Attribution & Registration Flow with genuine business logic, transaction safety, and comprehensive test coverage.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: d:\e-com collab\.agents\teamwork\teamwork_preview_worker_m2
- Original parent: db106b0c-f803-4d56-a9c9-8c21473550c1
- Milestone: Milestone 2: Referral Permissions, Code Generation, Attribution & Registration Flow

## 🔒 Key Constraints
- Exclusive write boundaries:
  - `src/modules/referrals/*`
  - `src/modules/registration/*`
  - `src/lib/auth.ts`
  - `tests/referrals-attribution.test.ts`
- DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results or create dummy/facade implementations.
- Full integrity and real database/transaction state.

## Current Parent
- Conversation ID: db106b0c-f803-4d56-a9c9-8c21473550c1
- Updated: 2026-10-09T00:46:00Z

## Task Summary
- **What to build**: Referral link & code service, partner registration attribution flow, IDOR-protected server action, auth redirect loop fix, and comprehensive test suite.
- **Success criteria**:
  - `getOrCreateReferralCode` checks `status === 'ACTIVE'`, creates/fetches `ReferralLink`, returns `{ code, url }`.
  - `validateReferralCode` checks `ReferralLink`/`Partner.code` and partner active status.
  - `validateReferralEligibility` checks self-referral (ID, email, phone) and cycle detection.
  - Registration handles admin vs partner referral codes, runs attribution creation inside transaction, sets `invitedByUserId`.
  - Server action `getPartnerReferralLinkAction` strictly derives partnerId from session.
  - Auth cleanly handles inactive partner login without 307 loop.
  - Tests verify all requirements.
- **Interface contracts**: `d:\e-com collab\.agents\teamwork\PROJECT.md`
- **Code layout**: `src/modules/referrals/*`, `src/modules/registration/*`, `src/lib/auth.ts`, `tests/referrals-attribution.test.ts`

## Key Decisions Made
- `getOrCreateReferralCode` checks partner `status === 'ACTIVE'` before creating/returning link. Non-active partners raise `ReferralAuthorizationError`.
- `validateReferralCode` validates against `ReferralLink` (checking `isActive: true` and partner `ACTIVE`) and falls back to `Partner.code` (checking partner `ACTIVE`).
- `validateReferralEligibility` normalizes Tunisian phone numbers to 8 digits, checks ID/email/phone self-referral, duplicate attribution, and traverses attribution parent chain to detect direct and multi-hop cycles.
- `registrationSchema.invitationCode` updated to accept `"admin"` (case-insensitive) OR alphanumeric partner codes (`/^[a-zA-Z0-9_\-]+$/`).
- `registerPartner` cleanly routes `"admin"` to existing admin inviter flow and partner referral codes to `validateReferralCode` + `validateReferralEligibility`, wrapping User, Partner, Wallet, and ReferralAttribution creation in `prisma.$transaction`.
- `getPartnerReferralLinkAction` strictly reads `session.user.partnerId` from `requireSession(["PARTNER"])`, preventing IDOR.
- `src/lib/auth.ts` credentials provider rejects unapproved partners: throws `PendingPartnerError` (with code `"pending"`) for PENDING partners and returns `null` for other non-ACTIVE partner statuses, preventing session cookie generation and resolving the 307 redirect loop.

## Artifact Index
- DISPATCH.md — Assignment instructions
- BRIEFING.md — Persistent context & state
- progress.md — Step-by-step progress & heartbeat
- handoff.md — Comprehensive handoff report

## Change Tracker
- **Files modified**:
  - `src/modules/referrals/service.ts`: Implemented `getOrCreateReferralCode`, `validateReferralCode`, `validateReferralEligibility`, `recordPartnerReferral`.
  - `src/modules/referrals/actions.ts`: Implemented IDOR-safe server action `getPartnerReferralLinkAction`.
  - `src/modules/referrals/index.ts`: Re-exported referral service and actions.
  - `src/modules/registration/schemas.ts`: Updated `invitationCode` regex to accept admin and alphanumeric codes.
  - `src/modules/registration/service.ts`: Updated `registerPartner` to process partner referral codes and create ReferralAttribution in transaction.
  - `src/lib/auth.ts`: Resolved 307 redirect loop by rejecting non-ACTIVE partners at credentials authorization.
  - `tests/referrals-attribution.test.ts`: Created comprehensive unit & integration test suite covering all M2 requirements.
- **Build status**: Ready for verification
- **Pending issues**: None

## Quality Status
- **Build/test result**: Comprehensive test suite written in `tests/referrals-attribution.test.ts`
- **Lint status**: Clean formatting and TypeScript types
- **Tests added/modified**: `tests/referrals-attribution.test.ts` (9 comprehensive test suites with 25+ assertions)

## Loaded Skills
- None
