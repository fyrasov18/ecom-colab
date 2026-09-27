"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/rbac";
import {
  markAllAsRead,
  markAsRead,
  NotificationError,
} from "./queries";

export type NotificationActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

/**
 * The list lives at two URLs (/notifications for the back office,
 * /mes-notifications for partners). Revalidating both keeps the shared
 * components honest whichever shell the user is in.
 */
function revalidateInbox() {
  revalidatePath("/notifications");
  revalidatePath("/mes-notifications");
}

export async function markNotificationRead(
  _prev: NotificationActionState,
  formData: FormData,
): Promise<NotificationActionState> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN", "PARTNER"]);

  const parsed = z
    .object({ notificationId: z.string().min(1) })
    .safeParse({ notificationId: String(formData.get("notificationId") ?? "") });
  if (!parsed.success) return { ok: false, error: "Notification invalide." };

  try {
    await markAsRead(user.id, parsed.data.notificationId);
    revalidateInbox();
    return { ok: true, message: "Notification marquée comme lue." };
  } catch (e) {
    if (e instanceof NotificationError) return { ok: false, error: e.message };
    return { ok: false, error: "Mise à jour impossible." };
  }
}

export async function markEveryNotificationRead(
  _prev: NotificationActionState,
  _formData: FormData,
): Promise<NotificationActionState> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN", "PARTNER"]);

  try {
    const count = await markAllAsRead(user.id);
    revalidateInbox();
    return {
      ok: true,
      message: count === 0 ? "Aucune notification non lue." : `${count} notification(s) marquée(s) comme lue(s).`,
    };
  } catch {
    return { ok: false, error: "Mise à jour impossible." };
  }
}
