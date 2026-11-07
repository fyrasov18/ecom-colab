import { describe, expect, it, vi, beforeEach } from "vitest";
import { welcomeSettingsSchema } from "@/modules/announcements/schemas";
import {
  getPendingPartnerPopup,
  recordPopupDismissed,
  recordPopupDisplayed,
} from "@/modules/announcements/service";
import { prisma } from "@/lib/prisma";
import type { Partner, PartnerPopupEvent, SystemSetting } from "@prisma/client";

describe("Ecom Partner — First Login Welcome Onboarding Modal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Schema & Visual Content Standards", () => {
    it("validates welcome settings schema with default fallback values", () => {
      const valid = welcomeSettingsSchema.parse({});
      expect(valid.isEnabled).toBe(true);
      expect(valid.title).toContain("{partnerName}");
      expect(valid.title).toContain("Bienvenue chez Ecom Partner");
      expect(valid.message).toContain("validé avec succès");
      expect(valid.themeColor).toBe("purple");
      expect(valid.bannerText).toContain("plateforme de dropshipping");
    });

    it("allows customizing CTA text, destination URL, banner and visual theme", () => {
      const customized = welcomeSettingsSchema.parse({
        title: "Bienvenue à bord, {partnerName} !",
        message: "Votre compte est prêt. Accédez immédiatement à vos outils.",
        buttonText: "Accéder au catalogue exclusif 🛍️",
        buttonUrl: "/produits",
        bannerText: "🚀 Nouvelle saison, nouvelles opportunités !",
        themeColor: "emerald",
      });

      expect(customized.buttonText).toBe("Accéder au catalogue exclusif 🛍️");
      expect(customized.buttonUrl).toBe("/produits");
      expect(customized.bannerText).toBe("🚀 Nouvelle saison, nouvelles opportunités !");
      expect(customized.themeColor).toBe("emerald");
    });
  });

  describe("First Login Trigger & Partner Status Guardrails", () => {
    it("surfaces welcome popup on first login of an ACTIVE partner", async () => {
      vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
        id: "partner-active-1",
        displayName: "Sami Ben Salah",
        status: "ACTIVE",
        notes: null,
        userId: "user-1",
      } as unknown as Partner);

      vi.spyOn(prisma.systemSetting, "findUnique").mockResolvedValue(null);
      vi.spyOn(prisma.partnerPopupEvent, "findUnique").mockResolvedValue(null);

      const createSpy = vi.spyOn(prisma.partnerPopupEvent, "create").mockResolvedValue({
        id: "popup-welcome-active",
        partnerId: "partner-active-1",
        type: "WELCOME",
        eventKey: "WELCOME",
        title: "Bienvenue chez Ecom Partner, Sami Ben Salah ! 🎉",
        message: "Votre compte partenaire a été validé avec succès. Félicitations !",
        buttonText: "On est ensemble ! 🚀",
        buttonUrl: "/catalogue",
        imageUrl: null,
        metadata: null,
        displayedAt: null,
        dismissedAt: null,
        clickedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as PartnerPopupEvent);

      const popup = await getPendingPartnerPopup("partner-active-1", { firstName: "Sami" });

      expect(popup).not.toBeNull();
      expect(popup?.type).toBe("WELCOME");
      expect(popup?.title).toContain("Sami Ben Salah");
      expect(popup?.themeColor).toBe("purple");
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            partnerId: "partner-active-1",
            type: "WELCOME",
            eventKey: "WELCOME",
          }),
        }),
      );
    });

    it("DOES NOT surface welcome popup if partner account is still PENDING", async () => {
      vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
        id: "partner-pending-1",
        displayName: "Pending Partner",
        status: "PENDING",
        notes: null,
        userId: "user-2",
      } as unknown as Partner);

      const popup = await getPendingPartnerPopup("partner-pending-1", { firstName: "Pending" });
      expect(popup).toBeNull();
    });

    it("DOES NOT surface welcome popup if partner account is SUSPENDED or REJECTED", async () => {
      vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
        id: "partner-suspended-1",
        displayName: "Suspended Partner",
        status: "SUSPENDED",
        notes: null,
        userId: "user-3",
      } as unknown as Partner);

      const popup = await getPendingPartnerPopup("partner-suspended-1", { firstName: "Suspended" });
      expect(popup).toBeNull();
    });

    it("DOES NOT surface welcome popup if welcome notification is disabled in admin settings", async () => {
      vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
        id: "partner-active-2",
        displayName: "Active Partner",
        status: "ACTIVE",
        notes: null,
        userId: "user-4",
      } as unknown as Partner);

      vi.spyOn(prisma.systemSetting, "findUnique").mockResolvedValue({
        id: "setting-1",
        key: "announcements.welcome_settings",
        category: "announcements",
        description: null,
        value: {
          isEnabled: false,
          title: "Disabled",
          message: "Disabled",
        },
        updatedById: null,
        updatedAt: new Date(),
      } as unknown as SystemSetting);

      // No other popups
      vi.spyOn(prisma.partnerPopupEvent, "findFirst").mockResolvedValue(null);
      vi.spyOn(prisma.announcement, "findMany").mockResolvedValue([]);

      const popup = await getPendingPartnerPopup("partner-active-2", { firstName: "Active" });
      expect(popup).toBeNull();
    });
  });

  describe("Dismissal & Single Appearance Guarantee (No Repetition on Navigation)", () => {
    it("returns null once the welcome popup has been dismissed", async () => {
      vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
        id: "partner-active-3",
        displayName: "Active Partner",
        status: "ACTIVE",
        notes: null,
        userId: "user-5",
      } as unknown as Partner);

      vi.spyOn(prisma.systemSetting, "findUnique").mockResolvedValue(null);

      // Popup was previously shown and dismissed
      vi.spyOn(prisma.partnerPopupEvent, "findUnique").mockResolvedValue({
        id: "popup-welcome-dismissed",
        partnerId: "partner-active-3",
        type: "WELCOME",
        eventKey: "WELCOME",
        dismissedAt: new Date(),
      } as unknown as PartnerPopupEvent);

      vi.spyOn(prisma.partnerPopupEvent, "findFirst").mockResolvedValue(null);
      vi.spyOn(prisma.announcement, "findMany").mockResolvedValue([]);

      const popup = await getPendingPartnerPopup("partner-active-3", { firstName: "Active" });
      expect(popup).toBeNull();
    });

    it("records display timestamp when popup is shown", async () => {
      const updateManySpy = vi
        .spyOn(prisma.partnerPopupEvent, "updateMany")
        .mockResolvedValue({ count: 1 });

      await recordPopupDisplayed("popup-welcome-4", "partner-active-4");
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "popup-welcome-4", partnerId: "partner-active-4", displayedAt: null },
          data: expect.objectContaining({ displayedAt: expect.any(Date) }),
        }),
      );
    });

    it("records both dismissedAt and clickedAt when partner clicks CTA button", async () => {
      const updateManySpy = vi
        .spyOn(prisma.partnerPopupEvent, "updateMany")
        .mockResolvedValue({ count: 1 });

      await recordPopupDismissed("popup-welcome-4", "partner-active-4", true);
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "popup-welcome-4", partnerId: "partner-active-4" },
          data: expect.objectContaining({
            dismissedAt: expect.any(Date),
            clickedAt: expect.any(Date),
          }),
        }),
      );
    });

    it("records dismissedAt without clickedAt when partner clicks Close button", async () => {
      const updateManySpy = vi
        .spyOn(prisma.partnerPopupEvent, "updateMany")
        .mockResolvedValue({ count: 1 });

      await recordPopupDismissed("popup-welcome-4", "partner-active-4", false);
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "popup-welcome-4", partnerId: "partner-active-4" },
          data: expect.objectContaining({
            dismissedAt: expect.any(Date),
          }),
        }),
      );
    });
  });
});
