import { describe, it, expect, vi, beforeEach } from "vitest";
import Decimal from "decimal.js";
import { calculateMinimumSellingPrice, calculateOrderContribution } from "@/modules/finance/contribution-engine";
import { createOrderSchema } from "@/modules/orders/schemas";
import { createOrder } from "@/modules/orders/create";
import { prisma } from "@/lib/prisma";
import { SETTING_KEYS } from "@/modules/settings/defaults";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/modules/audit/service", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/products/service", () => ({
  alertIfLowStock: vi.fn().mockResolvedValue(undefined),
}));

type MockTxCallback = (tx: unknown) => Promise<unknown>;

function createMockEnv(overrides?: {
  sellingPrice?: number;
  purchaseCost?: number;
  packagingCost?: number;
  deliveryCost?: number;
  minContribution?: number;
}) {
  const product = {
    id: "prod-1",
    name: "Produit Test",
    slug: "produit-test",
    sellingPrice: new Decimal(overrides?.sellingPrice ?? 44.0),
    purchaseCost: new Decimal(overrides?.purchaseCost ?? 20.0),
    packagingCost: new Decimal(overrides?.packagingCost ?? 1.0),
    deliveryCost: new Decimal(overrides?.deliveryCost ?? 8.0),
    stockQuantity: 20,
    minStockAlert: 2,
    status: "ACTIVE",
  };

  const partner = {
    id: "part-1",
    displayName: "Partenaire Test",
    defaultCommissionType: null,
    defaultCommissionValue: null,
    performanceLevel: { id: "lvl-1", name: "level 1", sharePercentage: 50, isActive: true },
  };

  const partnerProduct = {
    id: "pp-1",
    partnerId: "part-1",
    productId: "prod-1",
    status: "ACTIVE",
    commissionType: null,
    commissionValue: null,
    product,
    partner,
  };

  let orderRecord: Record<string, unknown> = {};

  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(0),
    $queryRaw: vi.fn().mockResolvedValue([{ nextval: BigInt(1001) }]),
    partnerProduct: {
      findUnique: vi.fn().mockResolvedValue(partnerProduct),
    },
    partner: {
      findUnique: vi.fn().mockResolvedValue(partner),
    },
    performanceLevel: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(partner.performanceLevel),
    },
    systemSetting: {
      findUnique: vi.fn().mockImplementation(async ({ where }: { where: { key: string } }) => {
        if (where.key === SETTING_KEYS.GLOBAL_COMMISSION) {
          return { value: { commissionType: "PERCENTAGE", commissionValue: 30 } };
        }
        if (where.key === SETTING_KEYS.MIN_ORDER_CONTRIBUTION) {
          return { value: overrides?.minContribution ?? 7.0 };
        }
        return null;
      }),
    },
    product: {
      update: vi.fn().mockResolvedValue(product),
    },
    customer: {
      upsert: vi.fn().mockResolvedValue({ id: "cust-1" }),
    },
    order: {
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        orderRecord = { id: "ord-test", orderNumber: 1001, ...data };
        return orderRecord;
      }),
    },
    orderStatusHistory: {
      create: vi.fn().mockResolvedValue({}),
    },
    financialTransaction: {
      create: vi.fn().mockResolvedValue({}),
    },
  };

  return { tx, getOrder: () => orderRecord };
}

describe("Custom Selling Price with Minimum Contribution Constraint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. calculateMinimumSellingPrice mathematical formula", () => {
    it("calculates ceiling price to ensure Contribution > minContributionThreshold strictly", () => {
      // Q = 1, Purchase = 20, Packaging = 1, Delivery = 8
      // Total Costs = 29 DT. Min threshold = 7 DT.
      // Net Revenue must be >= 29 + 7 + 0.01 = 36.010 DT.
      // Min selling price = 36.010 DT
      const minPrice = calculateMinimumSellingPrice({
        quantity: 1,
        purchaseCost: 20,
        packagingCost: 1,
        deliveryCost: 8,
        minContributionThreshold: 7,
      });

      expect(minPrice.toString()).toBe("36.01");

      // Verify contribution at minPrice:
      // Revenue = 36.01, Costs = 29, Contribution = 7.01 > 7.00 -> Eligible!
      const calcEligible = calculateOrderContribution({
        sellingPrice: minPrice,
        quantity: 1,
        purchaseCost: 20,
        packagingCost: 1,
        deliveryCost: 8,
        minContributionThreshold: 7,
        rateRule: {
          type: "PERCENTAGE",
          rate: new Decimal(50),
          source: "GLOBAL",
          performanceLevelId: null,
          performanceLevelName: null,
        },
      });
      expect(calcEligible.isEligible).toBe(true);

      // Selling 1 millime below (36.000 DT):
      // Revenue = 36.00, Costs = 29, Contribution = 7.00 <= 7.00 -> Ineligible!
      const calcIneligible = calculateOrderContribution({
        sellingPrice: 36.0,
        quantity: 1,
        purchaseCost: 20,
        packagingCost: 1,
        deliveryCost: 8,
        minContributionThreshold: 7,
        rateRule: {
          type: "PERCENTAGE",
          rate: new Decimal(50),
          source: "GLOBAL",
          performanceLevelId: null,
          performanceLevelName: null,
        },
      });
      expect(calcIneligible.isEligible).toBe(false);
    });

    it("handles multiple quantities accurately", () => {
      // Q = 3, Purchase = 10 (30), Packaging = 2 (6), Delivery = 8 (flat)
      // Total Costs = 44 DT. Min threshold = 7 DT.
      // Min Revenue = 44 + 7 + 0.01 = 51.01 DT.
      // Per unit = 51.01 / 3 = 17.00333... ceil(3) -> 17.004 DT
      const minPrice = calculateMinimumSellingPrice({
        quantity: 3,
        purchaseCost: 10,
        packagingCost: 2,
        deliveryCost: 8,
        minContributionThreshold: 7,
      });

      expect(minPrice.toString()).toBe("17.004");

      const calc = calculateOrderContribution({
        sellingPrice: minPrice,
        quantity: 3,
        purchaseCost: 10,
        packagingCost: 2,
        deliveryCost: 8,
        minContributionThreshold: 7,
        rateRule: {
          type: "PERCENTAGE",
          rate: new Decimal(50),
          source: "GLOBAL",
          performanceLevelId: null,
          performanceLevelName: null,
        },
      });
      expect(calc.isEligible).toBe(true);
    });
  });

  describe("2. createOrderSchema preprocessing", () => {
    const baseValid = {
      productId: "prod-1",
      quantity: 1,
      customerFullName: "Test Client",
      phone: "98123456",
      governorate: "Tunis",
      city: "Tunis",
      address: "123 Rue de la Liberté",
      confirmed: "on" as const,
    };

    it("accepts valid numeric sellingPrice", () => {
      const parsed = createOrderSchema.parse({ ...baseValid, sellingPrice: 50.5 });
      expect(parsed.sellingPrice).toBe(50.5);
    });

    it("coerces string numbers into numeric sellingPrice", () => {
      const parsed = createOrderSchema.parse({ ...baseValid, sellingPrice: "48.250" });
      expect(parsed.sellingPrice).toBe(48.25);
    });

    it("transforms empty string or null into undefined (falling back to catalog)", () => {
      const parsedEmpty = createOrderSchema.parse({ ...baseValid, sellingPrice: "" });
      expect(parsedEmpty.sellingPrice).toBeUndefined();

      const parsedNull = createOrderSchema.parse({ ...baseValid, sellingPrice: null });
      expect(parsedNull.sellingPrice).toBeUndefined();
    });

    it("rejects non-positive or negative prices", () => {
      expect(() => createOrderSchema.parse({ ...baseValid, sellingPrice: -5 })).toThrow();
      expect(() => createOrderSchema.parse({ ...baseValid, sellingPrice: 0 })).toThrow();
    });
  });

  describe("3. createOrder behavior with custom selling price", () => {
    it("uses catalog price when sellingPrice is omitted", async () => {
      const env = createMockEnv();
      vi.mocked(prisma.$transaction).mockImplementation((async (cb: MockTxCallback) => cb(env.tx)) as never);

      const order = await createOrder(
        {
          productId: "prod-1",
          quantity: 1,
          customerFullName: "Client 1",
          phone: "98123456",
          governorate: "Tunis",
          city: "Tunis",
          address: "Rue Habib Bourguiba",
          confirmed: "on",
        },
        { partnerId: "part-1", actorId: "part-1" },
      );

      expect(order.unitSellingPrice.toString()).toBe("44.000");
      expect(order.contribution.toString()).toBe("15.00");
    });

    it("accepts custom price higher than catalog price", async () => {
      const env = createMockEnv();
      vi.mocked(prisma.$transaction).mockImplementation((async (cb: MockTxCallback) => cb(env.tx)) as never);

      const order = await createOrder(
        {
          productId: "prod-1",
          quantity: 1,
          customerFullName: "Client 2",
          phone: "98123456",
          governorate: "Tunis",
          city: "Tunis",
          address: "Rue Habib Bourguiba",
          confirmed: "on",
          sellingPrice: 55, // Higher than catalog 44
        },
        { partnerId: "part-1", actorId: "part-1" },
      );

      // Revenue = 55, Costs = 29, Contribution = 26 DT
      expect(order.unitSellingPrice.toString()).toBe("55.000");
      expect(order.contribution.toString()).toBe("26.00");
      expect(order.partnerEarning.toString()).toBe("13.00"); // 50% of 26
    });

    it("accepts custom price lower than catalog price as long as contribution > minContribution", async () => {
      const env = createMockEnv();
      vi.mocked(prisma.$transaction).mockImplementation((async (cb: MockTxCallback) => cb(env.tx)) as never);

      const order = await createOrder(
        {
          productId: "prod-1",
          quantity: 1,
          customerFullName: "Client 3",
          phone: "98123456",
          governorate: "Tunis",
          city: "Tunis",
          address: "Rue Habib Bourguiba",
          confirmed: "on",
          sellingPrice: 38, // Lower than catalog 44, but 38 - 29 = 9 DT > 7 DT!
        },
        { partnerId: "part-1", actorId: "part-1" },
      );

      expect(order.unitSellingPrice.toString()).toBe("38.000");
      expect(order.contribution.toString()).toBe("9.00");
      expect(order.partnerEarning.toString()).toBe("4.50");
    });

    it("rejects custom price when contribution <= minContribution threshold", async () => {
      const env = createMockEnv();
      vi.mocked(prisma.$transaction).mockImplementation((async (cb: MockTxCallback) => cb(env.tx)) as never);

      // 36.000 DT yields contribution = 36 - 29 = 7.00 DT (not > 7.00 DT)
      await expect(
        createOrder(
          {
            productId: "prod-1",
            quantity: 1,
            customerFullName: "Client 4",
            phone: "98123456",
            governorate: "Tunis",
            city: "Tunis",
            address: "Rue Habib Bourguiba",
            confirmed: "on",
            sellingPrice: 36,
          },
          { partnerId: "part-1", actorId: "part-1" },
        ),
      ).rejects.toThrow(/Contribution insuffisante.*d'au moins 36\.010 DT/);
    });
  });
});
