import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";

/**
 * Permanently deletes an order and all its linked relations
 * (referral commissions, financial transactions, items, status history, shipments, returns).
 */
export async function deleteOrder(orderId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
      },
    });

    if (!order) {
      throw new Error("Commande introuvable.");
    }

    // 1. Delete associated referral commissions
    await tx.referralCommission.deleteMany({
      where: { orderId },
    });

    // 2. Delete associated financial transactions
    await tx.financialTransaction.deleteMany({
      where: { orderId },
    });

    // 3. Delete returns and shipments
    await tx.return.deleteMany({
      where: { orderId },
    });
    await tx.shipment.deleteMany({
      where: { orderId },
    });

    // 4. Delete items and status history
    await tx.orderItem.deleteMany({
      where: { orderId },
    });
    await tx.orderStatusHistory.deleteMany({
      where: { orderId },
    });

    // 5. Record audit log
    await recordAudit(tx, {
      actorId,
      action: "ORDER_DELETED",
      entityType: "Order",
      entityId: orderId,
      before: {
        orderNumber: order.orderNumber,
        status: order.status,
        partnerId: order.partnerId,
        customerId: order.customerId,
      },
    });

    // 6. Delete order
    await tx.order.delete({
      where: { id: orderId },
    });

    return order;
  });
}
