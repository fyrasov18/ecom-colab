import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  formatRelativeTime,
  formatUnreadCount,
  isReferralOrPartnerNotification,
} from "@/modules/notifications/labels";
import {
  getUserLocale,
  notifyReferralRegistration,
  notifyAdminsPendingPartner,
  notifyPartnerApproved,
} from "@/modules/notifications/service";
import { registerPartner } from "@/modules/registration/service";
import { setPartnerStatus } from "@/modules/partners/service";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@prisma/client";

describe("Notification Center & Referral Notifications", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("formatRelativeTime", () => {
    const fixedNow = new Date("2026-11-12T12:00:00Z");

    it("formats 'just now' across FR, EN, AR", () => {
      const justNow = new Date("2026-11-12T11:59:40Z");
      expect(formatRelativeTime(justNow, fixedNow, "fr")).toBe("À l'instant");
      expect(formatRelativeTime(justNow, fixedNow, "en")).toBe("Just now");
      expect(formatRelativeTime(justNow, fixedNow, "ar")).toBe("الآن");
    });

    it("formats minutes ago across FR, EN, AR", () => {
      const fiveMinAgo = new Date("2026-11-12T11:55:00Z");
      expect(formatRelativeTime(fiveMinAgo, fixedNow, "fr")).toBe("Il y a 5 min");
      expect(formatRelativeTime(fiveMinAgo, fixedNow, "en")).toBe("5m ago");
      expect(formatRelativeTime(fiveMinAgo, fixedNow, "ar")).toBe("منذ 5 د");
    });

    it("formats hours ago across FR, EN, AR", () => {
      const threeHoursAgo = new Date("2026-11-12T09:00:00Z");
      expect(formatRelativeTime(threeHoursAgo, fixedNow, "fr")).toBe("Il y a 3 h");
      expect(formatRelativeTime(threeHoursAgo, fixedNow, "en")).toBe("3h ago");
      expect(formatRelativeTime(threeHoursAgo, fixedNow, "ar")).toBe("منذ 3 س");
    });

    it("formats days ago across FR, EN, AR", () => {
      const twoDaysAgo = new Date("2026-11-10T12:00:00Z");
      expect(formatRelativeTime(twoDaysAgo, fixedNow, "fr")).toBe("Il y a 2 j");
      expect(formatRelativeTime(twoDaysAgo, fixedNow, "en")).toBe("2d ago");
      expect(formatRelativeTime(twoDaysAgo, fixedNow, "ar")).toBe("منذ 2 ي");
    });
  });

  describe("isReferralOrPartnerNotification", () => {
    it("identifies referral and partner approval keywords", () => {
      expect(
        isReferralOrPartnerNotification({
          type: "SYSTEM",
          title: "Nouveau partenaire inscrit !",
        }),
      ).toBe(true);

      expect(
        isReferralOrPartnerNotification({
          type: "SYSTEM",
          title: "شريك جديد سجّل !",
        }),
      ).toBe(true);

      expect(
        isReferralOrPartnerNotification({
          type: "SYSTEM",
          title: "New referral registration",
        }),
      ).toBe(true);

      expect(
        isReferralOrPartnerNotification({
          type: "ORDER_STATUS",
          title: "Commande expédiée",
        }),
      ).toBe(false);
    });
  });

  describe("getUserLocale", () => {
    it("returns user saved locale from SystemSetting", async () => {
      const mockDb = {
        systemSetting: {
          findUnique: vi.fn().mockResolvedValue({ value: "ar" }),
        },
      } as unknown as PrismaClient;

      const locale = await getUserLocale("user-ar", mockDb);
      expect(locale).toBe("ar");
    });

    it("defaults to 'fr' when setting is absent or invalid", async () => {
      const mockDb = {
        systemSetting: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      } as unknown as PrismaClient;

      const locale = await getUserLocale("user-unknown", mockDb);
      expect(locale).toBe("fr");
    });
  });

  describe("notifyReferralRegistration", () => {
    it("creates notification for the referring partner in their preferred language", async () => {
      const createSpy = vi.fn().mockResolvedValue({ id: "notif-1" });
      const mockDb = {
        systemSetting: {
          findUnique: vi.fn().mockResolvedValue({ value: "en" }),
        },
        notification: {
          create: createSpy,
        },
      } as unknown as PrismaClient;

      await notifyReferralRegistration(mockDb, {
        referrerUserId: "referrer-user-1",
        newPartnerName: "Sami Ben Ali",
      });

      expect(createSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "referrer-user-1",
          type: "SYSTEM",
          title: "New partner registered!",
          link: "/parrainage",
        }),
      });
      expect(createSpy.mock.calls[0][0].data.body).toContain("awaiting administrator approval");
    });

    it("uses Arabic wording when referring partner has Arabic preferred language", async () => {
      const createSpy = vi.fn().mockResolvedValue({ id: "notif-2" });
      const mockDb = {
        systemSetting: {
          findUnique: vi.fn().mockResolvedValue({ value: "ar" }),
        },
        notification: {
          create: createSpy,
        },
      } as unknown as PrismaClient;

      await notifyReferralRegistration(mockDb, {
        referrerUserId: "referrer-user-ar",
        newPartnerName: "محمد التونسي",
      });

      expect(createSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "referrer-user-ar",
          type: "SYSTEM",
          title: "شريك جديد سجّل !",
          link: "/parrainage",
        }),
      });
      expect(createSpy.mock.calls[0][0].data.body).toContain("رابط الإحالة");
    });
  });

  describe("notifyAdminsPendingPartner", () => {
    it("targets authorized admins with MANAGE_PARTNERS permission and formats localized content", async () => {
      const createManySpy = vi.fn().mockResolvedValue({ count: 2 });
      const mockDb = {
        user: {
          findMany: vi.fn().mockResolvedValue([
            { id: "super-admin-1", role: "SUPER_ADMIN" },
            { id: "partner-admin-1", role: "ADMIN" },
            { id: "restricted-admin-1", role: "ADMIN" },
          ]),
        },
        systemSetting: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            if (where.key === "security.admin_permission_grants") {
              return Promise.resolve({
                value: {
                  "partner-admin-1": ["MANAGE_PARTNERS"],
                  "restricted-admin-1": ["VIEW_PRODUCTS"], // does NOT have MANAGE_PARTNERS
                },
              });
            }
            if (where.key === "user.language.super-admin-1") {
              return Promise.resolve({ value: "fr" });
            }
            if (where.key === "user.language.partner-admin-1") {
              return Promise.resolve({ value: "ar" });
            }
            return Promise.resolve(null);
          }),
        },
        notification: {
          createMany: createManySpy,
        },
      } as unknown as PrismaClient;

      await notifyAdminsPendingPartner(mockDb, {
        partnerId: "partner-new-123",
        partnerName: "Nouveau Partenaire",
      });

      expect(createManySpy).toHaveBeenCalled();
      const createdRows = createManySpy.mock.calls[0][0].data;

      // Exactly 2 authorized admins reached (SUPER_ADMIN and partner-admin-1)
      expect(createdRows).toHaveLength(2);
      expect(createdRows.map((r: { userId: string }) => r.userId)).toEqual(["super-admin-1", "partner-admin-1"]);

      // Super admin got French
      expect(createdRows[0].title).toBe("Nouveau partenaire en attente de validation");
      expect(createdRows[0].link).toBe("/partenaires/partner-new-123");

      // Authorized admin got Arabic
      expect(createdRows[1].title).toBe("شريك جديد في انتظار الموافقة");
      expect(createdRows[1].link).toBe("/partenaires/partner-new-123");
    });
  });

  describe("notifyPartnerApproved", () => {
    it("notifies both the newly approved partner and their referring partner", async () => {
      const createManySpy = vi.fn().mockResolvedValue({ count: 2 });
      const mockDb = {
        systemSetting: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            if (where.key === "user.language.new-partner-u1") return Promise.resolve({ value: "fr" });
            if (where.key === "user.language.ref-partner-u1") return Promise.resolve({ value: "fr" });
            return Promise.resolve(null);
          }),
        },
        notification: {
          createMany: createManySpy,
        },
      } as unknown as PrismaClient;

      await notifyPartnerApproved(mockDb, {
        partnerId: "p-approved",
        partnerUserId: "new-partner-u1",
        partnerName: "Yassine Tech",
        referrerUserId: "ref-partner-u1",
      });

      expect(createManySpy).toHaveBeenCalled();
      const rows = createManySpy.mock.calls[0][0].data;

      expect(rows).toHaveLength(2);

      // New partner notification
      expect(rows[0].userId).toBe("new-partner-u1");
      expect(rows[0].title).toBe("Compte validé ! 🎉");
      expect(rows[0].link).toBe("/catalogue");

      // Referring partner notification
      expect(rows[1].userId).toBe("ref-partner-u1");
      expect(rows[1].title).toBe("Partenaire validé !");
      expect(rows[1].link).toBe("/parrainage");
    });

    it("only notifies the partner if no referring partner exists", async () => {
      const createManySpy = vi.fn().mockResolvedValue({ count: 1 });
      const mockDb = {
        systemSetting: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        notification: {
          createMany: createManySpy,
        },
      } as unknown as PrismaClient;

      await notifyPartnerApproved(mockDb, {
        partnerId: "p-approved-direct",
        partnerUserId: "new-partner-u2",
        partnerName: "Direct Partner",
        referrerUserId: null,
      });

      const rows = createManySpy.mock.calls[0][0].data;
      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe("new-partner-u2");
    });
  });

  describe("Approval Workflow Integration in setPartnerStatus", () => {
    it("triggers approval notifications when status transitions from PENDING to ACTIVE", async () => {
      const mockPartnerBefore = {
        id: "p100",
        userId: "u100",
        displayName: "Mon Partenaire",
        status: "PENDING",
      };

      const mockPartnerAfter = {
        ...mockPartnerBefore,
        status: "ACTIVE",
      };

      const txMock = {
        partner: {
          findUniqueOrThrow: vi.fn().mockResolvedValue(mockPartnerBefore),
          update: vi.fn().mockResolvedValue(mockPartnerAfter),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: "audit-1" }),
        },
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue({
            referredPartnerId: "p100",
            referrerPartner: { userId: "referrer-u-99" },
          }),
        },
        systemSetting: {
          findUnique: vi.fn().mockResolvedValue({ value: "fr" }),
        },
        notification: {
          createMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => {
        return callback(txMock);
      });

      const result = await setPartnerStatus("p100", "ACTIVE", "admin-actor");

      expect(result.status).toBe("ACTIVE");
      expect(txMock.partner.update).toHaveBeenCalledWith({
        where: { id: "p100" },
        data: { status: "ACTIVE" },
      });
      expect(txMock.notification.createMany).toHaveBeenCalled();
    });

    it("does NOT trigger notifications if status was already ACTIVE", async () => {
      const mockPartnerBefore = {
        id: "p101",
        userId: "u101",
        displayName: "Partenaire Existant",
        status: "ACTIVE",
      };

      const txMock = {
        partner: {
          findUniqueOrThrow: vi.fn().mockResolvedValue(mockPartnerBefore),
          update: vi.fn().mockResolvedValue(mockPartnerBefore),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: "audit-2" }),
        },
        referralAttribution: {
          findUnique: vi.fn(),
        },
        notification: {
          createMany: vi.fn(),
        },
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => {
        return callback(txMock);
      });

      await setPartnerStatus("p101", "ACTIVE", "admin-actor");

      expect(txMock.referralAttribution.findUnique).not.toHaveBeenCalled();
      expect(txMock.notification.createMany).not.toHaveBeenCalled();
    });
  });
});
