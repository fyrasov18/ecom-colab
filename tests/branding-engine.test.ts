import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  hexColorSchema,
  platformBrandingSchema,
  dashboardDesignSchema,
  partnerBrandingSchema,
} from "@/modules/branding/schemas";
import {
  validateLogoUpload,
  verifyImageMagicBytes,
} from "@/modules/branding/storage";
import {
  DEFAULT_DASHBOARD_DESIGN,
  DEFAULT_PLATFORM_BRANDING,
} from "@/modules/branding/defaults";
import { resolveBrandingContext } from "@/modules/branding/service";
import type { PrismaClient } from "@prisma/client";

describe("Branding Schemas & Hex Color Validation", () => {
  it("validates valid 6-character hex colors", () => {
    expect(hexColorSchema.parse("#10B981")).toBe("#10B981");
    expect(hexColorSchema.parse("#ffffff")).toBe("#ffffff");
    expect(hexColorSchema.parse("#000000")).toBe("#000000");
    expect(hexColorSchema.parse("#a3e635")).toBe("#a3e635");
  });

  it("rejects invalid hex colors", () => {
    expect(() => hexColorSchema.parse("#fff")).toThrow(); // 3-char shorthand not permitted
    expect(() => hexColorSchema.parse("10B981")).toThrow(); // Missing hash
    expect(() => hexColorSchema.parse("#12345Z")).toThrow(); // Invalid character
    expect(() => hexColorSchema.parse("rgb(16, 185, 129)")).toThrow(); // CSS function
  });

  it("validates platform branding schema with defaults", () => {
    const valid = platformBrandingSchema.parse({
      platformName: "MyCustomPlatform",
      platformTagline: "Le meilleur du e-commerce",
      logoLightUrl: null,
    });
    expect(valid.platformName).toBe("MyCustomPlatform");
    expect(valid.platformTagline).toBe("Le meilleur du e-commerce");
    expect(valid.logoLightUrl).toBeNull();
  });

  it("rejects platform branding with empty platformName", () => {
    expect(() =>
      platformBrandingSchema.parse({
        platformName: "",
      }),
    ).toThrow();
  });

  it("validates dashboard design schema and enums", () => {
    const design = dashboardDesignSchema.parse({
      primaryColor: "#2563EB",
      secondaryColor: "#F1F5F9",
      accentColor: "#F59E0B",
      sidebarBg: "#0F172A",
      borderRadius: "14px",
      themeMode: "dark",
    });
    expect(design.primaryColor).toBe("#2563EB");
    expect(design.borderRadius).toBe("14px");
    expect(design.themeMode).toBe("dark");
  });

  it("validates partner branding schema and optional contacts", () => {
    const partner = partnerBrandingSchema.parse({
      companyName: "Horizon Store",
      brandColorPrimary: "#0284C7",
      supportEmail: "contact@horizon.tn",
      supportPhone: "+216 20 123 456",
      websiteUrl: "https://horizon-store.tn",
    });
    expect(partner.companyName).toBe("Horizon Store");
    expect(partner.brandColorPrimary).toBe("#0284C7");
    expect(partner.supportEmail).toBe("contact@horizon.tn");
  });

  it("rejects invalid website URLs in partner branding", () => {
    expect(() =>
      partnerBrandingSchema.parse({
        companyName: "Valid Name",
        websiteUrl: "not-a-valid-url",
      }),
    ).toThrow();
  });
});

describe("Logo & Asset Storage Validation", () => {
  it("approves PNG, WebP, and JPEG uploads within size limits", () => {
    const pngCheck = validateLogoUpload({
      fileName: "logo.png",
      size: 500 * 1024,
      mimeType: "image/png",
    });
    expect(pngCheck.ok).toBe(true);
    if (pngCheck.ok) {
      expect(pngCheck.extension).toBe(".png");
    }

    const webpCheck = validateLogoUpload({
      fileName: "logo.webp",
      size: 300 * 1024,
      mimeType: "image/webp",
    });
    expect(webpCheck.ok).toBe(true);
  });

  it("rejects raw SVG uploads to prevent stored XSS attacks", () => {
    const svgCheck = validateLogoUpload({
      fileName: "malicious.svg",
      size: 10 * 1024,
      mimeType: "image/svg+xml",
    });
    expect(svgCheck.ok).toBe(false);
    if (!svgCheck.ok) {
      expect(svgCheck.error).toContain("SVG");
    }
  });

  it("rejects oversized files exceeding 2MB limit", () => {
    const overCheck = validateLogoUpload({
      fileName: "huge.png",
      size: 3 * 1024 * 1024, // 3MB
      mimeType: "image/png",
    });
    expect(overCheck.ok).toBe(false);
  });

  it("rejects zero-byte empty uploads", () => {
    const emptyCheck = validateLogoUpload({
      fileName: "empty.png",
      size: 0,
      mimeType: "image/png",
    });
    expect(emptyCheck.ok).toBe(false);
  });

  it("verifies genuine image magic bytes signatures", () => {
    // Valid PNG signature (89 50 4E 47 0D 0A 1A 0A)
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const pngRes = verifyImageMagicBytes(pngHeader);
    expect(pngRes.ok).toBe(true);
    if (pngRes.ok) expect(pngRes.format).toBe("png");

    // Valid JPEG signature (FF D8 FF)
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const jpegRes = verifyImageMagicBytes(jpegHeader);
    expect(jpegRes.ok).toBe(true);
    if (jpegRes.ok) expect(jpegRes.format).toBe("jpeg");

    // Spoofed text file disguised as PNG
    const spoofedHeader = Buffer.from("<html><script>alert(1)</script></html>");
    const spoofedRes = verifyImageMagicBytes(spoofedHeader);
    expect(spoofedRes.ok).toBe(false);
  });
});

describe("Hierarchical Branding Resolution Engine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves to default EcomPartner branding when no custom settings exist", async () => {
    const mockDb = {
      systemSetting: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      partner: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaClient;

    const resolved = await resolveBrandingContext({
      scope: "admin",
      db: mockDb,
    });

    expect(resolved.name).toBe(DEFAULT_PLATFORM_BRANDING.platformName);
    expect(resolved.primaryColor).toBe(DEFAULT_DASHBOARD_DESIGN.primaryColor);
    expect(resolved.borderRadius).toBe(DEFAULT_DASHBOARD_DESIGN.borderRadius);
    expect(resolved.isPartner).toBe(false);
    expect(resolved.isCustom).toBe(false);
  });

  it("resolves to partner-specific branding when partner has custom identity", async () => {
    const mockDb = {
      systemSetting: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      partner: {
        findUnique: vi.fn().mockResolvedValue({
          id: "partner-123",
          displayName: "Mohamed Ben Ali",
          companyName: "Alpha Store",
          companyLogoUrl: "/uploads/branding/partners/alpha.png",
          companyLogoDarkUrl: null,
          companyMarkUrl: "/uploads/branding/partners/alpha-mark.png",
          brandColorPrimary: "#6366F1",
          brandColorSecondary: "#FB923C",
          companyDescription: "Boutique en ligne premium",
          supportEmail: "support@alpha.tn",
          supportPhone: "+216 55 555 555",
          websiteUrl: "https://alpha.tn",
        }),
      },
    } as unknown as PrismaClient;

    const resolved = await resolveBrandingContext({
      scope: "partenaire",
      partnerId: "partner-123",
      db: mockDb,
    });

    expect(resolved.name).toBe("Alpha Store");
    expect(resolved.logoLight).toBe("/uploads/branding/partners/alpha.png");
    expect(resolved.logoMark).toBe("/uploads/branding/partners/alpha-mark.png");
    expect(resolved.primaryColor).toBe("#6366F1");
    expect(resolved.isPartner).toBe(true);
    expect(resolved.isCustom).toBe(true);
  });

  it("falls back to platform branding for partner without custom company identity", async () => {
    const mockDb = {
      systemSetting: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.key === "branding.platform") {
            return Promise.resolve({
              value: {
                platformName: "EnterpriseEcom",
                platformTagline: "Platform Tagline",
                platformDescription: "Platform Desc",
                logoLightUrl: "/uploads/branding/platform/platform-logo.png",
                logoDarkUrl: null,
                logoMarkUrl: null,
                faviconUrl: "/brand/app-icon.svg",
              },
            });
          }
          return Promise.resolve(null);
        }),
      },
      partner: {
        findUnique: vi.fn().mockResolvedValue({
          id: "partner-empty",
          displayName: "New Partner",
          companyName: null,
          companyLogoUrl: null,
          companyLogoDarkUrl: null,
          companyMarkUrl: null,
          brandColorPrimary: null,
          brandColorSecondary: null,
          companyDescription: null,
          supportEmail: null,
          supportPhone: null,
          websiteUrl: null,
        }),
      },
    } as unknown as PrismaClient;

    const resolved = await resolveBrandingContext({
      scope: "partenaire",
      partnerId: "partner-empty",
      db: mockDb,
    });

    // Partner has no custom company name/logo, so resolves to platform identity
    expect(resolved.name).toBe("New Partner");
    expect(resolved.logoLight).toBe("/uploads/branding/platform/platform-logo.png");
    expect(resolved.primaryColor).toBe(DEFAULT_DASHBOARD_DESIGN.primaryColor);
  });
});
