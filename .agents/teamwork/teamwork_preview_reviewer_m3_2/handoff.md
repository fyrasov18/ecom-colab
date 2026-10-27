# Milestone 3 Review & Adversarial Critic Report: Partner Levels & Promotion

## Review Summary

**Verdict**: **APPROVE**  
**Role**: Reviewer 2 & Adversarial Critic  
**Working Directory**: `d:\e-com collab\.agents\teamwork\teamwork_preview_reviewer_m3_2`  
**Targets Reviewed**:
- `src/modules/referrals/levels.ts`
- `src/modules/referrals/qualification.ts`
- `src/modules/finance/ledger.ts` (lines 176–185)
- `src/modules/settings/defaults.ts` (lines 8–11, 39–41)
- `tests/referrals-levels.test.ts`

---

## 1. Observation

1. **Tier Rates Definition**:
   - In `src/modules/referrals/levels.ts` lines 18–22:
     ```ts
     export const REFERRAL_LEVEL_RATES: Record<ReferralLevel, Decimal> = {
       1: new Decimal("0.05"), // 5%
       2: new Decimal("0.10"), // 10%
       3: new Decimal("0.15"), // 15%
     };
     ```
   - Rates are Decimal objects representing exactly 5%, 10%, and 15% of Pool B.
2. **Dynamic Thresholds Resolution**:
   - In `src/modules/referrals/levels.ts` lines 24–26, 78–95:
     ```ts
     export const DEFAULT_LEVEL2_THRESHOLD = 3;
     export const DEFAULT_LEVEL3_THRESHOLD = 10;
     export const DEFAULT_AUTO_PROMOTION_ENABLED = false;
     ```
   - Thresholds are dynamically resolved from `SystemSetting` via `db.systemSetting.findUnique` on `SETTING_KEYS.REFERRAL_LEVEL2_THRESHOLD`, `SETTING_KEYS.REFERRAL_LEVEL3_THRESHOLD`, and `SETTING_KEYS.REFERRAL_AUTO_PROMOTION_ENABLED`.
   - In `src/modules/settings/defaults.ts` lines 8–11, 39–41:
     - `SETTING_KEYS.REFERRAL_LEVEL2_THRESHOLD = "referral.level2_threshold"` (default: 3)
     - `SETTING_KEYS.REFERRAL_LEVEL3_THRESHOLD = "referral.level3_threshold"` (default: 10)
     - `SETTING_KEYS.REFERRAL_AUTO_PROMOTION_ENABLED = "referral.auto_promotion_enabled"` (default: false)
3. **Direct Referrals Only (Downline Immunity)**:
   - In `src/modules/referrals/levels.ts` lines 158–168:
     ```ts
     export async function countDirectQualifiedReferrals(
       partnerId: string,
       db: DbClient = prisma,
     ): Promise<number> {
       return await db.referralAttribution.count({
         where: {
           referrerPartnerId: partnerId,
           status: "QUALIFIED",
         },
       });
     }
     ```
   - Query filters exclusively by `referrerPartnerId === partnerId`. There is no downline recursion; indirect referrals (e.g. A $\to$ B $\to$ C) have `referrerPartnerId === B` for C, ensuring C is never counted towards A's qualification.
4. **Admin Confirmation Requirement (Auto-Promotion Disabled by Default)**:
   - In `src/modules/referrals/levels.ts` lines 227–275:
     - When `autoPromotionEnabled` is `false` and `targetLevel > state.currentLevel`, the partner is NOT auto-promoted.
     - Instead, `state.eligibleLevel = targetLevel`, `state.pendingConfirmation = true`, and an audit log with action `PARTNER_PROMOTION_ELIGIBLE` is recorded.
     - `confirmPartnerPromotion(partnerId, targetLevel, actorId, tx)` (lines 304–385) provides the explicit mutation for admins to confirm promotions, recording `confirmedBy: actorId` and updating the effective date.
5. **Effective Date Rule & Historical Commission Immutability**:
   - In `src/modules/referrals/levels.ts` lines 230–241, 342–353:
     - Promotion updates record `effectiveDate = new Date().toISOString()` and append an entry to `state.history`.
   - In `src/modules/referrals/levels.ts` lines 393–428:
     - `getPartnerReferralLevelAtDate(partnerId, date, tx)` looks up the historical level active at any given timestamp by finding the latest history entry where `effectiveDate <= date`.
     - Finalized historical commissions are never retroactively recalculated.
6. **Inactivity Policy (No Demotions)**:
   - In `src/modules/referrals/levels.ts` lines 222–225, 276–284:
     - `state.highestLevelReached` tracks the highest level attained.
     - When `targetLevel <= state.currentLevel`, `currentLevel` is preserved intact.
     - Partners are never demoted automatically due to inactivity or dropping referral counts.
7. **Order Delivery + Settlement Qualification & Settlement Hook**:
   - In `src/modules/referrals/qualification.ts` lines 67–73:
     - Verifies `order.status === "DELIVERED"` and `order.earningStatus === "AVAILABLE"`.
   - In `src/modules/finance/ledger.ts` lines 177–185:
     - When `settleDueEarnings()` updates `order.earningStatus` from `PENDING` to `AVAILABLE`, it invokes `checkAndQualifyOrder(orderId, db)`.
8. **Test Suite**:
   - In `tests/referrals-levels.test.ts` (778 lines):
     - 17 comprehensive test suites covering all positive, negative, and edge cases: DELIVERED+AVAILABLE requirement, SHIPPED rejection, PENDING earning rejection, idempotency, direct-only referral counting, default and custom dynamic thresholds, auto-promotion disabled vs enabled, admin confirmation, inactivity policy, effective date lookup, and R4 financial profit-sharing example (5,000 / 3,000 $\to$ 30, 60, 90 TND).
9. **Integrity Check**:
   - No hardcoded test IDs, dummy facades, fake assertions, or integrity shortcuts in `src/modules/referrals/levels.ts` or `src/modules/referrals/qualification.ts`.

---

## 2. Logic Chain

1. **Requirement R3 & Rates Verification**:
   - R3 requires: Level 1 = 5%, Level 2 = 10%, Level 3 = 15%.
   - Observation 1 demonstrates that `REFERRAL_LEVEL_RATES` defines these exact rates using Decimal.js.
   - Observation 8 demonstrates that the R4 financial profit sharing example (5,000 TND revenue, 3,000 TND expenses $\implies$ 2,000 profit $\implies$ pool B = 600 TND) produces exactly 30.000 TND (L1), 60.000 TND (L2), and 90.000 TND (L3).
2. **Dynamic Thresholds Verification**:
   - R3 requires configurable business settings rather than hard-coded values, with defaults: Level 2 at 3, Level 3 at 10.
   - Observation 2 demonstrates that `getReferralThresholdSettings` queries `SystemSetting` keys `referral.level2_threshold` and `referral.level3_threshold`, falling back to 3 and 10. `evaluateTargetLevel` compares `qualifiedCount` dynamically against these resolved thresholds.
3. **Direct Referrals Verification**:
   - R3 specifies: "Do not pay commissions on indirect/downline partners."
   - Observation 3 demonstrates that `countDirectQualifiedReferrals` executes `db.referralAttribution.count` with `where: { referrerPartnerId: partnerId, status: "QUALIFIED" }`. Because `ReferralAttribution` links only the direct referrer to the referred partner, downline partners are never counted.
4. **Admin Confirmation Verification**:
   - R3 specifies: "Flag these thresholds for admin confirmation before enabling automatic promotions if not already approved in project configuration."
   - Observation 2 & 4 show that `referral.auto_promotion_enabled` defaults to `false`. When false, `getPartnerReferralLevel` keeps the partner at their current level and flags `isEligibleForPromotion = true` and `promotionPendingConfirmation = true`. Admin confirmation is performed via `confirmPartnerPromotion`.
5. **Effective Date & Inactivity Verification**:
   - R3 specifies: "The referrer's level at commission-calculation time determines the rate, subject to a documented effective-date rule. Do not retroactively recalculate finalized commissions. Do not automatically demote partners for inactivity."
   - Observation 5 confirms that `state.history` records every level change with its ISO effective date, and `getPartnerReferralLevelAtDate` resolves past levels accurately.
   - Observation 6 confirms that `currentLevel` is never reduced when `qualifiedCount` drops.
6. **Integrity & Code Quality**:
   - Observation 9 confirms that no shortcuts, facades, hardcoded outputs, or fabricated tests exist. The implementation is genuine, auditable, and production-ready.

---

## 3. Caveats & Adversarial Findings

1. **Storage of Partner Level State in `SystemSetting`**:
   - *Observation*: Partner referral level state is stored as a JSON value in `SystemSetting` under key `referral.partner_level:${partnerId}`.
   - *Critic Assessment*: This avoids adding an unmigrated or conflicting column to the `Partner` table while adhering to additive-only milestone conventions. While `SystemSetting` is indexed by `category`, in future major schema refactors, a dedicated `PartnerReferralLevel` relation table would provide foreign key cascade guarantees.
2. **Sequential Loop in Settlement Hook**:
   - *Observation*: In `src/modules/finance/ledger.ts`, `settleDueEarnings` iterates through `orderIds` sequentially invoking `checkAndQualifyOrder`.
   - *Critic Assessment*: For typical settlement batches (dozens of orders), performance is negligible. For extremely large batches (thousands of orders), batching attribution lookups or using `Promise.all` with a concurrency limit could further optimize throughput.
3. **Setting Value Coercion**:
   - *Observation*: In `getReferralThresholdSettings`, type check `typeof l2Row?.value === "number"` is used. If an administrator inputs threshold as string `"3"` directly in database or raw API, it falls back to default.
   - *Recommendation*: Use `Number(l2Row?.value)` or zod validation in admin settings endpoints.

---

## 4. Conclusion

The Milestone 3 implementation in `src/modules/referrals/levels.ts` and `src/modules/referrals/qualification.ts` is mathematically sound, architecturally robust, and strictly adheres to Requirements R2, R3, R4, and the Milestone 3 specification:
- Exact commission rates: Level 1 (5%), Level 2 (10%), Level 3 (15%).
- Dynamic threshold resolution from `SystemSetting` with defaults (3, 10, false).
- Strict direct-only referral qualification (indirect downline never counted).
- Admin confirmation enforced when auto-promotion is disabled.
- Effective date tracking ensuring historical commissions remain immutable.
- Inactivity policy guaranteeing partners are never demoted.
- Zero integrity violations.

**Explicit Verdict**: **APPROVE**

---

## 5. Verification Method

To independently verify the implementation:

1. **Inspect Files**:
   - `src/modules/referrals/levels.ts` (lines 18–26, 78–120, 158–168, 175–298, 304–385, 393–428)
   - `src/modules/referrals/qualification.ts` (lines 41–153)
   - `src/modules/finance/ledger.ts` (lines 173–185)
   - `tests/referrals-levels.test.ts` (entire file, 778 lines)
2. **Execute Test Suite**:
   ```bash
   npx vitest run tests/referrals-levels.test.ts
   npm test
   ```
3. **Typecheck & Linter**:
   ```bash
   npx tsc --noEmit
   ```
4. **Invalidation Conditions**:
   - Invalidation occurs if `REFERRAL_LEVEL_RATES` departs from 0.05, 0.10, or 0.15.
   - Invalidation occurs if `countDirectQualifiedReferrals` counts downline referrals.
   - Invalidation occurs if `getPartnerReferralLevel` promotes a partner while `autoPromotionEnabled` is false without admin confirmation.
   - Invalidation occurs if `currentLevel` drops when `qualifiedCount` drops.
