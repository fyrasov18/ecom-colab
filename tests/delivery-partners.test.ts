import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  deliveryPartnerItemSchema,
  deliveryPartnersConfigSchema,
  DEFAULT_DELIVERY_PARTNERS_CONFIG,
  addDeliveryPartnerSchema,
  updateDeliveryPartnerSchema,
} from "@/modules/branding/delivery-partners-schemas";
import {
  getDeliveryPartnersConfig,
  getActiveDeliveryPartners,
  addDeliveryPartner,
  updateDeliveryPartner,
  deleteDeliveryPartner,
  reorderDeliveryPartners,
  resetDeliveryPartnersConfig,
  updateDeliveryPartnersConfig,
} from "@/modules/branding/delivery-partners-service";
import { validateLogoUpload, verifyImageMagicBytes } from "@/modules/branding/storage";
import type { PrismaClient } from "@prisma/client";

// Mock storage delete
vi.mock("@/modules/branding/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/branding/storage")>();
  return {
    ...actual,
    deleteLogoUpload: vi.fn().mockResolvedValue(undefined),
  };
});

describe("Delivery Partners Schemas & Validation", () => {
  it("validates a complete delivery partner item", () => {
    const item = {
      id: "dp-1",
      name: "Aramex",
      logoUrl: "/uploads/branding/delivery/aramex.png",
      displayOrder: 1,
      isActive: true,
      websiteUrl: "https://www.aramex.com",
      createdAt: "2026-11-07T12:00:00.000Z",
      updatedAt: "2026-11-07T12:00:00.000Z",
    };
    const parsed = deliveryPartnerItemSchema.parse(item);
    expect(parsed.name).toBe("Aramex");
    expect(parsed.displayOrder).toBe(1);
    expect(parsed.isActive).toBe(true);
    expect(parsed.logoUrl).toBe("/uploads/branding/delivery/aramex.png");
  });

  it("normalizes empty strings in logoUrl and websiteUrl to null", () => {
    const parsed = deliveryPartnerItemSchema.parse({
      id: "dp-2",
      name: "First Delivery",
      logoUrl: "",
      websiteUrl: "   ",
    });
    expect(parsed.logoUrl).toBeNull();
    expect(parsed.websiteUrl).toBeNull();
    expect(parsed.isActive).toBe(true);
    expect(parsed.displayOrder).toBe(0);
  });

  it("rejects an empty delivery partner name", () => {
    expect(() =>
      addDeliveryPartnerSchema.parse({
        name: "   ",
      })
    ).toThrow();
  });

  it("rejects negative displayOrder", () => {
    expect(() =>
      addDeliveryPartnerSchema.parse({
        name: "Livo",
        displayOrder: -2,
      })
    ).toThrow();
  });

  it("validates default section configuration", () => {
    const parsed = deliveryPartnersConfigSchema.parse(DEFAULT_DELIVERY_PARTNERS_CONFIG);
    expect(parsed.enabled).toBe(true);
    expect(parsed.title.fr).toBe("Nos partenaires de livraison");
    expect(parsed.title.ar).toBe("شركاؤنا في التوصيل");
    expect(parsed.title.en).toBe("Our Delivery Partners");
    expect(parsed.partners).toHaveLength(0);
  });
});

describe("Delivery Partners Service Layer", () => {
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
        create: vi.fn().mockResolvedValue({ id: "audit-dp-1" }),
      },
    };
  });

  it("returns default config when no DB row is present", async () => {
    mockPrisma.systemSetting.findUnique.mockResolvedValue(null);

    const config = await getDeliveryPartnersConfig(mockPrisma as unknown as PrismaClient);
    expect(config).toEqual(DEFAULT_DELIVERY_PARTNERS_CONFIG);
    expect(mockPrisma.systemSetting.findUnique).toHaveBeenCalledWith({
      where: { key: "branding.delivery_partners" },
      select: { value: true },
    });
  });

  it("returns only active partners sorted by displayOrder ASC", async () => {
    mockPrisma.systemSetting.findUnique.mockResolvedValue({
      value: {
        enabled: true,
        title: DEFAULT_DELIVERY_PARTNERS_CONFIG.title,
        subtitle: DEFAULT_DELIVERY_PARTNERS_CONFIG.subtitle,
        partners: [
          {
            id: "p3",
            name: "Z-Express",
            logoUrl: null,
            displayOrder: 3,
            isActive: true,
          },
          {
            id: "p2",
            name: "Hidden Transport",
            logoUrl: null,
            displayOrder: 1,
            isActive: false, // inactive!
          },
          {
            id: "p1",
            name: "Alpha Delivery",
            logoUrl: null,
            displayOrder: 0,
            isActive: true,
          },
        ],
      },
    });

    const { partners } = await getActiveDeliveryPartners(mockPrisma as unknown as PrismaClient);
    expect(partners).toHaveLength(2);
    expect(partners[0].id).toBe("p1");
    expect(partners[1].id).toBe("p3");
  });

  it("returns empty active partners list when section is disabled", async () => {
    mockPrisma.systemSetting.findUnique.mockResolvedValue({
      value: {
        ...DEFAULT_DELIVERY_PARTNERS_CONFIG,
        enabled: false,
        partners: [
          {
            id: "p1",
            name: "Aramex",
            logoUrl: null,
            displayOrder: 0,
            isActive: true,
          },
        ],
      },
    });

    const { partners } = await getActiveDeliveryPartners(mockPrisma as unknown as PrismaClient);
    expect(partners).toHaveLength(0);
  });

  it("adds a new delivery partner and creates audit log", async () => {
    mockPrisma.systemSetting.findUnique.mockResolvedValue(null);
    mockPrisma.systemSetting.upsert.mockResolvedValue({});

    const partner = await addDeliveryPartner(
      {
        name: "First Delivery",
        displayOrder: 0,
        isActive: true,
        logoUrl: "/uploads/branding/delivery/first.png",
        websiteUrl: "https://firstdelivery.tn",
      },
      "admin-actor-1",
      mockPrisma as unknown as PrismaClient
    );

    expect(partner.name).toBe("First Delivery");
    expect(partner.isActive).toBe(true);
    expect(partner.id).toBeDefined();

    expect(mockPrisma.systemSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "branding.delivery_partners" },
      })
    );

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "DELIVERY_PARTNER_ADDED",
          actorId: "admin-actor-1",
          entityType: "DeliveryPartner",
        }),
      })
    );
  });

  it("updates an existing delivery partner name and active status", async () => {
    mockPrisma.systemSetting.findUnique.mockResolvedValue({
      value: {
        ...DEFAULT_DELIVERY_PARTNERS_CONFIG,
        partners: [
          {
            id: "p-edit",
            name: "Old Courier",
            displayOrder: 0,
            isActive: true,
            logoUrl: null,
            websiteUrl: null,
            createdAt: "2026-11-07T10:00:00Z",
            updatedAt: "2026-11-07T10:00:00Z",
          },
        ],
      },
    });
    mockPrisma.systemSetting.upsert.mockResolvedValue({});

    const updated = await updateDeliveryPartner(
      "p-edit",
      { name: "New Courier", isActive: false },
      "admin-actor-1",
      mockPrisma as unknown as PrismaClient
    );

    expect(updated.name).toBe("New Courier");
    expect(updated.isActive).toBe(false);

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "DELIVERY_PARTNER_UPDATED",
          entityId: "p-edit",
        }),
      })
    );
  });

  it("throws an error when updating a non-existent partner", async () => {
    mockPrisma.systemSetting.findUnique.mockResolvedValue(null);

    await expect(
      updateDeliveryPartner(
        "non-existent-id",
        { name: "Ghost" },
        "admin-actor-1",
        mockPrisma as unknown as PrismaClient
      )
    ).rejects.toThrow("introuvable");
  });

  it("deletes a delivery partner and records audit", async () => {
    mockPrisma.systemSetting.findUnique.mockResolvedValue({
      value: {
        ...DEFAULT_DELIVERY_PARTNERS_CONFIG,
        partners: [
          {
            id: "p-del",
            name: "To Delete",
            logoUrl: "/uploads/branding/delivery/old.png",
            displayOrder: 0,
            isActive: true,
          },
        ],
      },
    });
    mockPrisma.systemSetting.upsert.mockResolvedValue({});

    const res = await deleteDeliveryPartner(
      "p-del",
      "admin-actor-1",
      mockPrisma as unknown as PrismaClient
    );

    expect(res.success).toBe(true);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "DELIVERY_PARTNER_DELETED",
          entityId: "p-del",
        }),
      })
    );
  });

  it("reorders partners according to supplied IDs array", async () => {
    mockPrisma.systemSetting.findUnique.mockResolvedValue({
      value: {
        ...DEFAULT_DELIVERY_PARTNERS_CONFIG,
        partners: [
          { id: "a", name: "A", displayOrder: 0, isActive: true },
          { id: "b", name: "B", displayOrder: 1, isActive: true },
        ],
      },
    });
    mockPrisma.systemSetting.upsert.mockResolvedValue({});

    const reordered = await reorderDeliveryPartners(
      ["b", "a"],
      "admin-actor-1",
      mockPrisma as unknown as PrismaClient
    );

    expect(reordered[0].id).toBe("b");
    expect(reordered[0].displayOrder).toBe(0);
    expect(reordered[1].id).toBe("a");
    expect(reordered[1].displayOrder).toBe(1);
  });

  it("updates top-level section settings and titles", async () => {
    mockPrisma.systemSetting.findUnique.mockResolvedValue(null);
    mockPrisma.systemSetting.upsert.mockResolvedValue({});

    const config = await updateDeliveryPartnersConfig(
      {
        enabled: true,
        title: {
          fr: "Partenaires Officiels de Livraison",
        },
      },
      "admin-actor-1",
      mockPrisma as unknown as PrismaClient
    );

    expect(config.title.fr).toBe("Partenaires Officiels de Livraison");
    expect(config.title.ar).toBe(DEFAULT_DELIVERY_PARTNERS_CONFIG.title.ar);
  });
});

describe("Delivery Partner Storage & Magic Bytes", () => {
  it("validates png and jpeg magic bytes", () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const textBuffer = Buffer.from("not an image header at all!!");

    expect(verifyImageMagicBytes(pngBuffer)).toEqual({ ok: true, format: "png" });
    expect(verifyImageMagicBytes(jpegBuffer)).toEqual({ ok: true, format: "jpeg" });
    expect(verifyImageMagicBytes(textBuffer).ok).toBe(false);
  });

  it("validates file size and extensions for logo uploads", () => {
    const valid = validateLogoUpload({
      fileName: "carrier-logo.png",
      size: 150_000,
      mimeType: "image/png",
    });
    expect(valid.ok).toBe(true);

    const oversized = validateLogoUpload({
      fileName: "huge.jpg",
      size: 3 * 1024 * 1024, // 3MB exceeds 2MB
      mimeType: "image/jpeg",
    });
    expect(oversized.ok).toBe(false);

    const invalidExt = validateLogoUpload({
      fileName: "carrier.exe",
      size: 10_000,
      mimeType: "application/x-msdownload",
    });
    expect(invalidExt.ok).toBe(false);
  });
});
