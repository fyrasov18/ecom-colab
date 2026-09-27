import { Prisma } from "@prisma/client";
import type { NotificationType, PrismaClient, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

export type NotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** In-app destination, e.g. /mes-commandes/<id>. Stored as given. */
  link?: string | null;
};

/**
 * Write one notification.
 *
 * Pass the active transaction client so the notification is atomic with the
 * business operation that produced it — an order can never change status
 * without the partner being told, and vice-versa.
 */
export async function notify(db: Db, input: NotificationInput) {
  return db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
    },
  });
}

/** Fan a single message out to several users (createMany, no per-row round-trips). */
export async function notifyMany(db: Db, inputs: NotificationInput[]) {
  if (inputs.length === 0) return { count: 0 };
  return db.notification.createMany({
    data: inputs.map((i) => ({
      userId: i.userId,
      type: i.type,
      title: i.title,
      body: i.body,
      link: i.link ?? null,
    })),
  });
}

/**
 * Every active back-office user. Used for operational alerts (new withdrawal
 * request, low stock…). Suspended accounts are skipped on purpose.
 */
export async function notifyBackOffice(
  db: Db,
  input: Omit<NotificationInput, "userId">,
  roles: Role[] = ["SUPER_ADMIN", "ADMIN"],
) {
  const users = await db.user.findMany({
    where: { role: { in: roles }, status: "ACTIVE" },
    select: { id: true },
  });
  return notifyMany(
    db,
    users.map((u) => ({ ...input, userId: u.id })),
  );
}

/** The single user behind a partner account (Partner.userId is unique). */
export async function notifyPartnerAccount(
  db: Db,
  partnerId: string,
  input: Omit<NotificationInput, "userId">,
) {
  const partner = await db.partner.findUnique({
    where: { id: partnerId },
    select: { userId: true },
  });
  if (!partner) return { count: 0 };
  return notify(db, { ...input, userId: partner.userId });
}

/** Convenience wrapper on the global client (outside any transaction). */
export async function pushNotification(input: NotificationInput) {
  return notify(prisma, input);
}
