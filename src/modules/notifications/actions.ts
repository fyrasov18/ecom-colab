"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/rbac";
import {
  listNotifications,
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

/** Direct programmatic mark-as-read for interactive UI elements. */
export async function markNotificationReadDirect(notificationId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN", "PARTNER"]);
  try {
    await markAsRead(user.id, notificationId);
    revalidateInbox();
    return { ok: true };
  } catch (e) {
    if (e instanceof NotificationError) return { ok: false, error: e.message };
    return { ok: false, error: "Impossible de marquer la notification comme lue." };
  }
}

/** Direct programmatic mark-all-as-read for notification dropdown and full inbox. */
export async function markAllNotificationsReadDirect(): Promise<{ ok: boolean; count: number }> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN", "PARTNER"]);
  try {
    const count = await markAllAsRead(user.id);
    revalidateInbox();
    return { ok: true, count };
  } catch {
    return { ok: false, count: 0 };
  }
}

/** Returns the most recent notifications for the interactive Notification Center dropdown. */
export async function fetchRecentNotificationsAction(limit: number = 8) {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN", "PARTNER"]);
  const data = await listNotifications(user.id, { page: 1, pageSize: limit });
  return {
    items: data.items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    })),
    unread: data.unread,
    total: data.total,
  };
}
