"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { changeOrderStatus, StatusError } from "@/modules/orders/status";
import { statusChangeSchema } from "@/modules/orders/schemas";

export type OrderAdminState = { ok: boolean; error?: string; message?: string };

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

export async function applyOrderStatus(
  _prev: OrderAdminState,
  formData: FormData,
): Promise<OrderAdminState> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const parsed = statusChangeSchema.safeParse({
    orderId: str(formData.get("orderId")),
    to: str(formData.get("to")),
    reason: str(formData.get("reason")) || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }

  try {
    const order = await changeOrderStatus({
      orderId: parsed.data.orderId,
      to: parsed.data.to,
      reason: parsed.data.reason,
      actorId: user.id,
      role: user.role,
    });
    revalidatePath("/commandes");
    revalidatePath(`/commandes/${parsed.data.orderId}`);
    revalidatePath("/dashboard");
    revalidatePath("/logistique");
    return {
      ok: true,
      message: `Commande #${order.orderNumber} → ${parsed.data.to}.`,
    };
  } catch (e) {
    if (e instanceof StatusError) return { ok: false, error: e.message };
    return { ok: false, error: "Changement de statut impossible." };
  }
}
