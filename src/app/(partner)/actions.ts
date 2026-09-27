"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { createOrder, OrderError } from "@/modules/orders/create";
import { changeOrderStatus, StatusError } from "@/modules/orders/status";

export type OrderActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  orderId?: string;
};

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

export async function submitOrder(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const user = await requireSession(["PARTNER"]);
  if (!user.partnerId) return { ok: false, error: "Compte partenaire introuvable." };

  try {
    const order = await createOrder(
      {
        productId: str(formData.get("productId")),
        quantity: str(formData.get("quantity")),
        sellingPrice: str(formData.get("sellingPrice")),
        customerFullName: str(formData.get("customerFullName")),
        phone: str(formData.get("phone")),
        governorate: str(formData.get("governorate")),
        city: str(formData.get("city")),
        address: str(formData.get("address")),
        notes: str(formData.get("notes")),
        confirmed: (formData.get("confirmed") ?? "") as "on",
      } as never,
      { partnerId: user.partnerId, actorId: user.id },
    );
    revalidatePath("/mes-commandes");
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: `Commande #${order.orderNumber} enregistrée (statut : Confirmée).`,
      orderId: order.id,
    };
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.message };
    if (e && typeof e === "object" && "issues" in e) {
      const z = e as { issues: { path: (string | number)[]; message: string }[] };
      return { ok: false, error: z.issues[0]?.message ?? "Données invalides." };
    }
    return { ok: false, error: "Erreur lors de la création de la commande." };
  }
}

/** Partner may cancel ONLY a CONFIRMED order (enforced in transitions). */
export async function cancelOwnOrder(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const user = await requireSession(["PARTNER"]);
  const orderId = str(formData.get("orderId"));
  const reason = str(formData.get("reason"));

  try {
    await changeOrderStatus({
      orderId,
      to: "CANCELLED",
      reason,
      actorId: user.id,
      role: user.role,
    });
    revalidatePath("/mes-commandes");
    revalidatePath(`/mes-commandes/${orderId}`);
    return { ok: true, message: "Commande annulée." };
  } catch (e) {
    if (e instanceof StatusError) return { ok: false, error: e.message };
    return { ok: false, error: "Annulation impossible." };
  }
}
