import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";
import { getPartnerReferralLevel, isAutoPromotionEnabled } from "./levels";

export type DbClient = PrismaClient | Prisma.TransactionClient;

export type QualifyOrderResult =
  | {
      qualified: true;
      referrerPartnerId: string;
      attributionId: string;
    }
  | {
      qualified: false;
      reason:
        | "ORDER_NOT_FOUND"
        | "ORDER_HAS_NO_PARTNER"
        | "ORDER_NOT_DELIVERED"
        | "EARNING_NOT_AVAILABLE"
        | "NO_ATTRIBUTION"
        | "ALREADY_QUALIFIED"
        | "ATTRIBUTION_REJECTED"
        | "INSUFFICIENT_ORDERS"
        | string;
      referrerPartnerId?: string;
      attributionId?: string;
      ordersCount?: number;
      requiredOrders?: number;
    };

/**
 * Checks whether an order qualifies a pending partner referral attribution.
 *
 * Rules:
 * - Order must have status === "DELIVERED"
 * - Order must have earningStatus === "AVAILABLE" (COD payment confirmed and settled)
 * - Referral attribution for order.partnerId must exist and be in PENDING_QUALIFICATION status
 * - Idempotent: If already QUALIFIED, returns { qualified: false, reason: "ALREADY_QUALIFIED" }
 * - Atomically updates attribution to QUALIFIED, sets qualifyingOrderId and qualifiedAt
 * - Emits audit log entry
 * - If auto-promotion is enabled, triggers level evaluation for referrerPartnerId
 */
export async function checkAndQualifyOrder(
  orderId: string,
  tx?: Prisma.TransactionClient | PrismaClient,
): Promise<QualifyOrderResult> {
  const db = tx ?? prisma;

  // 1. Load order
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      partnerId: true,
      status: true,
      earningStatus: true,
    },
  });

  if (!order) {
    return { qualified: false, reason: "ORDER_NOT_FOUND" };
  }

  if (!order.partnerId) {
    return { qualified: false, reason: "ORDER_HAS_NO_PARTNER" };
  }

  // 2. Validate order status and settled earning status
  if (order.status !== "DELIVERED") {
    return { qualified: false, reason: "ORDER_NOT_DELIVERED" };
  }

  if (order.earningStatus !== "AVAILABLE") {
    return { qualified: false, reason: "EARNING_NOT_AVAILABLE" };
  }

  // 3. Lookup ReferralAttribution where referredPartnerId === order.partnerId
  const attribution = await db.referralAttribution.findUnique({
    where: { referredPartnerId: order.partnerId },
  });

  if (!attribution) {
    return { qualified: false, reason: "NO_ATTRIBUTION" };
  }

  // 4. Idempotency & deduplication check
  if (attribution.status === "QUALIFIED") {
    return {
      qualified: false,
      reason: "ALREADY_QUALIFIED",
      referrerPartnerId: attribution.referrerPartnerId,
      attributionId: attribution.id,
    };
  }

  if (attribution.status !== "PENDING_QUALIFICATION") {
    return {
      qualified: false,
      reason: "ATTRIBUTION_REJECTED",
      referrerPartnerId: attribution.referrerPartnerId,
      attributionId: attribution.id,
    };
  }

  // 5. Check whether the referred partner has reached the required distinct delivered/available orders
  const reqRow =
    typeof db.systemSetting?.findUnique === "function"
      ? await db.systemSetting.findUnique({
          where: { key: "referral.required_orders_to_qualify" },
        })
      : null;
  const requiredOrders = typeof reqRow?.value === "number" ? reqRow.value : 3;

  const qualifiedOrdersCount =
    typeof db.order?.count === "function"
      ? await db.order.count({
          where: {
            partnerId: order.partnerId,
            status: "DELIVERED",
            earningStatus: "AVAILABLE",
          },
        })
      : requiredOrders;

  if (qualifiedOrdersCount < requiredOrders) {
    return {
      qualified: false,
      reason: "INSUFFICIENT_ORDERS",
      referrerPartnerId: attribution.referrerPartnerId,
      attributionId: attribution.id,
      ordersCount: qualifiedOrdersCount,
      requiredOrders,
    };
  }

  // 6. Atomically update attribution to QUALIFIED (triggered by the qualifying order)
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
    // Concurrent execution already qualified this attribution
    return {
      qualified: false,
      reason: "ALREADY_QUALIFIED",
      referrerPartnerId: attribution.referrerPartnerId,
      attributionId: attribution.id,
    };
  }

  // 7. Record audit log
  await recordAudit(db, {
    action: "REFERRAL_QUALIFIED",
    entityType: "ReferralAttribution",
    entityId: attribution.id,
    before: { status: "PENDING_QUALIFICATION" },
    after: {
      status: "QUALIFIED",
      qualifyingOrderId: order.id,
      qualifiedAt: qualifiedAt.toISOString(),
      referrerPartnerId: attribution.referrerPartnerId,
      referredPartnerId: order.partnerId,
    },
  });

  // 8. Triggers level and promotion evaluation for referrerPartnerId
  const autoPromotion = await isAutoPromotionEnabled(db);
  if (autoPromotion) {
    await getPartnerReferralLevel(attribution.referrerPartnerId, db);
  }

  return {
    qualified: true,
    referrerPartnerId: attribution.referrerPartnerId,
    attributionId: attribution.id,
  };
}

/**
 * Interface contract alias matching PROJECT.md § M3 Qualification ↔ Order Settlement
 */
export async function checkAndQualifyReferral(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<QualifyOrderResult> {
  return checkAndQualifyOrder(orderId, tx);
}
