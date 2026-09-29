import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";
import { changeOrderStatus } from "@/modules/orders/status";

/**
 * Shipment info (carrier + tracking) upsert for one order. The row and its
 * audit entry commit together so the trail can never drift from the data.
 */
export async function upsertShipmentInfo(opts: {
  orderId: string;
  carrier: string | null;
  trackingNumber: string | null;
  actorId: string;
}): Promise<{ id: string }> {
  const { orderId, carrier, trackingNumber, actorId } = opts;

  return prisma.$transaction(async (tx) => {
    const before = await tx.shipment.findUnique({ where: { orderId } });
    const shipment = await tx.shipment.upsert({
      where: { orderId },
      create: { orderId, carrier, trackingNumber },
      update: { carrier, trackingNumber },
    });
    await recordAudit(tx, {
      actorId,
      action: before ? "SHIPMENT_UPDATED" : "SHIPMENT_CREATED",
      entityType: "Shipment",
      entityId: shipment.id,
      before: before
        ? { carrier: before.carrier, trackingNumber: before.trackingNumber }
        : null,
      after: { carrier: shipment.carrier, trackingNumber: shipment.trackingNumber },
    });
    return { id: shipment.id };
  });
}

/**
 * Resume an order that was put ON_HOLD: it returns to the stage it was held
 * from (`statusBeforeHold`). Returns `null` when the order is not on hold, so
 * the caller can answer without knowing the hold rules.
 */
export async function resumeOrderFromHold(opts: {
  orderId: string;
  actorId: string;
  role: Role;
}): Promise<{ orderNumber: number } | null> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: opts.orderId },
    select: { orderNumber: true, statusBeforeHold: true },
  });

  const { statusBeforeHold } = order;
  if (!statusBeforeHold) return null;

  await changeOrderStatus({
    orderId: opts.orderId,
    to: statusBeforeHold,
    actorId: opts.actorId,
    role: opts.role,
  });

  return { orderNumber: order.orderNumber };
}
