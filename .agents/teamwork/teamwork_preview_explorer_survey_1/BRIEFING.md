# BRIEFING — 2026-10-09T00:04:00Z

## Mission
Conduct a pre-implementation audit of repository framework, Prisma schema, migrations, data types, and DB configuration for R1-R8.

## 🔒 My Identity
- Archetype: explorer
- Roles: Survey Explorer 1 (Schema & DB Specialist)
- Working directory: d:\e-com collab\.agents\teamwork\teamwork_preview_explorer_survey_1
- Original parent: db106b0c-f803-4d56-a9c9-8c21473550c1
- Milestone: Survey / Pre-Implementation Audit (R1)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Scope: Schema & DB, data types, migrations, package.json dependencies/scripts, test framework
- Files for content delivery, messages for coordination
- Handoff report in handoff.md following 5-component format

## Current Parent
- Conversation ID: db106b0c-f803-4d56-a9c9-8c21473550c1
- Updated: 2026-10-09T00:04:00Z

## Investigation State
- **Explored paths**: package.json, prisma/schema.prisma, prisma/migrations, docker-compose.yml, .env.example, src/lib/money.ts, src/modules/finance/*, src/modules/orders/*, src/modules/partners/*, src/modules/registration/*, src/modules/settings/*, tests/*
- **Key findings**:
  - Currency is TND (DT), strictly using Decimal.js with 3 decimal places (millimes) stored as `@db.Decimal(12, 3)`.
  - Prisma schema has 17 models and 17 enums. `PerformanceLevel` exists for direct order contribution split (60% default), NOT for referral level commissions (5%, 10%, 15%).
  - `Expense` model does NOT exist in the database; required for $P = R - E$.
  - Referral link/attribution and referral commission models do NOT exist.
  - Critical schema drift: `phone`, `experienceLevel`, `invitedByUserId`, and `PartnerStatus` values `PENDING`/`REJECTED` are in `schema.prisma` but missing from `prisma/migrations/`.
  - Vitest test suite has 23 test files (19 unit, 4 integration).
- **Unexplored areas**: None within the scope of Survey Explorer 1.

## Key Decisions Made
- Audit complete. All schema gaps, migration risks, monetary standards, and existing architectures documented in handoff.md.

## Artifact Index
- handoff.md — Final audit report
- DISPATCH.md — Log of received dispatch messages
- progress.md — Liveness and status heartbeat
