import { Prisma } from "@prisma/client";
import type { NotificationType, PrismaClient, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { LOCALES, type Locale } from "@/lib/i18n/types";

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

/** Looks up the saved language preference of a user from system settings (default: "fr"). */
export async function getUserLocale(
  userId: string,
  db: Db = prisma,
): Promise<Locale> {
  try {
    const setting = await db.systemSetting.findUnique({
      where: { key: `user.language.${userId}` },
      select: { value: true },
    });
    if (
      setting?.value &&
      typeof setting.value === "string" &&
      (LOCALES as readonly string[]).includes(setting.value)
    ) {
      return setting.value as Locale;
    }
  } catch {
    // Non-blocking fallback
  }
  return "fr";
}

/**
 * Notifies a referring partner when a new partner registers using their referral link.
 * Sent only to the owner of the referral link. Status is awaiting validation.
 */
export async function notifyReferralRegistration(
  db: Db,
  params: { referrerUserId: string; newPartnerName?: string },
) {
  const locale = await getUserLocale(params.referrerUserId, db);
  const titles: Record<Locale, string> = {
    fr: "Nouveau partenaire inscrit !",
    en: "New partner registered!",
    ar: "شريك جديد سجّل !",
  };
  const bodies: Record<Locale, string> = {
    fr: "Un nouveau partenaire vient de s'inscrire via votre lien de parrainage. Son compte est actuellement en attente de validation.",
    en: "A new partner has registered using your referral link. Their account is currently awaiting administrator approval.",
    ar: "شريك جديد سجّل باستعمال رابط الإحالة متاعك. الحساب متاعو يستنى في موافقة الإدارة.",
  };

  return notify(db, {
    userId: params.referrerUserId,
    type: "SYSTEM",
    title: titles[locale] ?? titles.fr,
    body: bodies[locale] ?? bodies.fr,
    link: "/parrainage",
  });
}

/**
 * Notifies authorized administrators when a new partner registers and awaits approval.
 * Only targets active SUPER_ADMINs and ADMINs with MANAGE_PARTNERS permission.
 */
export async function notifyAdminsPendingPartner(
  db: Db,
  params: { partnerId: string; partnerName: string },
) {
  const admins = await db.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, status: "ACTIVE" },
    select: { id: true, role: true },
  });

  const authorizedAdmins: string[] = [];
  for (const admin of admins) {
    if (admin.role === "SUPER_ADMIN" || (await hasPermission(admin, "MANAGE_PARTNERS", db))) {
      authorizedAdmins.push(admin.id);
    }
  }

  if (authorizedAdmins.length === 0) return { count: 0 };

  const notifications = await Promise.all(
    authorizedAdmins.map(async (adminId) => {
      const locale = await getUserLocale(adminId, db);
      const titles: Record<Locale, string> = {
        fr: "Nouveau partenaire en attente de validation",
        en: "New partner awaiting approval",
        ar: "شريك جديد في انتظار الموافقة",
      };
      const bodies: Record<Locale, string> = {
        fr: `Un nouveau partenaire (${params.partnerName}) vient de s'inscrire et attend votre approbation.`,
        en: `A new partner (${params.partnerName}) has registered and is awaiting administrator approval.`,
        ar: `شريك جديد (${params.partnerName}) سجّل في المنصة ويستنى في موافقة الإدارة.`,
      };

      return {
        userId: adminId,
        type: "SYSTEM" as const,
        title: titles[locale] ?? titles.fr,
        body: bodies[locale] ?? bodies.fr,
        link: `/partenaires/${params.partnerId}`,
      };
    }),
  );

  return notifyMany(db, notifications);
}

/**
 * Notifies the approved partner and their referrer (if any) upon account activation.
 */
export async function notifyPartnerApproved(
  db: Db,
  params: {
    partnerId: string;
    partnerUserId: string;
    partnerName: string;
    referrerUserId?: string | null;
  },
) {
  const notifications: NotificationInput[] = [];

  // 1. Notify the newly approved partner
  const partnerLocale = await getUserLocale(params.partnerUserId, db);
  const pTitles: Record<Locale, string> = {
    fr: "Compte validé ! 🎉",
    en: "Account approved! 🎉",
    ar: "تم تفعيل حسابك بنجاح ! 🎉",
  };
  const pBodies: Record<Locale, string> = {
    fr: "Félicitations, votre compte partenaire a été validé avec succès par l'administration.",
    en: "Congratulations, your partner account has been approved by the administration.",
    ar: "تهانينا، تمت الموافقة على حساب الشريك الخاص بك بنجاح من طرف الإدارة.",
  };
  notifications.push({
    userId: params.partnerUserId,
    type: "SYSTEM",
    title: pTitles[partnerLocale] ?? pTitles.fr,
    body: pBodies[partnerLocale] ?? pBodies.fr,
    link: "/catalogue",
  });

  // 2. Notify the referring partner if applicable
  if (params.referrerUserId) {
    const refLocale = await getUserLocale(params.referrerUserId, db);
    const rTitles: Record<Locale, string> = {
      fr: "Partenaire validé !",
      en: "Referred partner approved!",
      ar: "تمت الموافقة على شريكك المحال !",
    };
    const rBodies: Record<Locale, string> = {
      fr: `Le compte du partenaire ${params.partnerName} que vous avez parrainé a été validé par l'administration.`,
      en: `The account of your referred partner ${params.partnerName} has been approved by the administration.`,
      ar: `تمت الموافقة على حساب الشريك ${params.partnerName} المحال بنجاح من طرف الإدارة.`,
    };
    notifications.push({
      userId: params.referrerUserId,
      type: "SYSTEM",
      title: rTitles[refLocale] ?? rTitles.fr,
      body: rBodies[refLocale] ?? rBodies.fr,
      link: "/parrainage",
    });
  }

  return notifyMany(db, notifications);
}
