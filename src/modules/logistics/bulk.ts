import type { OrderStatus, Role } from "@prisma/client";
import { changeOrderStatus, StatusError } from "@/modules/orders/status";

/**
 * Bulk status changes — SAFETY RULES enforced server-side:
 * - only forward pipeline moves (no reasons needed) are bulkable;
 * - ON_HOLD / REFUSED / RETURNED / CANCELLED are individual-only;
 * - every order still goes through the full per-order validation
 *   (transition + role + optimistic lock + history + audit).
 * Partial success: each order reports its own outcome.
 */
export const BULK_ALLOWED_TARGETS: OrderStatus[] = [
  "VALIDATED",
  "PREPARING",
  "PACKAGED",
  "SHIPPED",
  "IN_DELIVERY",
  "DELIVERED",
];

export const BULK_MAX = 50;

export function isBulkTargetAllowed(to: string): to is OrderStatus {
  return (BULK_ALLOWED_TARGETS as string[]).includes(to);
}

export type BulkResult = {
  applied: number;
  failed: { orderId: string; error: string }[];
};

export async function bulkChangeStatus(opts: {
  orderIds: string[];
  to: string;
  actorId: string;
  role: Role;
}): Promise<BulkResult> {
  const { orderIds, to, actorId, role } = opts;

  if (!isBulkTargetAllowed(to)) {
    throw new StatusError(
      "Cette transition ne peut pas être appliquée en lot (motif individuel requis).",
    );
  }
  const ids = Array.from(new Set(orderIds)).slice(0, BULK_MAX);
  if (ids.length === 0) throw new StatusError("Aucune commande sélectionnée.");

  const result: BulkResult = { applied: 0, failed: [] };
  for (const orderId of ids) {
    try {
      await changeOrderStatus({ orderId, to, actorId, role });
      result.applied++;
    } catch (e) {
      result.failed.push({
        orderId,
        error: e instanceof Error ? e.message : "Erreur inconnue.",
      });
    }
  }
  return result;
}
