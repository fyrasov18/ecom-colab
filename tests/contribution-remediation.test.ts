import { describe, expect, it, vi, beforeEach } from "vitest";
import Decimal from "decimal.js";
import {
  hasPermission,
  requirePermission,
  PermissionError,
  PERMISSIONS,
  type DbClient,
} from "@/lib/permissions";
import {
  updateSetting,
  SettingValidationError,
} from "@/modules/settings/service";
import { SETTING_KEYS } from "@/modules/settings/defaults";
import {
  resolveContributionRate,
  calculateOrderContribution,
  verifyConfirmationIntegrity,
  type FinancialSnapshot,
} from "@/modules/finance/contribution-engine";

// ── Mock Next.js Cache & Navigation ──
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error(`NEXT_REDIRECT: ${url}`);
    (err as unknown as { digest: string }).digest = `NEXT_REDIRECT;replace;${url}`;
    throw err;
  }),
}));

// ── Mock Products Service (stock alerts) ──
vi.mock("@/modules/products/service", () => ({
  alertIfLowStock: vi.fn().mockResolvedValue(false),
}));

// ── Mock Prisma for isolated unit testing ──
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (cb) => {
      const tx = {
        systemSetting: {
          findUnique: vi.fn(),
          upsert: vi.fn(),
        },
        auditLog: {
          create: vi.fn(),
        },
      };
      return cb(tx);
    }),
    systemSetting: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/modules/audit/service", () => ({
  recordAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";
import { auth } from "@/lib/auth";
import { changePartnerLevel } from "@/app/(admin)/parametres/performance-actions";
import { assignProduct } from "@/app/(admin)/partenaires/actions";
import { assignProductToPartner } from "@/modules/partners/service";
import {
  createOrder,
  OrderError,
  isSerializationError,
  MAX_ORDER_TRANSACTION_ATTEMPTS,
} from "@/modules/orders/create";
import { Prisma } from "@prisma/client";

type MockTxCallback = (tx: unknown) => Promise<unknown>;

function mockTransactionWith(tx: unknown) {
  vi.mocked(prisma.$transaction).mockImplementation((async (cb: unknown) => {
    return (cb as MockTxCallback)(tx);
  }) as never);
}

function sampleSnapshot(): FinancialSnapshot {
  return {
    version: 1,
    calculatedAt: "2026-11-06T15:00:00.000Z",
    unitSellingPrice: "44.000",
    quantity: 1,
    unitPurchaseCost: "20.000",
    unitPackagingCost: "1.000",
    orderDeliveryCost: "8.000",
    discount: "0.000",
    revenue: "44.000",
    netRevenue: "44.000",
    productCost: "20.000",
    packagingCost: "1.000",
    deliveryCost: "8.000",
    totalCosts: "29.000",
    contribution: "15.00",
    minContributionThreshold: "7.00",
    isEligible: true,
    ratePercentage: "60.00",
    commissionType: "PERCENTAGE",
    commissionSource: "PERFORMANCE_LEVEL",
    performanceLevelId: "lvl-1",
    performanceLevelName: "level 1",
    partnerEarning: "9.00",
    platformShare: "6.00",
  };
}

interface OrderMockOverrides {
  product?: Record<string, unknown>;
  partner?: Record<string, unknown>;
  partnerProduct?: Record<string, unknown>;
  performanceLevel?: { id: string; name: string; sharePercentage: number; isActive: boolean } | null;
  minContribution?: number;
  globalCommission?: { commissionType: string; commissionValue: number };
}

function createMockTxForOrder(overrides?: OrderMockOverrides) {
  const defaultProduct = {
    id: "prod-1",
    name: "Organisateur De Sacs à Main Suspendu",
    slug: "organisateur-sacs",
    sellingPrice: new Decimal(44.0),
    purchaseCost: new Decimal(20.0),
    packagingCost: new Decimal(1.0),
    deliveryCost: new Decimal(8.0),
    stockQuantity: 10,
    minStockAlert: 2,
    status: "ACTIVE",
    ...overrides?.product,
  };

  const defaultPartner = {
    id: "part-1",
    defaultCommissionType: null,
    defaultCommissionValue: null,
    ...overrides?.partner,
  };

  const defaultPartnerProduct = {
    id: "pp-1",
    partnerId: "part-1",
    productId: "prod-1",
    status: "ACTIVE",
    commissionType: null,
    commissionValue: null,
    product: defaultProduct,
    partner: defaultPartner,
    ...overrides?.partnerProduct,
  };

  const createdOrderRecord = vi.fn();

  const tx = {
    partnerProduct: {
      findUnique: vi.fn().mockResolvedValue(defaultPartnerProduct),
      upsert: vi.fn(),
    },
    partner: {
      findUnique: vi.fn().mockResolvedValue({
        id: "part-1",
        performanceLevel:
          overrides?.performanceLevel === undefined
            ? { id: "lvl-1", name: "level 1", sharePercentage: 60, isActive: true }
            : overrides.performanceLevel,
      }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "part-1",
        performanceLevelId: "lvl-old",
      }),
      update: vi.fn().mockResolvedValue({
        id: "part-1",
        performanceLevel: { id: "lvl-1", name: "level 1" },
      }),
    },
    performanceLevel: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "lvl-1",
        name: "level 1",
        sharePercentage: 60,
        isActive: true,
      }),
    },
    systemSetting: {
      findUnique: vi.fn().mockImplementation(async ({ where }: { where: { key: string } }) => {
        if (where.key === SETTING_KEYS.GLOBAL_COMMISSION) {
          return {
            value: overrides?.globalCommission ?? {
              commissionType: "PERCENTAGE",
              commissionValue: 30,
            },
          };
        }
        if (where.key === SETTING_KEYS.MIN_ORDER_CONTRIBUTION) {
          return { value: overrides?.minContribution ?? 7.0 };
        }
        return null;
      }),
      upsert: vi.fn(),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn().mockResolvedValue([{ nextval: BigInt(1001) }]),
    customer: {
      upsert: vi.fn().mockResolvedValue({ id: "cust-1" }),
    },
    order: {
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        createdOrderRecord(data);
        return { id: "ord-1", ...data };
      }),
    },
    product: {
      update: vi.fn().mockResolvedValue({
        id: "prod-1",
        stockQuantity: 9,
        minStockAlert: 2,
        name: "Organisateur",
      }),
    },
    orderStatusHistory: {
      create: vi.fn().mockResolvedValue({ id: "osh-1" }),
    },
    auditLog: {
      create: vi.fn(),
    },
  };

  return { tx, createdOrderRecord };
}

describe("P0 — Legacy Partner Data Normalization & Hierarchy Fallback", () => {
  it("normalized partner (null defaults) falls through to assigned performance level (Tier 3)", () => {
    const rate = resolveContributionRate({
      partnerProduct: null,
      partner: {
        commissionType: null,
        commissionValue: null,
      },
      performanceLevel: {
        id: "lvl-1",
        name: "level 1",
        sharePercentage: 30,
        isActive: true,
      },
      global: {
        commissionType: "PERCENTAGE",
        commissionValue: 30,
      },
    });

    expect(rate.source).toBe("PERFORMANCE_LEVEL");
    expect(rate.rate.toNumber()).toBe(30);
    expect(rate.performanceLevelName).toBe("level 1");
  });

  it("normalized partner (null defaults) without level falls through to global 30% (Tier 4)", () => {
    const rate = resolveContributionRate({
      partnerProduct: null,
      partner: {
        commissionType: null,
        commissionValue: null,
      },
      performanceLevel: null,
      global: {
        commissionType: "PERCENTAGE",
        commissionValue: 30,
      },
    });

    expect(rate.source).toBe("GLOBAL");
    expect(rate.rate.toNumber()).toBe(30);
  });

  it("preserves intentional admin overrides when present (e.g. explicit 50% or 60%)", () => {
    const rate = resolveContributionRate({
      partnerProduct: null,
      partner: {
        commissionType: "PERCENTAGE",
        commissionValue: new Decimal(50),
      },
      performanceLevel: {
        id: "lvl-1",
        name: "level 1",
        sharePercentage: 30,
        isActive: true,
      },
      global: {
        commissionType: "PERCENTAGE",
        commissionValue: 30,
      },
    });

    expect(rate.source).toBe("PARTNER");
    expect(rate.rate.toNumber()).toBe(50);
  });
});

describe("P1 — Mandatory Audit Reason & No-Op Preservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing reason when value actually changes", async () => {
    const mockTx = {
      systemSetting: {
        findUnique: vi.fn().mockResolvedValue({ value: 7.0 }),
        upsert: vi.fn(),
      },
    };
    mockTransactionWith(mockTx);

    await expect(
      updateSetting({
        key: SETTING_KEYS.MIN_ORDER_CONTRIBUTION,
        value: 8.5,
        actorId: "admin-1",
        reason: undefined,
      }),
    ).rejects.toThrow(SettingValidationError);
  });

  it("rejects empty or whitespace-only reason when value changes", async () => {
    const mockTx = {
      systemSetting: {
        findUnique: vi.fn().mockResolvedValue({ value: 7.0 }),
        upsert: vi.fn(),
      },
    };
    mockTransactionWith(mockTx);

    await expect(
      updateSetting({
        key: SETTING_KEYS.MIN_ORDER_CONTRIBUTION,
        value: 8.5,
        actorId: "admin-1",
        reason: "   ",
      }),
    ).rejects.toThrow(SettingValidationError);
  });

  it("rejects reasons with less than 5 meaningful characters", async () => {
    const mockTx = {
      systemSetting: {
        findUnique: vi.fn().mockResolvedValue({ value: 7.0 }),
        upsert: vi.fn(),
      },
    };
    mockTransactionWith(mockTx);

    await expect(
      updateSetting({
        key: SETTING_KEYS.MIN_ORDER_CONTRIBUTION,
        value: 8.5,
        actorId: "admin-1",
        reason: " maj ", // 3 characters after trim
      }),
    ).rejects.toThrow(SettingValidationError);
  });

  it("preserves No-Op behavior: unchanged value requires no reason and writes nothing", async () => {
    const mockTx = {
      systemSetting: {
        findUnique: vi.fn().mockResolvedValue({ value: 7.0 }),
        upsert: vi.fn(),
      },
    };
    mockTransactionWith(mockTx);

    const changed = await updateSetting({
      key: SETTING_KEYS.MIN_ORDER_CONTRIBUTION,
      value: 7.0,
      actorId: "admin-1",
      reason: "",
    });

    expect(changed).toBe(false);
    expect(mockTx.systemSetting.upsert).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("accepts valid reason (>= 5 chars) and commits update and audit log atomically", async () => {
    const mockTx = {
      systemSetting: {
        findUnique: vi.fn().mockResolvedValue({ value: 7.0 }),
        upsert: vi.fn().mockResolvedValue({ value: 9.0 }),
      },
    };
    mockTransactionWith(mockTx);

    const changed = await updateSetting({
      key: SETTING_KEYS.MIN_ORDER_CONTRIBUTION,
      value: 9.0,
      actorId: "admin-1",
      reason: "  Revue stratégique Q4  ",
    });

    expect(changed).toBe(true);
    expect(mockTx.systemSetting.upsert).toHaveBeenCalled();
    expect(recordAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        actorId: "admin-1",
        action: "SETTING_UPDATED",
        entityId: SETTING_KEYS.MIN_ORDER_CONTRIBUTION,
        after: { value: 9.0, reason: "Revue stratégique Q4" },
      }),
    );
  });
});

describe("P2 — Dedicated Permission: MANAGE_CONTRIBUTION_SETTINGS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("SUPER_ADMIN has MANAGE_CONTRIBUTION_SETTINGS by default", async () => {
    const superAdmin = { id: "user-super", role: "SUPER_ADMIN" as const };
    const allowed = await hasPermission(superAdmin, PERMISSIONS.MANAGE_CONTRIBUTION_SETTINGS);
    expect(allowed).toBe(true);
  });

  it("regular ADMIN does not have MANAGE_CONTRIBUTION_SETTINGS by default (read-only)", async () => {
    const regularAdmin = { id: "user-admin", role: "ADMIN" as const };
    const allowed = await hasPermission(regularAdmin, PERMISSIONS.MANAGE_CONTRIBUTION_SETTINGS);
    expect(allowed).toBe(false);
  });

  it("PARTNER never has MANAGE_CONTRIBUTION_SETTINGS", async () => {
    const partner = { id: "user-partner", role: "PARTNER" as const };
    const allowed = await hasPermission(partner, PERMISSIONS.MANAGE_CONTRIBUTION_SETTINGS);
    expect(allowed).toBe(false);
  });

  it("ADMIN with explicit persistent grant receives MANAGE_CONTRIBUTION_SETTINGS", async () => {
    const delegatedAdmin = { id: "user-delegated", role: "ADMIN" as const };
    const mockDb = {
      systemSetting: {
        findUnique: vi.fn().mockResolvedValue({
          key: SETTING_KEYS.ADMIN_PERMISSION_GRANTS,
          value: {
            "user-delegated": [PERMISSIONS.MANAGE_CONTRIBUTION_SETTINGS],
          },
        }),
      },
    } as unknown as DbClient;

    const allowed = await hasPermission(
      delegatedAdmin,
      PERMISSIONS.MANAGE_CONTRIBUTION_SETTINGS,
      mockDb,
    );
    expect(allowed).toBe(true);
  });

  it("requirePermission allows authorized users and throws PermissionError for unauthorized", async () => {
    // 1. Authorized SUPER_ADMIN
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "sa-1", role: "SUPER_ADMIN", email: "sa@test.local", firstName: "Super", lastName: "Admin" },
    } as unknown as Awaited<ReturnType<typeof auth>>);

    const user = await requirePermission(PERMISSIONS.MANAGE_CONTRIBUTION_SETTINGS);
    expect(user.id).toBe("sa-1");

    // 2. Unauthorized ADMIN
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "ad-1", role: "ADMIN", email: "ad@test.local", firstName: "Regular", lastName: "Admin" },
    } as unknown as Awaited<ReturnType<typeof auth>>);

    await expect(
      requirePermission(PERMISSIONS.MANAGE_CONTRIBUTION_SETTINGS),
    ).rejects.toThrow(PermissionError);
  });
});

describe("P0 — Performance Level Assignment Authorization (changePartnerLevel)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("SUPER_ADMIN with permission can assign a performance level", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "sa-1", role: "SUPER_ADMIN", email: "sa@test.local", firstName: "Super", lastName: "Admin" },
    } as never);

    const mockTx = {
      partner: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "part-1", performanceLevelId: null }),
        update: vi.fn().mockResolvedValue({ id: "part-1", performanceLevel: { name: "level 1" } }),
      },
      performanceLevel: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "lvl-1", isActive: true }),
      },
    };
    mockTransactionWith(mockTx);

    const formData = new FormData();
    formData.append("partnerId", "part-1");
    formData.append("performanceLevelId", "lvl-1");

    await changePartnerLevel(formData);

    expect(mockTx.partner.update).toHaveBeenCalledWith({
      where: { id: "part-1" },
      data: { performanceLevelId: "lvl-1" },
      include: { performanceLevel: true },
    });
    expect(recordAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        actorId: "sa-1",
        action: "PARTNER_LEVEL_CHANGED",
        entityId: "part-1",
      }),
    );
  });

  it("regular ADMIN without permission is rejected with PermissionError (zero mutations)", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "ad-1", role: "ADMIN", email: "ad@test.local", firstName: "Regular", lastName: "Admin" },
    } as never);
    vi.mocked(prisma.systemSetting.findUnique).mockResolvedValueOnce(null);

    const mockTx = {
      partner: { update: vi.fn() },
    };
    mockTransactionWith(mockTx);

    const formData = new FormData();
    formData.append("partnerId", "part-1");
    formData.append("performanceLevelId", "lvl-1");

    await expect(changePartnerLevel(formData)).rejects.toThrow(PermissionError);
    expect(mockTx.partner.update).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("ADMIN with explicitly granted MANAGE_CONTRIBUTION_SETTINGS is accepted", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "ad-del", role: "ADMIN", email: "del@test.local", firstName: "Del", lastName: "Admin" },
    } as never);
    vi.mocked(prisma.systemSetting.findUnique).mockResolvedValueOnce({
      key: SETTING_KEYS.ADMIN_PERMISSION_GRANTS,
      value: { "ad-del": [PERMISSIONS.MANAGE_CONTRIBUTION_SETTINGS] },
    } as never);

    const mockTx = {
      partner: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "part-1", performanceLevelId: null }),
        update: vi.fn().mockResolvedValue({ id: "part-1", performanceLevel: { name: "level 1" } }),
      },
      performanceLevel: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "lvl-1", isActive: true }),
      },
    };
    mockTransactionWith(mockTx);

    const formData = new FormData();
    formData.append("partnerId", "part-1");
    formData.append("performanceLevelId", "lvl-1");

    await changePartnerLevel(formData);
    expect(mockTx.partner.update).toHaveBeenCalled();
  });

  it("PARTNER role is rejected with PermissionError", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "p-1", role: "PARTNER", email: "p@test.local", firstName: "Partner", lastName: "User" },
    } as never);

    const formData = new FormData();
    formData.append("partnerId", "part-1");
    formData.append("performanceLevelId", "lvl-1");

    await expect(changePartnerLevel(formData)).rejects.toThrow(PermissionError);
  });
});

describe("P1 — Partner + Product Commission Override Authorization (assignProduct)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("SUPER_ADMIN can configure a custom commission override", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "sa-1", role: "SUPER_ADMIN", email: "sa@test.local", firstName: "Super", lastName: "Admin" },
    } as never);

    const mockTx = {
      partnerProduct: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: "pp-1" }),
      },
    };
    mockTransactionWith(mockTx);

    const formData = new FormData();
    formData.append("partnerId", "part-1");
    formData.append("productId", "prod-1");
    formData.append("commissionType", "PERCENTAGE");
    formData.append("commissionValue", "45");

    const res = await assignProduct({ ok: true }, formData);

    expect(res).toEqual({ ok: true, message: "Produit assigné." });
    expect(mockTx.partnerProduct.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          commissionType: "PERCENTAGE",
          commissionValue: "45",
        }),
      }),
    );
  });

  it("regular ADMIN attempting commission override is rejected with error (no mutations)", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "ad-1", role: "ADMIN", email: "ad@test.local", firstName: "Regular", lastName: "Admin" },
    } as never);
    vi.mocked(prisma.systemSetting.findUnique).mockResolvedValueOnce(null);

    const mockTx = {
      partnerProduct: { upsert: vi.fn() },
    };
    mockTransactionWith(mockTx);

    const formData = new FormData();
    formData.append("partnerId", "part-1");
    formData.append("productId", "prod-1");
    formData.append("commissionType", "PERCENTAGE");
    formData.append("commissionValue", "45");

    const res = await assignProduct({ ok: true }, formData);

    expect(res.ok).toBe(false);
    expect(res.error).toContain("MANAGE_CONTRIBUTION_SETTINGS");
    expect(mockTx.partnerProduct.upsert).not.toHaveBeenCalled();
  });

  it("regular ADMIN can assign product without commission override", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "ad-1", role: "ADMIN", email: "ad@test.local", firstName: "Regular", lastName: "Admin" },
    } as never);
    vi.mocked(prisma.systemSetting.findUnique).mockResolvedValueOnce(null);

    const mockTx = {
      partnerProduct: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: "pp-1" }),
      },
    };
    mockTransactionWith(mockTx);

    const formData = new FormData();
    formData.append("partnerId", "part-1");
    formData.append("productId", "prod-1");
    formData.append("commissionType", "");
    formData.append("commissionValue", "");

    const res = await assignProduct({ ok: true }, formData);

    expect(res).toEqual({ ok: true, message: "Produit assigné." });
    expect(mockTx.partnerProduct.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          commissionType: null,
          commissionValue: null,
        }),
      }),
    );
  });

  it("assignProductToPartner preserves existing custom commission when allowCommission is false", async () => {
    const existingAssignment = {
      id: "pp-1",
      partnerId: "part-1",
      productId: "prod-1",
      status: "ACTIVE",
      commissionType: "PERCENTAGE",
      commissionValue: 55,
    };

    const mockTx = {
      partnerProduct: {
        findUnique: vi.fn().mockResolvedValue(existingAssignment),
        upsert: vi.fn().mockImplementation(({ update }: { update: Record<string, unknown> }) => ({
          id: "pp-1",
          ...update,
        })),
      },
    };
    mockTransactionWith(mockTx);

    await assignProductToPartner(
      {
        partnerId: "part-1",
        productId: "prod-1",
        commissionType: null,
        commissionValue: null,
      },
      "admin-1",
      { allowCommission: false },
    );

    expect(mockTx.partnerProduct.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          commissionType: "PERCENTAGE",
          commissionValue: "55",
        }),
      }),
    );
  });
});

describe("P1 — Initial Snapshot Trust Boundary & Adversarial Integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifyConfirmationIntegrity flags tampered partnerEarning", () => {
    const base = sampleSnapshot();
    const tampered = { ...base, partnerEarning: "15.00" };
    const result = verifyConfirmationIntegrity(tampered, base);
    expect(result.isIdentical).toBe(false);
    expect(result.differences.some((d) => d.includes("partnerEarning"))).toBe(true);
  });

  it("verifyConfirmationIntegrity flags tampered contribution", () => {
    const base = sampleSnapshot();
    const tampered = { ...base, contribution: "25.00" };
    const result = verifyConfirmationIntegrity(tampered, base);
    expect(result.isIdentical).toBe(false);
    expect(result.differences.some((d) => d.includes("contribution"))).toBe(true);
  });

  it("verifyConfirmationIntegrity flags tampered unitSellingPrice", () => {
    const base = sampleSnapshot();
    const tampered = { ...base, unitSellingPrice: "50.000" };
    const result = verifyConfirmationIntegrity(tampered, base);
    expect(result.isIdentical).toBe(false);
    expect(result.differences.some((d) => d.includes("unitSellingPrice"))).toBe(true);
  });

  it("verifyConfirmationIntegrity flags tampered deliveryCost", () => {
    const base = sampleSnapshot();
    const tampered = { ...base, deliveryCost: "4.000" };
    const result = verifyConfirmationIntegrity(tampered, base);
    expect(result.isIdentical).toBe(false);
    expect(result.differences.some((d) => d.includes("deliveryCost"))).toBe(true);
  });

  it("verifyConfirmationIntegrity flags tampered totalCosts", () => {
    const base = sampleSnapshot();
    const tampered = { ...base, totalCosts: "10.000" };
    const result = verifyConfirmationIntegrity(tampered, base);
    expect(result.isIdentical).toBe(false);
    expect(result.differences.some((d) => d.includes("totalCosts"))).toBe(true);
  });

  it("verifyConfirmationIntegrity flags tampered isEligible flag", () => {
    const base = sampleSnapshot();
    const tampered = { ...base, isEligible: false };
    const result = verifyConfirmationIntegrity(tampered, base);
    expect(result.isIdentical).toBe(false);
    expect(result.differences.some((d) => d.includes("isEligible"))).toBe(true);
  });

  it("verifyConfirmationIntegrity accepts completely identical snapshots (genuine unchanged snapshot)", () => {
    const base = sampleSnapshot();
    const result = verifyConfirmationIntegrity(base, base);
    expect(result.isIdentical).toBe(true);
    expect(result.differences).toHaveLength(0);
  });

  it("verifyConfirmationIntegrity flags same percentage with different Performance Level ID", () => {
    const base = sampleSnapshot();
    // Both levels have sharePercentage 60%, but level ID was changed
    const tampered = { ...base, performanceLevelId: "lvl-diff" };
    const result = verifyConfirmationIntegrity(tampered, base);
    expect(result.isIdentical).toBe(false);
    expect(result.differences.some((d) => d.includes("performanceLevelId"))).toBe(true);
  });

  it("verifyConfirmationIntegrity flags same percentage with renamed Performance Level", () => {
    const base = sampleSnapshot();
    // Same percentage (60%), but level name changed in database from "level 1" to "level 1 VIP"
    const tampered = { ...base, performanceLevelName: "level 1 VIP" };
    const result = verifyConfirmationIntegrity(tampered, base);
    expect(result.isIdentical).toBe(false);
    expect(result.differences.some((d) => d.includes("performanceLevelName"))).toBe(true);
  });

  it("verifyConfirmationIntegrity accepts when both performance level values are null (no level assigned)", () => {
    const base = sampleSnapshot();
    const noLevelPreview: FinancialSnapshot = {
      ...base,
      performanceLevelId: null,
      performanceLevelName: null,
      commissionSource: "GLOBAL",
      ratePercentage: "30.00",
    };
    const noLevelCurrent: FinancialSnapshot = {
      ...noLevelPreview,
    };
    const result = verifyConfirmationIntegrity(noLevelPreview, noLevelCurrent);
    expect(result.isIdentical).toBe(true);
    expect(result.differences).toHaveLength(0);
  });

  it("verifyConfirmationIntegrity flags when partner was assigned a performance level after preview was captured without one", () => {
    const base = sampleSnapshot();
    const previewWithoutLevel: FinancialSnapshot = {
      ...base,
      performanceLevelId: null,
      performanceLevelName: null,
      commissionSource: "GLOBAL",
    };
    const currentWithLevel: FinancialSnapshot = {
      ...base,
      performanceLevelId: "lvl-1",
      performanceLevelName: "level 1",
      commissionSource: "PERFORMANCE_LEVEL",
    };
    const result = verifyConfirmationIntegrity(previewWithoutLevel, currentWithLevel);
    expect(result.isIdentical).toBe(false);
    expect(result.differences.some((d) => d.includes("performanceLevelId"))).toBe(true);
    expect(result.differences.some((d) => d.includes("performanceLevelName"))).toBe(true);
  });

  it("rejects order creation when client tampers with previewSnapshot partnerEarning", async () => {
    const { tx } = createMockTxForOrder();
    mockTransactionWith(tx);

    const legitCalculation = calculateOrderContribution({
      sellingPrice: 44,
      quantity: 1,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 8,
      discount: 0,
      minContributionThreshold: 7,
      rateRule: {
        type: "PERCENTAGE",
        rate: new Decimal(60),
        source: "PERFORMANCE_LEVEL",
        performanceLevelId: "lvl-1",
        performanceLevelName: "level 1",
      },
    });

    const tamperedSnapshot = {
      ...legitCalculation.snapshot,
      partnerEarning: "14.00", // Malicious client claims 14 DT instead of 9 DT!
    };

    await expect(
      createOrder(
        {
          productId: "prod-1",
          quantity: 1,
          customerFullName: "Ahmed Ben Ali",
          phone: "98123456",
          governorate: "Tunis",
          city: "Tunis",
          address: "Rue Habib Bourguiba",
          confirmed: "on",
          previewSnapshot: JSON.stringify(tamperedSnapshot),
        },
        { partnerId: "part-1", actorId: "part-1" },
      ),
    ).rejects.toThrow("Les conditions financières ont changé depuis votre aperçu");
  });

  it("rejects order creation when client provides malformed JSON string preview", async () => {
    const { tx } = createMockTxForOrder();
    mockTransactionWith(tx);

    await expect(
      createOrder(
        {
          productId: "prod-1",
          quantity: 1,
          customerFullName: "Ahmed Ben Ali",
          phone: "98123456",
          governorate: "Tunis",
          city: "Tunis",
          address: "Rue Habib Bourguiba",
          confirmed: "on",
          previewSnapshot: "{ not: valid: json! }",
        },
        { partnerId: "part-1", actorId: "part-1" },
      ),
    ).rejects.toThrow("Aperçu financier invalide");
  });

  it("rejects order creation when client provides non-object JSON preview", async () => {
    const { tx } = createMockTxForOrder();
    mockTransactionWith(tx);

    await expect(
      createOrder(
        {
          productId: "prod-1",
          quantity: 1,
          customerFullName: "Ahmed Ben Ali",
          phone: "98123456",
          governorate: "Tunis",
          city: "Tunis",
          address: "Rue Habib Bourguiba",
          confirmed: "on",
          previewSnapshot: "12345",
        },
        { partnerId: "part-1", actorId: "part-1" },
      ),
    ).rejects.toThrow("Aperçu financier invalide");
  });

  it("rejects order creation when product purchase cost changes in DB after client preview", async () => {
    // Preview captured when purchase cost was 20 DT (Contribution 15 DT)
    const oldCalculation = calculateOrderContribution({
      sellingPrice: 44,
      quantity: 1,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 8,
      discount: 0,
      minContributionThreshold: 7,
      rateRule: {
        type: "PERCENTAGE",
        rate: new Decimal(60),
        source: "PERFORMANCE_LEVEL",
        performanceLevelId: "lvl-1",
        performanceLevelName: "level 1",
      },
    });

    // Database product was updated to purchaseCost 25 DT (Contribution 10 DT)
    const { tx } = createMockTxForOrder({
      product: { purchaseCost: new Decimal(25.0) },
    });
    mockTransactionWith(tx);

    await expect(
      createOrder(
        {
          productId: "prod-1",
          quantity: 1,
          customerFullName: "Ahmed Ben Ali",
          phone: "98123456",
          governorate: "Tunis",
          city: "Tunis",
          address: "Rue Habib Bourguiba",
          confirmed: "on",
          previewSnapshot: JSON.stringify(oldCalculation.snapshot),
        },
        { partnerId: "part-1", actorId: "part-1" },
      ),
    ).rejects.toThrow("Les conditions financières ont changé depuis votre aperçu");
  });

  it("persists exact server-calculated canonical values to the Order record (trust boundary sealed)", async () => {
    const { tx, createdOrderRecord } = createMockTxForOrder();
    mockTransactionWith(tx);

    const legitCalculation = calculateOrderContribution({
      sellingPrice: 44,
      quantity: 1,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 8,
      discount: 0,
      minContributionThreshold: 7,
      rateRule: {
        type: "PERCENTAGE",
        rate: new Decimal(60),
        source: "PERFORMANCE_LEVEL",
        performanceLevelId: "lvl-1",
        performanceLevelName: "level 1",
      },
    });

    await createOrder(
      {
        productId: "prod-1",
        quantity: 1,
        customerFullName: "Ahmed Ben Ali",
        phone: "98123456",
        governorate: "Tunis",
        city: "Tunis",
        address: "Rue Habib Bourguiba",
        confirmed: "on",
        previewSnapshot: JSON.stringify(legitCalculation.snapshot),
      },
      { partnerId: "part-1", actorId: "part-1" },
    );

    expect(createdOrderRecord).toHaveBeenCalled();
    const persisted = createdOrderRecord.mock.calls[0][0];
    expect(persisted.unitSellingPrice).toBe("44.000");
    expect(persisted.productCost).toBe("20.000");
    expect(persisted.packagingCost).toBe("1.000");
    expect(persisted.deliveryCost).toBe("8.000");
    expect(persisted.contribution).toBe("15.00");
    expect(persisted.partnerEarning).toBe("9.00");
    expect(persisted.platformShare).toBe("6.00");
    expect(persisted.commissionSource).toBe("PERFORMANCE_LEVEL");
    expect(persisted.performanceLevelName).toBe("level 1");
    expect(persisted.partnerSharePercentage).toBe("60.00");
    expect(persisted.status).toBe("CONFIRMED");
  });
});

describe("P0 — Transaction Isolation & Concurrency Retries (createOrder)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("isSerializationError recognizes all database concurrency conflict signatures", () => {
    // 1. Prisma P2034 error code
    const p2034Prisma = new Prisma.PrismaClientKnownRequestError(
      "Transaction failed due to a write conflict or a deadlock. Please retry your transaction",
      { code: "P2034", clientVersion: "6.19.3" },
    );
    expect(isSerializationError(p2034Prisma)).toBe(true);

    // 2. Object with code P2034
    expect(isSerializationError({ code: "P2034", message: "conflict" })).toBe(true);

    // 3. PostgreSQL SQLSTATE 40001 (serialization_failure)
    expect(isSerializationError(new Error("ERROR: 40001: could not serialize access due to read/write dependencies"))).toBe(true);

    // 4. PostgreSQL deadlock detected
    expect(isSerializationError(new Error("deadlock detected: Process 12345 waits for ShareLock"))).toBe(true);

    // 5. Normal non-serialization errors return false
    expect(isSerializationError(new Error("Stock insuffisant"))).toBe(false);
    expect(isSerializationError(new OrderError("Produit non disponible"))).toBe(false);
  });

  it("retries transaction on serialization conflict (P2034) with Serializable isolation and succeeds on attempt 2", async () => {
    const { tx, createdOrderRecord } = createMockTxForOrder();

    let attempts = 0;
    const passedOptions: unknown[] = [];

    vi.mocked(prisma.$transaction).mockImplementation((async (cb: (tx: unknown) => Promise<unknown>, opts?: unknown) => {
      attempts++;
      passedOptions.push(opts);
      if (attempts === 1) {
        // First attempt collides
        throw new Prisma.PrismaClientKnownRequestError(
          "Transaction write conflict",
          { code: "P2034", clientVersion: "6.19.3" },
        );
      }
      return cb(tx);
    }) as never);

    const result = await createOrder(
      {
        productId: "prod-1",
        quantity: 1,
        customerFullName: "Ahmed Ben Ali",
        phone: "98123456",
        governorate: "Tunis",
        city: "Tunis",
        address: "Rue Habib Bourguiba",
        confirmed: "on",
      },
      { partnerId: "part-1", actorId: "part-1" },
    );

    expect(attempts).toBe(2);
    expect(passedOptions[0]).toEqual(
      expect.objectContaining({
        isolationLevel: "Serializable",
      }),
    );
    expect(passedOptions[1]).toEqual(
      expect.objectContaining({
        isolationLevel: "Serializable",
      }),
    );
    expect(result.id).toBe("ord-1");
    expect(createdOrderRecord).toHaveBeenCalledTimes(1);
  });

  it("aborts immediately without retry on business OrderError (e.g. insufficient stock)", async () => {
    const { tx } = createMockTxForOrder({
      product: { stockQuantity: 0 }, // Out of stock!
    });

    let attempts = 0;
    vi.mocked(prisma.$transaction).mockImplementation((async (cb: (tx: unknown) => Promise<unknown>) => {
      attempts++;
      return cb(tx);
    }) as never);

    await expect(
      createOrder(
        {
          productId: "prod-1",
          quantity: 1,
          customerFullName: "Ahmed Ben Ali",
          phone: "98123456",
          governorate: "Tunis",
          city: "Tunis",
          address: "Rue Habib Bourguiba",
          confirmed: "on",
        },
        { partnerId: "part-1", actorId: "part-1" },
      ),
    ).rejects.toThrow("Stock insuffisant");

    expect(attempts).toBe(1); // Never retried!
  });

  it("exhausts maximum of 3 attempts when serialization conflict persists", async () => {
    let attempts = 0;
    vi.mocked(prisma.$transaction).mockImplementation((async () => {
      attempts++;
      throw new Prisma.PrismaClientKnownRequestError(
        "Continuous serialization collision",
        { code: "P2034", clientVersion: "6.19.3" },
      );
    }) as never);

    await expect(
      createOrder(
        {
          productId: "prod-1",
          quantity: 1,
          customerFullName: "Ahmed Ben Ali",
          phone: "98123456",
          governorate: "Tunis",
          city: "Tunis",
          address: "Rue Habib Bourguiba",
          confirmed: "on",
        },
        { partnerId: "part-1", actorId: "part-1" },
      ),
    ).rejects.toThrow("Continuous serialization collision");

    expect(attempts).toBe(MAX_ORDER_TRANSACTION_ATTEMPTS); // Exactly 3 attempts!
  });

  it("re-reads fresh financial parameters and revalidates preview on retry attempt", async () => {
    const legitCalculation = calculateOrderContribution({
      sellingPrice: 44,
      quantity: 1,
      purchaseCost: 20,
      packagingCost: 1,
      deliveryCost: 8,
      discount: 0,
      minContributionThreshold: 7,
      rateRule: {
        type: "PERCENTAGE",
        rate: new Decimal(60),
        source: "PERFORMANCE_LEVEL",
        performanceLevelId: "lvl-1",
        performanceLevelName: "level 1",
      },
    });

    let attempts = 0;
    vi.mocked(prisma.$transaction).mockImplementation((async (cb: (tx: unknown) => Promise<unknown>) => {
      attempts++;
      if (attempts === 1) {
        // Collision occurs on first attempt
        throw new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "6.19.3" });
      }
      // Attempt 2: an admin concurrently updated the product sellingPrice from 44 to 50 DT
      const { tx } = createMockTxForOrder({
        product: { sellingPrice: new Decimal(50.0) },
      });
      return cb(tx);
    }) as never);

    await expect(
      createOrder(
        {
          productId: "prod-1",
          quantity: 1,
          customerFullName: "Ahmed Ben Ali",
          phone: "98123456",
          governorate: "Tunis",
          city: "Tunis",
          address: "Rue Habib Bourguiba",
          confirmed: "on",
          previewSnapshot: JSON.stringify(legitCalculation.snapshot),
        },
        { partnerId: "part-1", actorId: "part-1" },
      ),
    ).rejects.toThrow("Les conditions financières ont changé depuis votre aperçu");

    expect(attempts).toBe(2); // Attempt 1 collided, Attempt 2 caught changed price and aborted cleanly
  });
});
