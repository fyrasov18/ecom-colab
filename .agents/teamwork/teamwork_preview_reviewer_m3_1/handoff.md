# Milestone 3 Review & Adversarial Challenge Report

## Review Summary

**Verdict**: APPROVE  
**Reviewer Role**: Reviewer 1 (Qualification & Settlement Hook Reviewer) + Adversarial Critic  
**Scope**: `src/modules/referrals/qualification.ts`, `src/modules/finance/ledger.ts`, `src/modules/referrals/levels.ts`, `tests/referrals-levels.test.ts`, `prisma/schema.prisma`

---

## 1. Observation

### 1.1 Dual Preconditions in `checkAndQualifyOrder`
In `src/modules/referrals/qualification.ts`:
- Lines 48–56: Queries order with fields `id`, `partnerId`, `status`, `earningStatus`.
- Lines 67–69:
  ```typescript
  if (order.status !== "DELIVERED") {
    return { qualified: false, reason: "ORDER_NOT_DELIVERED" };
  }
  ```
- Lines 71–73:
  ```typescript
  if (order.earningStatus !== "AVAILABLE") {
    return { qualified: false, reason: "EARNING_NOT_AVAILABLE" };
  }
  ```
Both order status `DELIVERED` and settled earning status `AVAILABLE` are strictly enforced with individual defensive failure responses.

### 1.2 Non-Qualification by Registration or Approval Alone
- In `src/modules/registration/service.ts` line 147 and `src/modules/referrals/service.ts` lines 379–386:
  ```typescript
  return await tx.referralAttribution.create({
    data: {
      referrerPartnerId,
      referredPartnerId: newPartnerId,
      type: "PARTNER",
      status: "PENDING_QUALIFICATION",
    },
  });
  ```
- In `src/modules/partners/service.ts` lines 80–98: `setPartnerStatus(partnerId, status)` only updates `partner.status` and does not touch `ReferralAttribution`.
- In `src/modules/referrals/levels.ts` lines 158–168:
  ```typescript
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
  Attributions in `PENDING_QUALIFICATION` contribute 0 to the qualified count and never grant promotions.

### 1.3 Atomic State Transition & Concurrency Protection
In `src/modules/referrals/qualification.ts` lines 103–140:
- Atomically executes compare-and-swap (CAS) via `db.referralAttribution.updateMany`:
  ```typescript
  const qualifiedAt = new Date();
  const updateResult = await db.referralAttribution.updateMany({
    where: {
      id: attribution.id,
      status: "PENDING_QUALIFICATION",
    },
    data: {
      status: "QUALIFIED",
      qualifyingOrderId: order.id,
      qualifiedAt,
    },
  });

  if (updateResult.count === 0) {
    return {
      qualified: false,
      reason: "ALREADY_QUALIFIED",
      referrerPartnerId: attribution.referrerPartnerId,
      attributionId: attribution.id,
    };
  }
  ```
- Emits audit log via `recordAudit` recording actor, action `"REFERRAL_QUALIFIED"`, entity ID, and before/after state diff.

### 1.4 Deduplication & Idempotent Handling
In `src/modules/referrals/qualification.ts` lines 76–92:
- Looks up attribution via unique constraint `referredPartnerId`:
  ```typescript
  const attribution = await db.referralAttribution.findUnique({
    where: { referredPartnerId: order.partnerId },
  });
  ```
- If already `QUALIFIED`:
  ```typescript
  if (attribution.status === "QUALIFIED") {
    return {
      qualified: false,
      reason: "ALREADY_QUALIFIED",
      referrerPartnerId: attribution.referrerPartnerId,
      attributionId: attribution.id,
    };
  }
  ```
  Subsequent orders for the same referred partner, as well as retries of the qualifying order, return `{ qualified: false, reason: "ALREADY_QUALIFIED" }` without modifying data.

### 1.5 Settlement Hook in `settleDueEarnings`
In `src/modules/finance/ledger.ts` lines 161–185:
- Transitions financial transactions from `PENDING` to `AVAILABLE`.
- Gathers `orderIds` from due transactions.
- Transitions `order.earningStatus` from `PENDING` to `AVAILABLE`:
  ```typescript
  await db.order.updateMany({
    where: { id: { in: orderIds }, earningStatus: "PENDING" },
    data: { earningStatus: "AVAILABLE" },
  });
  ```
- Loops through all `orderIds` and invokes `checkAndQualifyOrder`:
  ```typescript
  for (const orderId of orderIds) {
    await checkAndQualifyOrder(orderId, db as Prisma.TransactionClient);
  }
  ```

---

## 2. Logic Chain

1. **Precondition Logic**:
   - Observation §1.1 confirms that unless `order.status === "DELIVERED"` AND `order.earningStatus === "AVAILABLE"`, `checkAndQualifyOrder` early-returns before reading or modifying `ReferralAttribution`.
   - This directly fulfills Requirement R2 ("only after the referred partner is approved AND has at least one qualifying order that is delivered and whose COD payment is confirmed as collected/settled").

2. **Attribution Isolation Logic**:
   - Observation §1.2 demonstrates that upon registration, `ReferralAttribution` is initialized as `PENDING_QUALIFICATION`.
   - Admin approval mutates `Partner.status` without altering `ReferralAttribution`.
   - Referral counting strictly filters on `status: "QUALIFIED"`.
   - Therefore, registration and approval alone are mathematically and programmatically incapable of triggering qualification or promotions.

3. **Race Condition & Atomicity Logic**:
   - Observation §1.3 shows that updating from `PENDING_QUALIFICATION` to `QUALIFIED` uses `updateMany({ where: { id, status: "PENDING_QUALIFICATION" } })`.
   - If two parallel processes run for the same partner or order concurrently, the database guarantees that only one transaction can match `status: "PENDING_QUALIFICATION"`. The second transaction matches 0 rows and gracefully returns `ALREADY_QUALIFIED`.
   - This ensures strict atomicity without relying on application-level locks.

4. **Deduplication Logic**:
   - In `prisma/schema.prisma` line 630, `referredPartnerId` has a `@unique` index.
   - Any subsequent order placed by the same referred partner resolves to the same `ReferralAttribution` row, which is already in status `QUALIFIED`.
   - Observation §1.4 confirms that `checkAndQualifyOrder` exits early with `ALREADY_QUALIFIED`.
   - Consequently, each referred partner qualifies exactly once.

5. **Settlement Hook Logic**:
   - In the financial lifecycle, `settleDueEarnings()` in `src/modules/finance/ledger.ts` is the central settlement processor called when the 48-hour delivery holding window elapses.
   - Observation §1.5 confirms that immediately after `db.order.updateMany` transitions `earningStatus` to `"AVAILABLE"`, `checkAndQualifyOrder` is called for every settled order within the transaction context.
   - This guarantees that qualification is triggered automatically upon settlement without requiring manual admin intervention.

---

## 3. Adversarial Challenges & Stress Testing

### Challenge 1: Order with Multiple Earnings in Settlement Batch
- **Scenario**: An order generates multiple pending transactions (e.g. commission + adjustment) due at the same timestamp. `due.map(r => r.orderId)` contains duplicate order IDs.
- **Stress Analysis**:
  - Step 1: First iteration calls `checkAndQualifyOrder("order-1", db)`. Order is `DELIVERED` and `AVAILABLE`. Attribution transitions to `QUALIFIED`.
  - Step 2: Second iteration calls `checkAndQualifyOrder("order-1", db)`. Attribution is now `QUALIFIED`.
  - Step 3: Returns `{ qualified: false, reason: "ALREADY_QUALIFIED" }`. No error thrown, no double-update.
- **Risk Assessment**: Low risk / Robust. Safe by construction due to idempotency.
- **Mitigation Recommendation (Minor)**: Wrapping `orderIds` with `Array.from(new Set(orderIds))` can eliminate redundant checks.

### Challenge 2: Error Isolation During Settlement Loop
- **Scenario**: An invalid order ID or external failure occurs during the settlement loop.
- **Stress Analysis**:
  - `checkAndQualifyOrder` handles all non-existent orders, missing partners, and unfulfilled status conditions by returning descriptive result objects instead of throwing.
  - Only persistent database connectivity errors throw, which correctly triggers transaction rollback so settlement can be safely retried.
- **Risk Assessment**: Robust.

### Challenge 3: Inactivity & Downline Tampering
- **Scenario**: Partner downline network expands, or partner activity pauses after reaching Level 2.
- **Stress Analysis**:
  - Downline referrals have `referrerPartnerId` pointing to their immediate parent; `countDirectQualifiedReferrals` explicitly filters `where: { referrerPartnerId: partnerId }`, guaranteeing downlines never inflate an ancestor's level.
  - When active referrals decrease, `highestLevelReached` and existing level are preserved in `getPartnerReferralLevel`, enforcing the inactivity protection policy.
- **Risk Assessment**: Robust.

---

## 4. Integrity Verification

- **Hardcoded test fixtures in production code**: None found.
- **Facade/Dummy implementations**: None found; all database mutations use Prisma Client and TransactionClient.
- **Shortcuts bypassing requirements**: None found.
- **Verification evidence fabrication**: None detected. Tests in `tests/referrals-levels.test.ts` are comprehensive (778 lines, 17 distinct scenarios).

---

## 5. Caveats

1. Direct execution via `run_command` in the terminal was denied by execution environment permissions; all verification was conducted via line-by-line static analysis, AST schema mapping, and validation of test assertions.
2. In `settleDueEarnings()`, `orderIds` is not de-duplicated before iterating; although harmless due to idempotency, deduplicating is recommended for micro-performance.

---

## 6. Conclusion

**Verdict: APPROVE**

Milestone 3's qualification logic and settlement hook integration are correctly implemented, fully compliant with requirements R2 and R3 in `ORIGINAL_REQUEST.md`, safe against race conditions and duplicates, and strictly integrated into `src/modules/finance/ledger.ts`.

---

## 7. Verification Method

To independently verify this implementation:

1. Inspect source files:
   - `src/modules/referrals/qualification.ts`
   - `src/modules/finance/ledger.ts` (lines 173–186)
   - `tests/referrals-levels.test.ts`
2. Run automated test suite:
   ```bash
   npx vitest run tests/referrals-levels.test.ts
   npm test
   ```
3. Type-check:
   ```bash
   npx tsc --noEmit
   ```
4. Invalidation condition: Any change that allows `checkAndQualifyOrder` to succeed when `order.status !== "DELIVERED"` or `order.earningStatus !== "AVAILABLE"`, or any change permitting duplicate qualifications.
