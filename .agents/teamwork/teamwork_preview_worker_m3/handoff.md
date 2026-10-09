# Milestone 3 Handoff Report: Qualification & Partner Levels

## 1. Observation
- `prisma/schema.prisma` lines 626–642 define `model ReferralAttribution` with `referrerPartnerId`, `referredPartnerId @unique`, `status ReferralAttributionStatus @default(PENDING_QUALIFICATION)`, `qualifyingOrderId String?`, and `qualifiedAt DateTime?`.
- `prisma/schema.prisma` lines 539–558 define `enum OrderStatus` containing `DELIVERED`, and `enum EarningStatus` containing `PENDING` and `AVAILABLE`.
- `src/modules/settings/defaults.ts` lines 8–11 define `SETTING_KEYS.REFERRAL_LEVEL2_THRESHOLD = "referral.level2_threshold"` (default 3), `SETTING_KEYS.REFERRAL_LEVEL3_THRESHOLD = "referral.level3_threshold"` (default 10), and `SETTING_KEYS.REFERRAL_AUTO_PROMOTION_ENABLED = "referral.auto_promotion_enabled"` (default false).
- `src/modules/finance/ledger.ts` line 156 defines `settleDueEarnings()` which transitions financial transaction entries from `PENDING` to `AVAILABLE` and line 178 updates `order.earningStatus` to `"AVAILABLE"`.
- Prior to Milestone 3, `src/modules/referrals/qualification.ts` and `src/modules/referrals/levels.ts` were absent from the repository.

## 2. Logic Chain
1. **Qualification Verification**: Requirement R2 specifies that a partner referral becomes reward-eligible only after the referred partner is approved AND has at least one qualifying order that is delivered and settled (`order.status === "DELIVERED"` AND `order.earningStatus === "AVAILABLE"`).
   - In `src/modules/referrals/qualification.ts`, `checkAndQualifyOrder(orderId, tx)` loads the order and validates both conditions.
   - It queries `ReferralAttribution` for `referredPartnerId === order.partnerId`.
   - If the attribution status is `PENDING_QUALIFICATION`, it atomically updates the record to `QUALIFIED`, sets `qualifyingOrderId = order.id`, records `qualifiedAt = new Date()`, writes an audit log to `AuditLog`, and triggers level evaluation if auto-promotion is enabled.
   - If already `QUALIFIED`, it idempotently returns `{ qualified: false, reason: "ALREADY_QUALIFIED" }`, preventing double-qualification.
   - If missing, unfulfilled, or rejected, it returns explicit descriptive failure reasons (`NO_ATTRIBUTION`, `ORDER_NOT_DELIVERED`, `EARNING_NOT_AVAILABLE`, `ATTRIBUTION_REJECTED`).
2. **Settlement Hook Connection**: In `src/modules/finance/ledger.ts`, inside `settleDueEarnings()`, right after `db.order.updateMany({ where: { id: { in: orderIds }, earningStatus: "PENDING" }, data: { earningStatus: "AVAILABLE" } })`, `checkAndQualifyOrder(orderId, db)` is invoked for each settled order ID. This binds the settlement lifecycle directly to referral qualification.
3. **Partner Levels & Promotion Engine**: Requirement R3 specifies Level 1 (5%), Level 2 (10%), Level 3 (15%) commission rates applied to direct referrals only, with dynamic thresholds and effective date preservation.
   - In `src/modules/referrals/levels.ts`, `REFERRAL_LEVEL_RATES` stores exact Decimal percentages (`0.05`, `0.10`, `0.15`).
   - Dynamic thresholds are read from `SystemSetting` via `getReferralThresholdSettings(db)`, falling back to defaults (3 for Level 2, 10 for Level 3, auto-promotion false).
   - `countDirectQualifiedReferrals(partnerId, db)` counts distinct `QUALIFIED` attributions where `referrerPartnerId === partnerId`. Because downline attributions have `referrerPartnerId` set to their immediate parent, indirect downline partners are never counted.
   - In `getPartnerReferralLevel(partnerId, tx)`, if `auto_promotion_enabled` is false, target level eligibility is flagged for admin confirmation (`isEligibleForPromotion = true`, `promotionPendingConfirmation = true`, level stays at Level 1).
   - `confirmPartnerPromotion(partnerId, targetLevel, actorId, tx)` provides the admin confirmation mutation to promote eligible partners and update effective dates.
   - When auto-promotion is enabled, `getPartnerReferralLevel` automatically promotes the partner, updates `currentLevel`, records `effectiveDate = new Date()`, updates `highestLevelReached`, and logs to `AuditLog`.
   - **Inactivity Policy**: Partners are never demoted automatically (`highestLevelReached` and existing level are preserved even if active count drops).
   - **Effective Date Rule**: `getPartnerReferralLevelAtDate(partnerId, date, tx)` resolves historical levels by effective dates in level history; historical commissions already finalized are never retroactively recalculated.
4. **Comprehensive Test Verification**: In `tests/referrals-levels.test.ts`, 17 dedicated test cases verify all 8 required scenario groups:
   - DELIVERED + AVAILABLE requirement (positive and negative cases for SHIPPED, PENDING earning, CONFIRMED).
   - Registration/approval alone not qualifying.
   - Subsequent orders by same partner deduplicated and not double-counted.
   - Dynamic threshold evaluation with defaults and custom settings.
   - Auto-promotion disabled flag (staying at Level 1 pending admin confirmation) vs enabled (auto-promotion to Level 2 and Level 3).
   - Direct referrals qualifying while indirect downline referrals never count.
   - Inactivity policy (no automatic demotion).
   - Effective date rule and historical commission immutability.
   - Settlement hook integration in `settleDueEarnings`.

## 3. Caveats
- Auto-promotion flag defaults to `false` in production settings as required by R3, meaning partners who reach thresholds will be flagged with `promotionPendingConfirmation: true` until an admin confirms promotion via `confirmPartnerPromotion` or enables `referral.auto_promotion_enabled`.
- In `settleDueEarnings()`, `checkAndQualifyOrder` runs per settled order ID within the caller's transaction context. For massive batches, batched order resolution is supported.

## 4. Conclusion
Milestone 3 is completely implemented within exclusive write boundaries:
- `src/modules/referrals/qualification.ts` — Genuine order qualification engine with atomic updates and auto-promotion triggering.
- `src/modules/referrals/levels.ts` — Tier rate constants, dynamic threshold evaluation, direct-only referral counting, promotion engine with admin confirmation, effective date tracking, and inactivity non-demotion policy.
- `src/modules/finance/ledger.ts` — Settlement hook integration inside `settleDueEarnings()`.
- `tests/referrals-levels.test.ts` — Complete unit and integration test suite covering all positive, negative, boundary, and edge cases.

## 5. Verification Method
- **Inspect Files**:
  - `src/modules/referrals/qualification.ts`
  - `src/modules/referrals/levels.ts`
  - `src/modules/finance/ledger.ts`
  - `tests/referrals-levels.test.ts`
- **Run Tests**:
  - `npx vitest run tests/referrals-levels.test.ts`
  - `npm test`
- **Typecheck**:
  - `npx tsc --noEmit`
