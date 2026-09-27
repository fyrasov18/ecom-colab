import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const NOTIFICATION_PAGE_SIZE = 20;

export type NotificationFilters = {
  /** "all" | "unread" | "read" */
  view?: "all" | "unread" | "read";
  type?: NotificationType | "ALL";
  page?: number;
  pageSize?: number;
};

/** Unread badge count for the header — cheap enough for every layout render. */
export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}

function buildWhere(
  userId: string,
  filters: NotificationFilters,
): Prisma.NotificationWhereInput {
  const where: Prisma.NotificationWhereInput = { userId };

  // Scoping by userId in the WHERE clause is the isolation guarantee: a user
  // can never read (or mark read) somebody else's notification.
  if (filters.view === "unread") where.readAt = null;
  if (filters.view === "read") where.readAt = { not: null };
  if (filters.type && filters.type !== "ALL") where.type = filters.type;

  return where;
}

export async function listNotifications(
  userId: string,
  filters: NotificationFilters = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, filters.pageSize ?? NOTIFICATION_PAGE_SIZE));
  const where = buildWhere(userId, filters);

  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return {
    items,
    total,
    unread,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export class NotificationError extends Error {}

/** Mark exactly one notification as read. Ownership is enforced in the WHERE. */
export async function markAsRead(userId: string, notificationId: string) {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count === 0) {
    // Either it does not exist, it belongs to someone else, or it was already
    // read. All three are indistinguishable to the caller on purpose.
    const exists = await prisma.notification.count({
      where: { id: notificationId, userId },
    });
    if (exists === 0) throw new NotificationError("Notification introuvable.");
  }
  return true;
}

/** Mark every unread notification of this user as read. */
export async function markAllAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
