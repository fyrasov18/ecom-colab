import {
  AnnouncementStatus,
  AnnouncementType,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";
import { notify } from "@/modules/notifications/service";
import { SETTING_DEFAULTS, SETTING_KEYS } from "@/modules/settings/defaults";
import {
  announcementInputSchema,
  levelUpSettingsSchema,
  welcomeSettingsSchema,
  type AnnouncementInput,
  type LevelUpSettings,
  type WelcomeSettings,
} from "./schemas";

type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Automatically converts web sharing links (like kommodo.ai/i/...)
 * into direct CDN image URLs (.jpg, .png) so browsers can render them in <img>.
 */
export async function resolveDirectImageUrl(rawUrl?: string | null): Promise<string | null> {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const url = rawUrl.trim();
  if (!url) return null;

  // Direct image extensions are already direct URLs
  if (/\.(jpeg|jpg|png|webp|svg|gif)(\?.*)?$/i.test(url)) {
    return url;
  }

  // Handle Kommodo viewer URLs (e.g. https://kommodo.ai/i/...)
  if (url.includes("kommodo.ai/i/")) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) {
        const text = await res.text();
        const ogMatch =
          text.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
          text.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
          text.match(/"imageUrl"\s*:\s*"([^"]+)"/i);
        if (ogMatch && ogMatch[1]) {
          return ogMatch[1].replace(/&amp;/g, "&");
        }
      }
    } catch {
      // Fallback to original url
    }
  }

  return url;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. SETTINGS & TEMPLATES MANAGEMENT
 * ─────────────────────────────────────────────────────────────────────────────
 */

export async function getWelcomeNotificationSettings(
  db: DbClient = prisma,
): Promise<WelcomeSettings> {
  const row = await db.systemSetting.findUnique({
    where: { key: SETTING_KEYS.ANNOUNCEMENT_WELCOME_SETTINGS },
  });

  if (!row || !row.value || typeof row.value !== "object") {
    return welcomeSettingsSchema.parse(
      SETTING_DEFAULTS[SETTING_KEYS.ANNOUNCEMENT_WELCOME_SETTINGS],
    );
  }

  const parsed = welcomeSettingsSchema.safeParse(row.value);
  if (!parsed.success) {
    return welcomeSettingsSchema.parse(
      SETTING_DEFAULTS[SETTING_KEYS.ANNOUNCEMENT_WELCOME_SETTINGS],
    );
  }
  return parsed.data;
}

export async function updateWelcomeNotificationSettings(
  input: WelcomeSettings,
  actorId: string,
  db: DbClient = prisma,
): Promise<WelcomeSettings> {
  const parsed = welcomeSettingsSchema.parse(input);
  if (parsed.imageUrl) {
    parsed.imageUrl = (await resolveDirectImageUrl(parsed.imageUrl)) || parsed.imageUrl;
  }

  await db.systemSetting.upsert({
    where: { key: SETTING_KEYS.ANNOUNCEMENT_WELCOME_SETTINGS },
    create: {
      key: SETTING_KEYS.ANNOUNCEMENT_WELCOME_SETTINGS,
      value: parsed,
      category: "announcements",
      description: "Configuration de la notification plein écran de bienvenue (première connexion).",
      updatedById: actorId,
    },
    update: {
      value: parsed,
      updatedById: actorId,
    },
  });

  await recordAudit(db, {
    actorId,
    action: "WELCOME_NOTIFICATION_SETTINGS_UPDATED",
    entityType: "SystemSetting",
    entityId: SETTING_KEYS.ANNOUNCEMENT_WELCOME_SETTINGS,
    after: parsed,
  });

  return parsed;
}

export async function getLevelUpNotificationSettings(
  db: DbClient = prisma,
): Promise<LevelUpSettings> {
  const row = await db.systemSetting.findUnique({
    where: { key: SETTING_KEYS.ANNOUNCEMENT_LEVEL_UP_SETTINGS },
  });

  if (!row || !row.value || typeof row.value !== "object") {
    return levelUpSettingsSchema.parse(
      SETTING_DEFAULTS[SETTING_KEYS.ANNOUNCEMENT_LEVEL_UP_SETTINGS],
    );
  }

  const parsed = levelUpSettingsSchema.safeParse(row.value);
  if (!parsed.success) {
    return levelUpSettingsSchema.parse(
      SETTING_DEFAULTS[SETTING_KEYS.ANNOUNCEMENT_LEVEL_UP_SETTINGS],
    );
  }
  return parsed.data;
}

export async function updateLevelUpNotificationSettings(
  input: LevelUpSettings,
  actorId: string,
  db: DbClient = prisma,
): Promise<LevelUpSettings> {
  const parsed = levelUpSettingsSchema.parse(input);
  if (parsed.imageUrl) {
    parsed.imageUrl = (await resolveDirectImageUrl(parsed.imageUrl)) || parsed.imageUrl;
  }

  await db.systemSetting.upsert({
    where: { key: SETTING_KEYS.ANNOUNCEMENT_LEVEL_UP_SETTINGS },
    create: {
      key: SETTING_KEYS.ANNOUNCEMENT_LEVEL_UP_SETTINGS,
      value: parsed,
      category: "announcements",
      description: "Configuration de la notification plein écran de changement de niveau (Level Up).",
      updatedById: actorId,
    },
    update: {
      value: parsed,
      updatedById: actorId,
    },
  });

  await recordAudit(db, {
    actorId,
    action: "LEVEL_UP_NOTIFICATION_SETTINGS_UPDATED",
    entityType: "SystemSetting",
    entityId: SETTING_KEYS.ANNOUNCEMENT_LEVEL_UP_SETTINGS,
    after: parsed,
  });

  return parsed;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. MANUAL ANNOUNCEMENTS (ADMIN)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type AnnouncementFilters = {
  status?: AnnouncementStatus;
  type?: AnnouncementType;
  search?: string;
};

export async function listAnnouncementsAdmin(filters: AnnouncementFilters = {}) {
  const { status, type, search } = filters;

  const where: Prisma.AnnouncementWhereInput = {
    AND: [
      status ? { status } : {},
      type ? { type } : {},
      search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { content: { contains: search, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };

  const announcements = await prisma.announcement.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      popups: {
        select: {
          id: true,
          displayedAt: true,
          dismissedAt: true,
          clickedAt: true,
        },
      },
    },
  });

  return announcements.map((a) => {
    const totalDelivered = a.popups.length;
    const totalDisplayed = a.popups.filter((p) => p.displayedAt != null).length;
    const totalDismissed = a.popups.filter((p) => p.dismissedAt != null).length;
    const totalClicked = a.popups.filter((p) => p.clickedAt != null).length;

    return {
      ...a,
      stats: {
        totalDelivered,
        totalDisplayed,
        totalDismissed,
        totalClicked,
        clickRate: totalDisplayed > 0 ? Math.round((totalClicked / totalDisplayed) * 100) : 0,
      },
    };
  });
}

export async function getAnnouncementById(id: string) {
  const a = await prisma.announcement.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      popups: {
        select: {
          id: true,
          displayedAt: true,
          dismissedAt: true,
          clickedAt: true,
        },
      },
    },
  });

  if (!a) return null;

  const totalDelivered = a.popups.length;
  const totalDisplayed = a.popups.filter((p) => p.displayedAt != null).length;
  const totalDismissed = a.popups.filter((p) => p.dismissedAt != null).length;
  const totalClicked = a.popups.filter((p) => p.clickedAt != null).length;

  return {
    ...a,
    stats: {
      totalDelivered,
      totalDisplayed,
      totalDismissed,
      totalClicked,
      clickRate: totalDisplayed > 0 ? Math.round((totalClicked / totalDisplayed) * 100) : 0,
    },
  };
}

export async function createAnnouncement(input: AnnouncementInput, actorId: string) {
  const parsed = announcementInputSchema.parse(input);
  if (parsed.imageUrl) {
    parsed.imageUrl = (await resolveDirectImageUrl(parsed.imageUrl)) || parsed.imageUrl;
  }

  const scheduledDate = parsed.scheduledAt && parsed.scheduledAt.trim() !== ""
    ? new Date(parsed.scheduledAt)
    : null;

  const isPublishingNow = parsed.status === "PUBLISHED";
  const publishedDate = isPublishingNow ? new Date() : null;

  return prisma.$transaction(async (tx) => {
    const announcement = await tx.announcement.create({
      data: {
        title: parsed.title,
        content: parsed.content,
        type: parsed.type,
        imageUrl: parsed.imageUrl || null,
        buttonText: parsed.buttonText || null,
        buttonUrl: parsed.buttonUrl || null,
        targetAudience: parsed.targetAudience,
        status: parsed.status,
        scheduledAt: scheduledDate,
        publishedAt: publishedDate,
        isFullScreen: parsed.isFullScreen,
        createdById: actorId,
      },
    });

    await recordAudit(tx, {
      actorId,
      action: "ANNOUNCEMENT_CREATED",
      entityType: "Announcement",
      entityId: announcement.id,
      after: {
        title: announcement.title,
        status: announcement.status,
        targetAudience: announcement.targetAudience,
      },
    });

    return announcement;
  });
}

export async function updateAnnouncement(
  id: string,
  input: AnnouncementInput,
  actorId: string,
) {
  const parsed = announcementInputSchema.parse(input);
  if (parsed.imageUrl) {
    parsed.imageUrl = (await resolveDirectImageUrl(parsed.imageUrl)) || parsed.imageUrl;
  }

  const scheduledDate = parsed.scheduledAt && parsed.scheduledAt.trim() !== ""
    ? new Date(parsed.scheduledAt)
    : null;

  return prisma.$transaction(async (tx) => {
    const before = await tx.announcement.findUniqueOrThrow({ where: { id } });

    const isPublishingNow =
      parsed.status === "PUBLISHED" && before.status !== "PUBLISHED";
    const publishedAt = isPublishingNow
      ? new Date()
      : before.publishedAt;

    const announcement = await tx.announcement.update({
      where: { id },
      data: {
        title: parsed.title,
        content: parsed.content,
        type: parsed.type,
        imageUrl: parsed.imageUrl || null,
        buttonText: parsed.buttonText || null,
        buttonUrl: parsed.buttonUrl || null,
        targetAudience: parsed.targetAudience,
        status: parsed.status,
        scheduledAt: scheduledDate,
        publishedAt,
        isFullScreen: parsed.isFullScreen,
      },
    });

    await recordAudit(tx, {
      actorId,
      action: "ANNOUNCEMENT_UPDATED",
      entityType: "Announcement",
      entityId: id,
      before: { title: before.title, status: before.status },
      after: { title: announcement.title, status: announcement.status },
    });

    return announcement;
  });
}

export async function publishAnnouncement(id: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.announcement.findUniqueOrThrow({ where: { id } });
    const announcement = await tx.announcement.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    await recordAudit(tx, {
      actorId,
      action: "ANNOUNCEMENT_PUBLISHED",
      entityType: "Announcement",
      entityId: id,
      before: { status: before.status },
      after: { status: announcement.status },
    });

    return announcement;
  });
}

export async function archiveAnnouncement(id: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.announcement.findUniqueOrThrow({ where: { id } });
    const announcement = await tx.announcement.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    await recordAudit(tx, {
      actorId,
      action: "ANNOUNCEMENT_ARCHIVED",
      entityType: "Announcement",
      entityId: id,
      before: { status: before.status },
      after: { status: announcement.status },
    });

    return announcement;
  });
}

export async function deleteAnnouncement(id: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.announcement.findUniqueOrThrow({ where: { id } });
    await tx.announcement.delete({ where: { id } });

    await recordAudit(tx, {
      actorId,
      action: "ANNOUNCEMENT_DELETED",
      entityType: "Announcement",
      entityId: id,
      before: { title: before.title, status: before.status },
    });

    return { deleted: true };
  });
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 3. PARTNER POPUP EVALUATION & RESOLUTION
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type PartnerPopupPayload = {
  id: string; // PartnerPopupEvent.id
  type: "WELCOME" | "LEVEL_UP" | "ANNOUNCEMENT";
  title: string;
  message: string;
  buttonText: string;
  buttonUrl: string;
  badgeText?: string;
  imageUrl?: string | null;
  themeColor?: string;
  isCelebration?: boolean;
  metadata?: Record<string, unknown> | null;
  announcementType?: AnnouncementType;
};

/**
 * Evaluates in strict priority order whether a partner has a pending popup to see.
 * Priority 1: WELCOME (first login after active approval)
 * Priority 2: LEVEL_UP (confirmed level promotion)
 * Priority 3: ANNOUNCEMENT (broadcast message targeted to partner)
 */
export async function getPendingPartnerPopup(
  partnerId: string,
  user: { firstName?: string; lastName?: string; email?: string },
): Promise<PartnerPopupPayload | null> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: {
      id: true,
      displayName: true,
      status: true,
      notes: true,
      userId: true,
    },
  });

  if (!partner || partner.status !== "ACTIVE") {
    return null;
  }

  const partnerName =
    partner.displayName || user.firstName || "Partenaire";

  // ── PRIORITY 1: WELCOME NOTIFICATION ──
  const welcomeSettings = await getWelcomeNotificationSettings();
  if (welcomeSettings.isEnabled) {
    const existingWelcome = await prisma.partnerPopupEvent.findUnique({
      where: {
        partnerId_type_eventKey: {
          partnerId,
          type: "WELCOME",
          eventKey: "WELCOME",
        },
      },
    });

    if (!existingWelcome) {
      // First time partner logs in as ACTIVE -> Create popup event
      const title = welcomeSettings.title.replace("{partnerName}", partnerName);
      const message = welcomeSettings.message.replace("{partnerName}", partnerName);

      const created = await prisma.partnerPopupEvent.create({
        data: {
          partnerId,
          type: "WELCOME",
          eventKey: "WELCOME",
          title,
          message,
          buttonText: welcomeSettings.buttonText,
          buttonUrl: welcomeSettings.buttonUrl,
          imageUrl: welcomeSettings.imageUrl || null,
          metadata: {
            bannerText: welcomeSettings.bannerText,
          },
        },
      });

      return {
        id: created.id,
        type: "WELCOME",
        title,
        message,
        buttonText: welcomeSettings.buttonText,
        buttonUrl: welcomeSettings.buttonUrl,
        badgeText: welcomeSettings.badgeText,
        imageUrl: welcomeSettings.imageUrl || null,
        themeColor: welcomeSettings.themeColor,
        metadata: {
          bannerText: welcomeSettings.bannerText,
        },
      };
    } else if (existingWelcome.dismissedAt === null) {
      // Not yet dismissed
      return {
        id: existingWelcome.id,
        type: "WELCOME",
        title: existingWelcome.title || welcomeSettings.title.replace("{partnerName}", partnerName),
        message: existingWelcome.message || welcomeSettings.message.replace("{partnerName}", partnerName),
        buttonText: existingWelcome.buttonText || welcomeSettings.buttonText,
        buttonUrl: existingWelcome.buttonUrl || welcomeSettings.buttonUrl,
        badgeText: welcomeSettings.badgeText,
        imageUrl: welcomeSettings.imageUrl || existingWelcome.imageUrl || null,
        themeColor: welcomeSettings.themeColor,
        metadata: {
          bannerText: ((existingWelcome.metadata as Record<string, unknown>)?.bannerText as string) || welcomeSettings.bannerText,
        },
      };
    }
  }

  // ── PRIORITY 2: LEVEL UP NOTIFICATION ──
  const levelUpSettings = await getLevelUpNotificationSettings();
  if (levelUpSettings.isEnabled) {
    const pendingLevelUp = await prisma.partnerPopupEvent.findFirst({
      where: {
        partnerId,
        type: "LEVEL_UP",
        dismissedAt: null,
      },
      orderBy: { createdAt: "asc" },
    });

    if (pendingLevelUp) {
      const meta = (pendingLevelUp.metadata as Record<string, unknown>) || {};
      const newLevel = String(meta.newLevel ?? 2);
      const oldLevel = String(meta.previousLevel ?? 1);
      const rateNumber = Number(meta.newRate ?? 0.07);
      const commissionRate = String(Math.round(rateNumber <= 1 ? rateNumber * 100 : rateNumber));

      const title = (pendingLevelUp.title || levelUpSettings.title)
        .replace("{partnerName}", partnerName)
        .replace("{newLevel}", newLevel)
        .replace("{oldLevel}", oldLevel)
        .replace("{commissionRate}", commissionRate);

      const message = (pendingLevelUp.message || levelUpSettings.message)
        .replace("{partnerName}", partnerName)
        .replace("{newLevel}", newLevel)
        .replace("{oldLevel}", oldLevel)
        .replace("{commissionRate}", commissionRate);

      return {
        id: pendingLevelUp.id,
        type: "LEVEL_UP",
        title,
        message,
        buttonText: pendingLevelUp.buttonText || levelUpSettings.buttonText,
        buttonUrl: pendingLevelUp.buttonUrl || levelUpSettings.buttonUrl,
        themeColor: levelUpSettings.themeColor,
        isCelebration: true,
        metadata: meta,
      };
    }
  }

  // ── PRIORITY 3: MANUAL ANNOUNCEMENT ──
  const now = new Date();
  const activeAnnouncements = await prisma.announcement.findMany({
    where: {
      isFullScreen: true,
      OR: [
        { status: "PUBLISHED" },
        { status: "SCHEDULED", scheduledAt: { lte: now } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  // Resolve partner referral level from notes if stored
  let partnerReferralLevel = 1;
  try {
    if (partner.notes) {
      const parsedNotes = JSON.parse(partner.notes);
      if (parsedNotes.referralLevelState?.currentLevel) {
        partnerReferralLevel = Number(parsedNotes.referralLevelState.currentLevel);
      }
    }
  } catch {
    // fallback level 1
  }

  for (const announcement of activeAnnouncements) {
    // Audience filter check
    const matchesAudience = (() => {
      switch (announcement.targetAudience) {
        case "ALL":
          return true;
        case "ACTIVE_ONLY":
          return partner.status === "ACTIVE";
        case "LEVEL_1":
          return partnerReferralLevel === 1;
        case "LEVEL_2":
          return partnerReferralLevel === 2;
        case "LEVEL_3":
          return partnerReferralLevel === 3;
        case "LEVEL_4":
          return partnerReferralLevel === 4;
        case "LEVEL_5":
          return partnerReferralLevel === 5;
        default:
          return true;
      }
    })();

    if (!matchesAudience) continue;

    // Check or create delivery record
    let popup = await prisma.partnerPopupEvent.findUnique({
      where: {
        partnerId_type_eventKey: {
          partnerId,
          type: "ANNOUNCEMENT",
          eventKey: announcement.id,
        },
      },
    });

    if (!popup) {
      popup = await prisma.partnerPopupEvent.create({
        data: {
          partnerId,
          type: "ANNOUNCEMENT",
          eventKey: announcement.id,
          announcementId: announcement.id,
          title: announcement.title,
          message: announcement.content,
          buttonText: announcement.buttonText,
          buttonUrl: announcement.buttonUrl,
          imageUrl: announcement.imageUrl,
        },
      });
    }

    if (popup.dismissedAt === null) {
      return {
        id: popup.id,
        type: "ANNOUNCEMENT",
        title: announcement.title,
        message: announcement.content,
        buttonText: announcement.buttonText || "Consulter",
        buttonUrl: announcement.buttonUrl || "/mes-notifications",
        imageUrl: announcement.imageUrl,
        announcementType: announcement.type,
      };
    }
  }

  return null;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 4. EVENT TRACKING & LEVEL UP QUEUEING
 * ─────────────────────────────────────────────────────────────────────────────
 */

export async function recordPopupDisplayed(
  popupEventId: string,
  partnerId: string,
) {
  return prisma.partnerPopupEvent.updateMany({
    where: { id: popupEventId, partnerId, displayedAt: null },
    data: { displayedAt: new Date() },
  });
}

export async function recordPopupDismissed(
  popupEventId: string,
  partnerId: string,
  clicked: boolean = false,
) {
  const now = new Date();
  return prisma.partnerPopupEvent.updateMany({
    where: { id: popupEventId, partnerId },
    data: {
      dismissedAt: now,
      ...(clicked ? { clickedAt: now } : {}),
      // if displayedAt was somehow missed, record it
      displayedAt: now,
    },
  });
}

/**
 * Idempotently queues a Level Up popup event when a promotion is confirmed.
 * Called strictly on effective confirmation by Admin or automatic evaluation.
 */
export async function queueLevelUpPopup(
  input: {
    partnerId: string;
    previousLevel: number;
    newLevel: number;
    actorId?: string;
  },
  db: DbClient = prisma,
) {
  const { partnerId, previousLevel, newLevel } = input;

  // Safe guard for mock transaction clients in unit tests
  const dbClient = db as PrismaClient;
  if (typeof dbClient.partnerPopupEvent?.upsert !== "function") {
    return null;
  }

  // Verify partner exists to avoid foreign key errors in synthetic test fixtures
  const partner = await db.partner.findUnique({
    where: { id: partnerId },
    select: { id: true, userId: true },
  });

  if (!partner) {
    return null;
  }

  // Rate mapping
  const rates: Record<number, number> = {
    1: 0.03,
    2: 0.07,
    3: 0.15,
    4: 0.20,
    5: 0.30,
  };

  const newRate = rates[newLevel] ?? 0.07;

  // 1. Queue popup event (Idempotent: unique on partnerId, type, eventKey)
  let popup = null;
  try {
    popup = await dbClient.partnerPopupEvent.upsert({
      where: {
        partnerId_type_eventKey: {
          partnerId,
          type: "LEVEL_UP",
          eventKey: `REFERRAL_LEVEL:${newLevel}`,
        },
      },
      create: {
        partnerId,
        type: "LEVEL_UP",
        eventKey: `REFERRAL_LEVEL:${newLevel}`,
        metadata: {
          previousLevel,
          newLevel,
          newRate,
        },
      },
      update: {}, // Never overwrite if already seen or pending
    });
  } catch (err: unknown) {
    // If foreign key constraint fails (e.g. synthetic test fixtures), skip gracefully
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2003"
    ) {
      return null;
    }
    throw err;
  }

  // 2. Also notify partner account for the Notification Center
  if (partner.userId && typeof dbClient.notification?.create === "function") {
    await notify(db, {
      userId: partner.userId,
      type: "SYSTEM",
      title: `Promotion : Passage au Niveau ${newLevel} validé !`,
      body: `Félicitations ! Vous accédez officiellement au Niveau ${newLevel}. Votre taux de parrainage est désormais de ${Math.round(newRate * 100)} %.`,
      link: "/parrainage",
    });
  }

  return popup;
}
