import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  welcomeSettingsSchema,
  levelUpSettingsSchema,
  announcementInputSchema,
} from "@/modules/announcements/schemas";
import {
  getPendingPartnerPopup,
  queueLevelUpPopup,
  queuePerformanceLevelUpgrade,
  recordPopupDismissed,
  recordPopupDisplayed,
  createAnnouncement,
} from "@/modules/announcements/service";
import { confirmPartnerPromotion } from "@/modules/referrals/levels";
import { prisma } from "@/lib/prisma";
import type { Partner, PartnerPopupEvent, Notification } from "@prisma/client";

describe("Announcements & Popups Schemas", () => {
  it("validates welcome settings schema with default fallback", () => {
    const valid = welcomeSettingsSchema.parse({});
    expect(valid.isEnabled).toBe(true);
    expect(valid.title).toContain("{partnerName}");
    expect(valid.buttonText).toBe("Découvrir mon espace");
  });

  it("validates level up settings schema with default fallback", () => {
    const valid = levelUpSettingsSchema.parse({});
    expect(valid.isEnabled).toBe(true);
    expect(valid.title).toContain("{newLevel}");
    expect(valid.buttonText).toBe("Voir mes nouveaux avantages");
  });

  it("validates announcement input schema", () => {
    const input = {
      title: "Nouveau produit gagnant en stock",
      content: "Découvrez notre nouveau produit à forte marge.",
      type: "PRODUCT" as const,
      targetAudience: "ACTIVE_ONLY" as const,
      status: "PUBLISHED" as const,
      isFullScreen: true,
    };
    const parsed = announcementInputSchema.parse(input);
    expect(parsed.title).toBe("Nouveau produit gagnant en stock");
    expect(parsed.type).toBe("PRODUCT");
  });

  it("rejects announcement with empty title or content", () => {
    expect(() =>
      announcementInputSchema.parse({
        title: "",
        content: "Valid content",
      }),
    ).toThrow();
  });
});

describe("Welcome Notification — First Login & Idempotency", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("surfaces welcome popup on first login of an ACTIVE partner", async () => {
    vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
      id: "partner-1",
      displayName: "Sami Ben Salah",
      status: "ACTIVE",
      notes: null,
      userId: "user-1",
    } as unknown as Partner);

    vi.spyOn(prisma.systemSetting, "findUnique").mockResolvedValue(null);

    // No popup recorded yet
    vi.spyOn(prisma.partnerPopupEvent, "findUnique").mockResolvedValue(null);

    const createSpy = vi.spyOn(prisma.partnerPopupEvent, "create").mockResolvedValue({
      id: "popup-welcome-1",
      partnerId: "partner-1",
      type: "WELCOME",
      eventKey: "WELCOME",
      title: "Bienvenue sur E-com Colab, Sami Ben Salah !",
      message: "Votre compte a été validé.",
      buttonText: "Commencer",
      buttonUrl: "/catalogue",
      imageUrl: null,
      metadata: null,
      displayedAt: null,
      dismissedAt: null,
      clickedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as PartnerPopupEvent);

    const popup = await getPendingPartnerPopup("partner-1", { firstName: "Sami" });

    expect(popup).not.toBeNull();
    expect(popup?.type).toBe("WELCOME");
    expect(popup?.title).toContain("Sami Ben Salah");
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          partnerId: "partner-1",
          type: "WELCOME",
          eventKey: "WELCOME",
        }),
      }),
    );
  });

  it("never resurfaces welcome popup once dismissed", async () => {
    vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
      id: "partner-1",
      displayName: "Sami Ben Salah",
      status: "ACTIVE",
      notes: null,
      userId: "user-1",
    } as unknown as Partner);

    vi.spyOn(prisma.systemSetting, "findUnique").mockResolvedValue(null);

    // Welcome popup exists and was dismissed
    vi.spyOn(prisma.partnerPopupEvent, "findUnique").mockResolvedValue({
      id: "popup-welcome-1",
      partnerId: "partner-1",
      type: "WELCOME",
      eventKey: "WELCOME",
      dismissedAt: new Date(),
    } as unknown as PartnerPopupEvent);

    // No Level up or manual announcements
    vi.spyOn(prisma.partnerPopupEvent, "findFirst").mockResolvedValue(null);
    vi.spyOn(prisma.announcement, "findMany").mockResolvedValue([]);

    const popup = await getPendingPartnerPopup("partner-1", { firstName: "Sami" });

    // Should be null (or next in priority queue if any)
    expect(popup).toBeNull();
  });
});

describe("Level Up Notification — Confirmation, Calculations & Idempotency", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("queues level up popup idempotently with real system rates", async () => {
    const upsertSpy = vi.spyOn(prisma.partnerPopupEvent, "upsert").mockResolvedValue({
      id: "popup-levelup-2",
      partnerId: "partner-1",
      type: "LEVEL_UP",
      eventKey: "REFERRAL_LEVEL:2",
    } as unknown as PartnerPopupEvent);

    vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
      userId: "user-1",
    } as unknown as Partner);

    vi.spyOn(prisma.notification, "create").mockResolvedValue({} as unknown as Notification);

    await queueLevelUpPopup({
      partnerId: "partner-1",
      previousLevel: 1,
      newLevel: 2,
      actorId: "admin-1",
    });

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          partnerId_type_eventKey: {
            partnerId: "partner-1",
            type: "LEVEL_UP",
            eventKey: "REFERRAL_LEVEL:2",
          },
        },
        create: expect.objectContaining({
          type: "LEVEL_UP",
          eventKey: "REFERRAL_LEVEL:2",
          metadata: expect.objectContaining({
            previousLevel: 1,
            newLevel: 2,
            newRate: 0.07,
          }),
        }),
      }),
    );
  });

  it("surfaces pending level up celebration popup with correct rate and levels", async () => {
    vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
      id: "partner-1",
      displayName: "Yassine Amari",
      status: "ACTIVE",
      notes: null,
      userId: "user-1",
    } as unknown as Partner);

    vi.spyOn(prisma.systemSetting, "findUnique").mockResolvedValue(null);

    // Welcome already dismissed
    vi.spyOn(prisma.partnerPopupEvent, "findUnique").mockResolvedValue({
      id: "welcome-1",
      dismissedAt: new Date(),
    } as unknown as PartnerPopupEvent);

    // Level up popup pending
    vi.spyOn(prisma.partnerPopupEvent, "findFirst").mockResolvedValue({
      id: "popup-lvl-2",
      partnerId: "partner-1",
      type: "LEVEL_UP",
      eventKey: "REFERRAL_LEVEL:2",
      title: null,
      message: null,
      metadata: {
        previousLevel: 1,
        newLevel: 2,
        newRate: 0.07,
      },
      dismissedAt: null,
    } as unknown as PartnerPopupEvent);

    const popup = await getPendingPartnerPopup("partner-1", { firstName: "Yassine" });

    expect(popup).not.toBeNull();
    expect(popup?.type).toBe("LEVEL_UP");
    expect(popup?.isCelebration).toBe(true);
    expect(popup?.title).toContain("Niveau 2");
    expect(popup?.message).toContain("7 %");
  });
});

describe("Manual Announcements & Interaction Telemetry", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("filters out scheduled announcements before their scheduled date", async () => {
    vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
      id: "partner-1",
      displayName: "Partenaire Test",
      status: "ACTIVE",
      notes: null,
      userId: "user-1",
    } as unknown as Partner);

    vi.spyOn(prisma.systemSetting, "findUnique").mockResolvedValue(null);
    vi.spyOn(prisma.partnerPopupEvent, "findUnique").mockResolvedValue({
      id: "welcome-dismissed",
      dismissedAt: new Date(),
    } as unknown as PartnerPopupEvent);
    vi.spyOn(prisma.partnerPopupEvent, "findFirst").mockResolvedValue(null);

    // Prisma query returns only announcements whose scheduledAt <= now
    const findManyAnnouncementsSpy = vi
      .spyOn(prisma.announcement, "findMany")
      .mockResolvedValue([]);

    const popup = await getPendingPartnerPopup("partner-1", { firstName: "Test" });
    expect(popup).toBeNull();
    expect(findManyAnnouncementsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isFullScreen: true,
          OR: [
            { status: "PUBLISHED" },
            expect.objectContaining({
              status: "SCHEDULED",
            }),
          ],
        }),
      }),
    );
  });

  it("records displayed and dismissed interactions with timestamps", async () => {
    const updateManySpy = vi
      .spyOn(prisma.partnerPopupEvent, "updateMany")
      .mockResolvedValue({ count: 1 });

    await recordPopupDisplayed("popup-123", "partner-1");
    expect(updateManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "popup-123", partnerId: "partner-1", displayedAt: null },
        data: expect.objectContaining({ displayedAt: expect.any(Date) }),
      }),
    );

    await recordPopupDismissed("popup-123", "partner-1", true);
    expect(updateManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "popup-123", partnerId: "partner-1" },
        data: expect.objectContaining({
          dismissedAt: expect.any(Date),
          clickedAt: expect.any(Date),
        }),
      }),
    );
  });
});

describe("Popup Non-Repeating & Persistence Verification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does not resurface welcome popup once displayedAt is set (even if dismissedAt is null)", async () => {
    vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
      id: "partner-1",
      displayName: "Sami Ben Salah",
      status: "ACTIVE",
      notes: null,
      userId: "user-1",
    } as unknown as Partner);

    vi.spyOn(prisma.systemSetting, "findUnique").mockResolvedValue(null);

    // Welcome popup exists and was already displayed, but not dismissed
    vi.spyOn(prisma.partnerPopupEvent, "findUnique").mockResolvedValue({
      id: "popup-welcome-1",
      partnerId: "partner-1",
      type: "WELCOME",
      eventKey: "WELCOME",
      displayedAt: new Date(),
      dismissedAt: null,
    } as unknown as PartnerPopupEvent);

    vi.spyOn(prisma.partnerPopupEvent, "findFirst").mockResolvedValue(null);
    vi.spyOn(prisma.announcement, "findMany").mockResolvedValue([]);

    const popup = await getPendingPartnerPopup("partner-1", { firstName: "Sami" });
    expect(popup).toBeNull();
  });

  it("does not resurface level-up popup once displayedAt is set", async () => {
    vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
      id: "partner-1",
      displayName: "Sami",
      status: "ACTIVE",
      notes: null,
      userId: "user-1",
    } as unknown as Partner);

    vi.spyOn(prisma.systemSetting, "findUnique").mockResolvedValue(null);

    // Welcome dismissed
    vi.spyOn(prisma.partnerPopupEvent, "findUnique").mockResolvedValue({
      id: "welcome-1",
      dismissedAt: new Date(),
    } as unknown as PartnerPopupEvent);

    // Level up query with displayedAt: null returns null because all were displayed
    const findFirstSpy = vi
      .spyOn(prisma.partnerPopupEvent, "findFirst")
      .mockResolvedValue(null);

    vi.spyOn(prisma.announcement, "findMany").mockResolvedValue([]);

    const popup = await getPendingPartnerPopup("partner-1", { firstName: "Sami" });
    expect(popup).toBeNull();
    expect(findFirstSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "LEVEL_UP",
          dismissedAt: null,
          displayedAt: null,
        }),
      }),
    );
  });

  it("surfaces new independent announcements even if older ones were displayed", async () => {
    vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
      id: "partner-1",
      displayName: "Sami",
      status: "ACTIVE",
      notes: null,
      userId: "user-1",
    } as unknown as Partner);

    vi.spyOn(prisma.systemSetting, "findUnique").mockResolvedValue(null);

    // Welcome already dismissed
    vi.spyOn(prisma.partnerPopupEvent, "findUnique")
      .mockResolvedValueOnce({
        id: "welcome-1",
        dismissedAt: new Date(),
      } as unknown as PartnerPopupEvent)
      // New announcement has no popup delivery event yet
      .mockResolvedValueOnce(null);

    vi.spyOn(prisma.partnerPopupEvent, "findFirst").mockResolvedValue(null);

    vi.spyOn(prisma.announcement, "findMany").mockResolvedValue([
      {
        id: "ann-new-1",
        title: "Nouvelle Annonce Importante",
        content: "Contenu de la nouvelle annonce",
        type: "INFO",
        targetAudience: "ALL",
        buttonText: "Voir",
        buttonUrl: "/info",
        imageUrl: null,
      } as unknown as any,
    ]);

    vi.spyOn(prisma.partnerPopupEvent, "create").mockResolvedValue({
      id: "popup-ann-new-1",
      partnerId: "partner-1",
      type: "ANNOUNCEMENT",
      eventKey: "ann-new-1",
      title: "Nouvelle Annonce Importante",
      message: "Contenu de la nouvelle annonce",
      buttonText: "Voir",
      buttonUrl: "/info",
      imageUrl: null,
      dismissedAt: null,
      displayedAt: null,
    } as unknown as PartnerPopupEvent);

    const popup = await getPendingPartnerPopup("partner-1", { firstName: "Sami" });
    expect(popup).not.toBeNull();
    expect(popup?.id).toBe("popup-ann-new-1");
    expect(popup?.title).toBe("Nouvelle Annonce Importante");
  });
});

describe("Performance Level Upgrade Notification & Idempotency", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("generates notification and popup on Bronze -> Silver upgrade", async () => {
    const upsertSpy = vi.spyOn(prisma.partnerPopupEvent, "upsert").mockResolvedValue({
      id: "popup-perf-silver",
      partnerId: "partner-1",
      type: "LEVEL_UP",
      eventKey: "PERF_UPGRADE:Bronze->Silver",
    } as unknown as PartnerPopupEvent);

    vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
      id: "partner-1",
      userId: "user-1",
    } as unknown as Partner);

    const notifSpy = vi.spyOn(prisma.notification, "create").mockResolvedValue({} as unknown as Notification);
    vi.spyOn(prisma.notification, "findFirst").mockResolvedValue(null);

    const res = await queuePerformanceLevelUpgrade({
      partnerId: "partner-1",
      previousLevelName: "Bronze",
      newLevelName: "Silver",
      previousSortOrder: 1,
      newSortOrder: 2,
      newSharePercentage: 15,
      description: "Accès à des commissions boostées et support prioritaire",
    });

    expect(res).not.toBeNull();
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          partnerId_type_eventKey: {
            partnerId: "partner-1",
            type: "LEVEL_UP",
            eventKey: "PERF_UPGRADE:Bronze->Silver",
          },
        },
        create: expect.objectContaining({
          type: "LEVEL_UP",
          eventKey: "PERF_UPGRADE:Bronze->Silver",
          title: expect.stringContaining("Félicitations"),
          message: expect.stringContaining("Silver"),
          buttonUrl: "/mes-performances",
          metadata: expect.objectContaining({
            previousLevel: "Bronze",
            newLevel: "Silver",
            benefits: "Accès à des commissions boostées et support prioritaire",
          }),
        }),
      }),
    );
    expect(notifSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          link: "/mes-performances",
          title: expect.stringContaining("Félicitations"),
        }),
      }),
    );
  });

  it("generates notification and popup on Silver -> Gold upgrade", async () => {
    const upsertSpy = vi.spyOn(prisma.partnerPopupEvent, "upsert").mockResolvedValue({
      id: "popup-perf-gold",
      partnerId: "partner-1",
      type: "LEVEL_UP",
      eventKey: "PERF_UPGRADE:Silver->Gold",
    } as unknown as PartnerPopupEvent);

    vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
      id: "partner-1",
      userId: "user-1",
    } as unknown as Partner);

    const notifSpy = vi.spyOn(prisma.notification, "create").mockResolvedValue({} as unknown as Notification);
    vi.spyOn(prisma.notification, "findFirst").mockResolvedValue(null);

    const res = await queuePerformanceLevelUpgrade({
      partnerId: "partner-1",
      previousLevelName: "Silver",
      newLevelName: "Gold",
      previousSortOrder: 2,
      newSortOrder: 3,
      newSharePercentage: 25,
      description: "Avantages Gold exclusifs",
    });

    expect(res).not.toBeNull();
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          partnerId_type_eventKey: {
            partnerId: "partner-1",
            type: "LEVEL_UP",
            eventKey: "PERF_UPGRADE:Silver->Gold",
          },
        },
      }),
    );
    expect(notifSpy).toHaveBeenCalled();
  });

  it("is idempotent: repeated processing does not create duplicate notifications", async () => {
    vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
      id: "partner-1",
      userId: "user-1",
    } as unknown as Partner);

    vi.spyOn(prisma.partnerPopupEvent, "upsert").mockResolvedValue({
      id: "popup-perf-silver",
      partnerId: "partner-1",
      type: "LEVEL_UP",
      eventKey: "PERF_UPGRADE:Bronze->Silver",
    } as unknown as PartnerPopupEvent);

    // Notification already exists for this upgrade
    vi.spyOn(prisma.notification, "findFirst").mockResolvedValue({
      id: "notif-existing-1",
    } as unknown as Notification);

    const notifCreateSpy = vi.spyOn(prisma.notification, "create");

    await queuePerformanceLevelUpgrade({
      partnerId: "partner-1",
      previousLevelName: "Bronze",
      newLevelName: "Silver",
      previousSortOrder: 1,
      newSortOrder: 2,
    });

    // Should NOT create duplicate notification
    expect(notifCreateSpy).not.toHaveBeenCalled();
  });

  it("respects multilingual titles and messages for Arabic partners", async () => {
    vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
      id: "partner-ar",
      userId: "user-ar",
    } as unknown as Partner);

    // Arabic locale in user settings
    vi.spyOn(prisma.systemSetting, "findUnique").mockResolvedValue({
      key: "user.user-ar.locale",
      value: "ar",
    } as unknown as any);

    const upsertSpy = vi.spyOn(prisma.partnerPopupEvent, "upsert").mockResolvedValue({
      id: "popup-ar",
    } as unknown as PartnerPopupEvent);

    vi.spyOn(prisma.notification, "findFirst").mockResolvedValue(null);
    const notifSpy = vi.spyOn(prisma.notification, "create").mockResolvedValue({} as unknown as Notification);

    await queuePerformanceLevelUpgrade({
      partnerId: "partner-ar",
      previousLevelName: "Bronze",
      newLevelName: "Silver",
      previousSortOrder: 1,
      newSortOrder: 2,
    });

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          title: "مبروك! ارتقيت إلى مستوى جديد!",
          buttonText: "اكتشف مستواي الجديد",
        }),
      }),
    );
    expect(notifSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "مبروك! ارتقيت إلى مستوى جديد!",
        }),
      }),
    );
  });
});
