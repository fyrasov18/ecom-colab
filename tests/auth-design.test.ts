import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  authMarketingContentSchema,
  authPagesDesignSchema,
} from "@/modules/branding/auth-design-schemas";
import {
  DEFAULT_AUTH_MARKETING_AR,
  DEFAULT_AUTH_MARKETING_EN,
  DEFAULT_AUTH_MARKETING_FR,
  DEFAULT_AUTH_PAGES_DESIGN,
} from "@/modules/branding/defaults";
import {
  getAuthPagesDesign,
  resetAuthPagesDesign,
  updateAuthPagesDesign,
} from "@/modules/branding/service";
import type { PrismaClient } from "@prisma/client";

describe("Auth Pages Design Schemas & Defaults", () => {
  it("successfully parses default auth pages design", () => {
    const parsed = authPagesDesignSchema.parse(DEFAULT_AUTH_PAGES_DESIGN);
    expect(parsed.colors.primaryColor).toBe("#10B981");
    expect(parsed.colors.accentColor).toBe("#A3E635");
    expect(parsed.colors.marketingBg).toBe("#0B1220");
    expect(parsed.layout.showMarketingPanel).toBe(true);
    expect(parsed.content.fr.loginBadge).toBe(DEFAULT_AUTH_MARKETING_FR.loginBadge);
    expect(parsed.content.ar.loginBadge).toBe(DEFAULT_AUTH_MARKETING_AR.loginBadge);
    expect(parsed.content.en.loginBadge).toBe(DEFAULT_AUTH_MARKETING_EN.loginBadge);
  });

  it("normalizes empty strings and undefined in logo URLs to null", () => {
    const result = authPagesDesignSchema.parse({
      branding: {
        logoLightUrl: "",
        logoDarkUrl: undefined,
        logoMarkUrl: "https://example.com/mark.png",
      },
      colors: {
        primaryColor: "#2563EB",
        accentColor: "#F59E0B",
        buttonBg: "#2563EB",
        buttonText: "#FFFFFF",
        marketingBg: "#0F172A",
      },
      layout: {
        showMarketingPanel: false,
        showFeatureCards: true,
        showTrustBadges: false,
        showPlatformMockup: true,
      },
      content: {
        fr: DEFAULT_AUTH_MARKETING_FR,
        ar: DEFAULT_AUTH_MARKETING_AR,
        en: DEFAULT_AUTH_MARKETING_EN,
      },
    });

    expect(result.branding.logoLightUrl).toBeNull();
    expect(result.branding.logoDarkUrl).toBeNull();
    expect(result.branding.logoMarkUrl).toBe("https://example.com/mark.png");
    expect(result.layout.showMarketingPanel).toBe(false);
  });

  it("rejects invalid hex colors in auth design", () => {
    expect(() =>
      authPagesDesignSchema.parse({
        ...DEFAULT_AUTH_PAGES_DESIGN,
        colors: {
          ...DEFAULT_AUTH_PAGES_DESIGN.colors,
          buttonBg: "invalid-color",
        },
      }),
    ).toThrow();
  });

  it("validates multilingual marketing content schema fields", () => {
    const valid = authMarketingContentSchema.parse({
      loginBadge: "Super Système",
      loginHeadline: "Infrastructure E-commerce",
      loginSubtitle: "Développez vos ventes rapidement",
      registerBadge: "Nouveau Partenaire",
      registerHeadline: "Rejoignez le réseau",
      registerSubtitle: "Sans stock, commissions hebdomadaires",
      feature1Title: "Catalogue",
      feature1Desc: "Produits gagnants",
      feature2Title: "Livraison 24/48h",
      feature2Desc: "Call center dédié",
      feature3Title: "Paiements rapides",
      feature3Desc: "Règlements chaque semaine",
      trustStat1Value: "+20 000",
      trustStat1Label: "Colis livrés",
      trustStat2Value: "95%",
      trustStat2Label: "Confirmation",
      footerText: "EcomPartner 2026",
    });

    expect(valid.trustStat1Value).toBe("+20 000");
    expect(valid.trustStat2Value).toBe("95%");
  });
});

describe("Auth Pages Design Service Layer", () => {
  let mockPrisma: {
    systemSetting: {
      findUnique: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
    auditLog: {
      create: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      systemSetting: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-1" }),
      },
    };
  });

  it("returns default design when no setting is saved in DB", async () => {
    mockPrisma.systemSetting.findUnique.mockResolvedValue(null);

    const result = await getAuthPagesDesign(mockPrisma as unknown as PrismaClient);
    expect(result).toEqual(DEFAULT_AUTH_PAGES_DESIGN);
    expect(mockPrisma.systemSetting.findUnique).toHaveBeenCalledWith({
      where: { key: "branding.auth_design" },
    });
  });

  it("returns parsed custom design when valid row exists", async () => {
    const customConfig = {
      ...DEFAULT_AUTH_PAGES_DESIGN,
      colors: {
        ...DEFAULT_AUTH_PAGES_DESIGN.colors,
        primaryColor: "#2563EB",
        buttonBg: "#2563EB",
      },
    };

    mockPrisma.systemSetting.findUnique.mockResolvedValue({
      key: "branding.auth_design",
      value: customConfig,
    });

    const result = await getAuthPagesDesign(mockPrisma as unknown as PrismaClient);
    expect(result.colors.primaryColor).toBe("#2563EB");
    expect(result.colors.buttonBg).toBe("#2563EB");
  });

  it("updates auth design, saves to systemSetting and records audit", async () => {
    mockPrisma.systemSetting.findUnique.mockResolvedValue(null);
    mockPrisma.systemSetting.upsert.mockResolvedValue({});

    const input = {
      ...DEFAULT_AUTH_PAGES_DESIGN,
      colors: {
        ...DEFAULT_AUTH_PAGES_DESIGN.colors,
        accentColor: "#F59E0B",
      },
    };

    const res = await updateAuthPagesDesign(input, "admin-user-id", mockPrisma as unknown as PrismaClient);
    expect(res.colors.accentColor).toBe("#F59E0B");

    expect(mockPrisma.systemSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "branding.auth_design" },
        create: expect.objectContaining({
          key: "branding.auth_design",
          category: "branding",
          updatedById: "admin-user-id",
        }),
      }),
    );

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "AUTH_PAGES_DESIGN_UPDATED",
          actorId: "admin-user-id",
          entityType: "SystemSetting",
          entityId: "branding.auth_design",
        }),
      }),
    );
  });

  it("resets auth design back to defaults and records audit", async () => {
    mockPrisma.systemSetting.findUnique.mockResolvedValue({
      key: "branding.auth_design",
      value: { ...DEFAULT_AUTH_PAGES_DESIGN, colors: { ...DEFAULT_AUTH_PAGES_DESIGN.colors, primaryColor: "#F43F5E" } },
    });
    mockPrisma.systemSetting.deleteMany.mockResolvedValue({ count: 1 });

    const res = await resetAuthPagesDesign("admin-user-id", mockPrisma as unknown as PrismaClient);
    expect(res).toEqual(DEFAULT_AUTH_PAGES_DESIGN);

    expect(mockPrisma.systemSetting.deleteMany).toHaveBeenCalledWith({
      where: { key: "branding.auth_design" },
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "AUTH_PAGES_DESIGN_RESET",
          actorId: "admin-user-id",
        }),
      }),
    );
  });
});
