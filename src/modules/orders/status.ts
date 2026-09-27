import type { OrderStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";
import {
  applyReturnCostRule,
  createPartnerEarning,
} from "@/modules/finance/ledger";
import { getSettlementPeriodHours } from "@/modules/settings/service";
import { notifyPartnerAccount } from "@/modules/notifications/service";
import { buildEarningReversalBody, buildStatusBody, ORDER_STATUS_LABELS } from "@/modules/orders/labels";
import { checkTransition } from "./transitions";

export class StatusError extends Error {}

/**
 * Server-side status change: validates transition + role + reason,
 * optimistic lock (WHERE status = expected), history + audit,
 * side effects (restock on cancel, deliveredAt + settlementDueAt).
 * Partners can NEVER touch fulfilment statuses (enforced in transitions).
 */
export async function changeOrderStatus(opts: {
  orderId: string;
  to: string;
  reason?: string;
  actorId: string;
  role: Role;
}) {
  const { orderId, to, reason, actorId, role } = opts;
  const trimmedReason = reason?.trim() || undefined;

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true, shipment: true },
    });

    const check = checkTransition(
      order.status,
      to as OrderStatus,
      role,
      order.statusBeforeHold,
    );
    if (!check.ok) throw new StatusError(check.error);

    const transition = check.transition;
    const isResume = transition === "RESUME";
    const reasonRequired = transition !== "RESUME" && transition.reason === "REQUIRED";
    if (reasonRequired && !trimmedReason) {
      throw new StatusError("Un motif est obligatoire pour cette transition.");
    }

    const now = new Date();
    const data: Prisma.OrderUpdateInput = { status: to as OrderStatus };
    if (to === "ON_HOLD") data.statusBeforeHold = order.status;
    if (isResume) data.statusBeforeHold = null;

    let settlementDueAt: Date | null = null;
    if (to === "DELIVERED") {
      data.deliveredAt = now;
      // Frozen at delivery time — later setting changes never rewrite this.
      const hours = await getSettlementPeriodHours(tx);
      settlementDueAt = new Date(now.getTime() + hours * 3_600_000);
      data.settlementDueAt = settlementDueAt;
    }

    // ── Fulfilment side effects ──
    if (to === "SHIPPED" && !order.shipment) {
      await tx.shipment.create({ data: { orderId, shippedAt: now } });
    }
    if (to === "DELIVERED") {
      await tx.shipment.upsert({
        where: { orderId },
        create: { orderId, deliveredAt: now },
        update: { deliveredAt: now },
      });
    }
    if (to === "REFUSED" || to === "RETURNED") {
      // Physical/financial consequences are handled in Phase 5 — the
      // operational record is created here (never merged: REFUSED ≠ RETURNED).
      await tx.return.upsert({
        where: { orderId },
        create: {
          orderId,
          kind: to,
          reason: trimmedReason ?? null,
          costCharged: 0,
        },
        update: { kind: to, reason: trimmedReason ?? null },
      });
    }

    const shouldRestock = transition !== "RESUME" && transition.restock === true;
    if (shouldRestock) {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }
    }

    // Optimistic lock: only if the status is still what we validated.
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data,
    });
    if (updated.count === 0) {
      throw new StatusError(
        "Commande modifiée par un autre utilisateur — rechargez et réessayez.",
      );
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        oldStatus: order.status,
        newStatus: to as OrderStatus,
        changedById: actorId,
        reason: trimmedReason ?? null,
      },
    });

    // ── Financial side effects (Phase 5) — same transaction, so an order can
    // never be DELIVERED without its earning, nor REFUSED/RETURNED without the
    // configured return-cost rule being applied. ──
    let financeNote: Record<string, unknown> | null = null;

    if (to === "DELIVERED") {
      const earning = await createPartnerEarning(tx, {
        id: orderId,
        partnerId: order.partnerId,
        partnerEarning: order.partnerEarning,
        settlementDueAt,
      });
      financeNote = {
        earning: earning?.amount.toFixed(3) ?? "0.000",
        settlementDueAt: settlementDueAt?.toISOString() ?? null,
      };
    }

    if (to === "REFUSED" || to === "RETURNED") {
      const cost = await applyReturnCostRule(tx, {
        id: orderId,
        partnerId: order.partnerId,
        deliveryCost: order.deliveryCost,
      });
      financeNote = {
        rule: cost.rule,
        charged: cost.charged.toFixed(3),
        reversedEarning: cost.reversedEarning?.toFixed(3) ?? null,
        deliveryCharge: cost.deliveryCharge?.toFixed(3) ?? null,
      };

      // A reversal is a distinct, money-affecting event: the partner must be
      // told how much was clawed back, not just that the parcel came back.
      if (cost.reversedEarning && cost.reversedEarning.gt(0)) {
        await notifyPartnerAccount(tx, order.partnerId, {
          type: "EARNING",
          title: `Gain annulé — commande #${order.orderNumber}`,
          body: buildEarningReversalBody(
            order.partnerEarning.toFixed(3),
            cost.reversedEarning.toFixed(3),
            cost.charged.toFixed(3),
            cost.rule,
          ),
          link: "/portefeuille",
        });
      }
    }

    await recordAudit(tx, {
      actorId,
      action: "ORDER_STATUS_CHANGED",
      entityType: "Order",
      entityId: orderId,
      before: { status: order.status, statusBeforeHold: order.statusBeforeHold },
      after: {
        status: to,
        statusBeforeHold: data.statusBeforeHold ?? null,
        restocked: shouldRestock,
        ...(financeNote ? { finance: financeNote } : {}),
      },
    });

    // ── Partner notification (Phase 7) — same transaction, so a status change
    // can never land without the partner being informed about it. ──
    await notifyPartnerAccount(tx, order.partnerId, {
      type: "ORDER_STATUS",
      title: `Commande #${order.orderNumber} — ${ORDER_STATUS_LABELS[to as OrderStatus] ?? to}`,
      body: buildStatusBody(to as OrderStatus, order.status, trimmedReason),
      link: `/mes-commandes/${orderId}`,
    });

    return tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });
  });
}
