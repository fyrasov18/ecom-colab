"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { bulkChangeStatus } from "@/modules/logistics/bulk";
import { StatusError } from "@/modules/orders/status";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";

export type LogisticsState = {
  ok: boolean;
  message?: string;
  error?: string;
  applied?: number;
  failed?: number;
};

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

/** Bulk advance — every order re-validated server-side. */
export async function bulkAdvance(
  _prev: LogisticsState,
  formData: FormData,
): Promise<LogisticsState> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const orderIds = formData
    .getAll("orderIds")
    .map((v) => String(v))
    .filter(Boolean);
  const to = str(formData.get("to"));

  try {
    const result = await bulkChangeStatus({
      orderIds,
      to,
      actorId: user.id,
      role: user.role,
    });
    revalidatePath("/logistique");
    revalidatePath("/commandes");
    revalidatePath("/dashboard");
    if (result.applied > 0) {
      return {
        ok: true,
        applied: result.applied,
        failed: result.failed.length,
        message:
          `${result.applied} commande(s) mise(s) à jour.` +
          (result.failed.length
            ? ` ${result.failed.length} échec(s) (statut obsolète ou interdit).`
            : ""),
      };
    }
    return {
      ok: false,
      error:
        result.failed[0]?.error ?? "Aucune commande n'a pu être mise à jour.",
      failed: result.failed.length,
    };
  } catch (e) {
    if (e instanceof StatusError) return { ok: false, error: e.message };
    return { ok: false, error: "Opération impossible." };
  }
}

/** Single-order resume (ON_HOLD → previous stage). */
export async function resumeOrder(
  _prev: LogisticsState,
  formData: FormData,
): Promise<LogisticsState> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const orderId = str(formData.get("orderId"));
  try {
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (!order.statusBeforeHold) {
      return { ok: false, error: "Cette commande n'est pas en attente." };
    }
    const { changeOrderStatus } = await import("@/modules/orders/status");
    await changeOrderStatus({
      orderId,
      to: order.statusBeforeHold,
      actorId: user.id,
      role: user.role,
    });
    revalidatePath("/logistique");
    revalidatePath(`/commandes/${orderId}`);
    return { ok: true, message: `Commande #${order.orderNumber} reprise.` };
  } catch (e) {
    if (e instanceof StatusError) return { ok: false, error: e.message };
    return { ok: false, error: "Reprise impossible." };
  }
}

/** Upsert shipment info (carrier + tracking) — audited. */
export async function saveShipmentInfo(
  _prev: LogisticsState,
  formData: FormData,
): Promise<LogisticsState> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const orderId = str(formData.get("orderId"));
  const carrier = str(formData.get("carrier"));
  const trackingNumber = str(formData.get("trackingNumber"));

  try {
    const before = await prisma.shipment.findUnique({ where: { orderId } });
    const shipment = await prisma.shipment.upsert({
      where: { orderId },
      create: { orderId, carrier: carrier || null, trackingNumber: trackingNumber || null },
      update: { carrier: carrier || null, trackingNumber: trackingNumber || null },
    });
    await recordAudit(prisma, {
      actorId: user.id,
      action: before ? "SHIPMENT_UPDATED" : "SHIPMENT_CREATED",
      entityType: "Shipment",
      entityId: shipment.id,
      before: before
        ? { carrier: before.carrier, trackingNumber: before.trackingNumber }
        : null,
      after: { carrier: shipment.carrier, trackingNumber: shipment.trackingNumber },
    });
    revalidatePath(`/commandes/${orderId}`);
    revalidatePath("/logistique");
    return { ok: true, message: "Informations de livraison enregistrées." };
  } catch {
    return { ok: false, error: "Enregistrement impossible." };
  }
}
