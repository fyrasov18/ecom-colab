import { describe, expect, it, vi, beforeEach } from "vitest";
import Decimal from "decimal.js";
import { Prisma } from "@prisma/client";
import {
  createOrder,
  confirmOrder,
} from "@/modules/orders/create";
import { changeOrderStatus } from "@/modules/orders/status";
import {
  type FinancialSnapshot,
} from "@/modules/finance/contribution-engine";
import { SETTING_KEYS } from "@/modules/settings/defaults";

// Mock external dependencies
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/modules/products/service", () => ({
  alertIfLowStock: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/modules/audit/service", () => ({
  recordAudit: vi.fn(),
}));

vi.mock("@/modules/notifications/service", () => ({
  notifyPartnerAccount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/finance/ledger", () => ({
  createPartnerEarning: vi.fn().mockResolvedValue({ amount: new Decimal("9.000") }),
  applyReturnCostRule: vi.fn().mockResolvedValue({
    rule: "REVERSE_PENDING_EARNING",
    charged: new Decimal("0.000"),
    reversedEarning: new Decimal("9.000"),
    deliveryCharge: null,
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";
import type { CreateOrderInput } from "@/modules/orders/schemas";

type MockTxCallback = (tx: unknown) => Promise<unknown>;

function createLifecycleMockEnv(overrides?: {
  product?: Record<string, unknown>;
  order?: Record<string, unknown>;
  partner?: Record<string, unknown>;
  partnerProduct?: Record<string, unknown>;
  performanceLevel?: { id: string; name: string; sharePercentage: number; isActive: boolean } | null;
  minContribution?: number;
  globalCommission?: { commissionType: string; commissionValue: number };
}) {
  const product = {
    id: "prod-1",
    name: "Produit Test",
    slug: "produit-test",
    sellingPrice: new Decimal(44.0),
    purchaseCost: new Decimal(20.0),
    packagingCost: new Decimal(1.0),
    deliveryCost: new Decimal(8.0),
    stockQuantity: 20,
    minStockAlert: 2,
    status: "ACTIVE",
    ...overrides?.product,
  };

  const partner = {
    id: "part-1",
    displayName: "Partenaire Test",
    defaultCommissionType: null,
    defaultCommissionValue: null,
    ...overrides?.partner,
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
    ...overrides?.partnerProduct,
  };

  let orderRecord: Record<string, unknown> = {
    id: "ord-1",
    orderNumber: 1001,
    partnerId: "part-1",
    createdById: "actor-1",
    customerId: "cust-1",
    status: "CONFIRMED",
    quantity: 1,
    notes: null,
    currency: "TND",
    partnerConfirmedAt: null,
    unitSellingPrice: new Decimal("44.000"),
    productCost: new Decimal("20.000"),
    packagingCost: new Decimal("1.000"),
    deliveryCost: new Decimal("8.000"),
    contribution: new Decimal("15.00"),
    commissionType: "PERCENTAGE",
    commissionValue: new Decimal("60.00"),
    commissionSource: "PERFORMANCE_LEVEL",
    partnerEarning: new Decimal("9.00"),
    platformShare: new Decimal("6.00"),
    performanceLevelName: "level 1",
    partnerSharePercentage: new Decimal("60.00"),
    initialSnapshot: null,
    finalSnapshot: null,
    items: [
      {
        id: "item-1",
        productId: "prod-1",
        quantity: 1,
        unitPrice: new Decimal("44.000"),
        productName: "Produit Test",
        productSlug: "produit-test",
      },
    ],
    shipment: null,
    ...overrides?.order,
  };

  const auditCalls: unknown[] = [];
  const statusHistoryRecords: unknown[] = [];

  const tx = {
    partnerProduct: {
      findUnique: vi.fn().mockResolvedValue(partnerProduct),
    },
    partner: {
      findUnique: vi.fn().mockResolvedValue({
        id: "part-1",
        performanceLevel:
          overrides?.performanceLevel === undefined
            ? { id: "lvl-1", name: "level 1", sharePercentage: 60, isActive: true }
            : overrides.performanceLevel,
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
        if (where.key === SETTING_KEYS.SETTLEMENT_PERIOD_HOURS) {
          return { value: 48 };
        }
        return null;
      }),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn().mockResolvedValue([{ nextval: BigInt(1001) }]),
    customer: {
      upsert: vi.fn().mockResolvedValue({ id: "cust-1" }),
    },
    order: {
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        const itemCreated = data.items && typeof data.items === "object" && "create" in (data.items as Record<string, unknown>)
          ? [(data.items as { create: Record<string, unknown> }).create]
          : [
              {
                id: "item-1",
                productId: "prod-1",
                quantity: data.quantity ?? 1,
                unitPrice: data.unitSellingPrice ?? new Decimal("44.000"),
                productName: "Produit Test",
                productSlug: "produit-test",
              },
            ];
        const finalSnapshot = data.finalSnapshot === Prisma.JsonNull ? null : (data.finalSnapshot ?? null);
        const initialSnapshot = data.initialSnapshot === Prisma.JsonNull ? null : (data.initialSnapshot ?? null);
        orderRecord = { ...orderRecord, ...data, finalSnapshot, initialSnapshot, items: itemCreated, id: "ord-1" };
        return orderRecord;
      }),
      findUniqueOrThrow: vi.fn().mockImplementation(async () => ({ ...orderRecord })),
      update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        const finalSnapshot = data.finalSnapshot === Prisma.JsonNull ? null : (data.finalSnapshot ?? orderRecord.finalSnapshot);
        const initialSnapshot = data.initialSnapshot === Prisma.JsonNull ? null : (data.initialSnapshot ?? orderRecord.initialSnapshot);
        orderRecord = { ...orderRecord, ...data, finalSnapshot, initialSnapshot };
        return orderRecord;
      }),
      updateMany: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        const finalSnapshot = data.finalSnapshot === Prisma.JsonNull ? null : (data.finalSnapshot ?? orderRecord.finalSnapshot);
        const initialSnapshot = data.initialSnapshot === Prisma.JsonNull ? null : (data.initialSnapshot ?? orderRecord.initialSnapshot);
        orderRecord = { ...orderRecord, ...data, finalSnapshot, initialSnapshot };
        return { count: 1 };
      }),
    },
    product: {
      update: vi.fn().mockResolvedValue({
        id: "prod-1",
        stockQuantity: 19,
        minStockAlert: 2,
        name: "Produit Test",
      }),
    },
    shipment: {
      create: vi.fn().mockResolvedValue({ id: "sh-1" }),
      upsert: vi.fn().mockResolvedValue({ id: "sh-1" }),
    },
    return: {
      upsert: vi.fn().mockResolvedValue({ id: "ret-1" }),
    },
    orderStatusHistory: {
      create: vi.fn().mockImplementation(async ({ data }: { data: unknown }) => {
        statusHistoryRecords.push(data);
        return { id: "osh-1" };
      }),
    },
    auditLog: {
      create: vi.fn().mockImplementation(async (entry: unknown) => {
        auditCalls.push(entry);
      }),
    },
  };

  return {
    tx,
    getOrder: () => orderRecord,
    getAuditCalls: () => auditCalls,
    getStatusHistory: () => statusHistoryRecords,
  };
}

describe("FINAL VERIFICATION: InitialSnapshot vs FinalSnapshot Lifecycle & Discount Integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Initial snapshot exists immediately after order creation ──
  it("#1 Initial snapshot exists immediately after order creation", async () => {
    const env = createLifecycleMockEnv();
    vi.mocked(prisma.$transaction).mockImplementation((async (cb: MockTxCallback) => {
      return cb(env.tx);
    }) as never);

    const order = await createOrder(
      {
        productId: "prod-1",
        quantity: 1,
        customerFullName: "Client Test",
        phone: "98123456",
        governorate: "Tunis",
        city: "Tunis",
        address: "Rue Habib Bourguiba",
        confirmed: false, // Unconfirmed creation!
      },
      { partnerId: "part-1", actorId: "actor-1" },
    );

    expect(order.initialSnapshot).not.toBeNull();
    const snapshot = order.initialSnapshot as unknown as FinancialSnapshot;
    expect(snapshot.version).toBe(1);
    expect(snapshot.unitSellingPrice).toBe("44.000");
    expect(snapshot.productCost).toBe("20.000");
    expect(snapshot.packagingCost).toBe("1.000");
    expect(snapshot.deliveryCost).toBe("8.000");
    expect(snapshot.contribution).toBe("15.00");
    expect(snapshot.partnerEarning).toBe("9.00");
    expect(snapshot.platformShare).toBe("6.00");
    expect(snapshot.discount).toBe("0.000");
    expect(snapshot.isEligible).toBe(true);
  });

  // ── 2. Final snapshot does not exist before confirmation ──
  it("#2 Final snapshot does not exist before confirmation", async () => {
    const env = createLifecycleMockEnv();
    vi.mocked(prisma.$transaction).mockImplementation((async (cb: MockTxCallback) => {
      return cb(env.tx);
    }) as never);

    const order = await createOrder(
      {
        productId: "prod-1",
        quantity: 1,
        customerFullName: "Client Test",
        phone: "98123456",
        governorate: "Tunis",
        city: "Tunis",
        address: "Rue Habib Bourguiba",
        confirmed: false, // Unconfirmed creation!
      },
      { partnerId: "part-1", actorId: "actor-1" },
    );

    expect(order.finalSnapshot).toBeNull();
    expect(order.partnerConfirmedAt).toBeNull();
    expect(env.getOrder().finalSnapshot).toBeNull();
    expect(env.getOrder().partnerConfirmedAt).toBeNull();
  });

  // ── 3. Final snapshot is generated during successful confirmation ──
  it("#3 Final snapshot is generated during successful confirmation", async () => {
    const env = createLifecycleMockEnv();
    vi.mocked(prisma.$transaction).mockImplementation((async (cb: MockTxCallback) => {
      return cb(env.tx);
    }) as never);

    // 1. Create unconfirmed order
    const unconfirmed = await createOrder(
      {
        productId: "prod-1",
        quantity: 1,
        customerFullName: "Client Test",
        phone: "98123456",
        governorate: "Tunis",
        city: "Tunis",
        address: "Rue Habib Bourguiba",
        confirmed: false,
      },
      { partnerId: "part-1", actorId: "actor-1" },
    );

    expect(unconfirmed.initialSnapshot).not.toBeNull();
    expect(unconfirmed.finalSnapshot).toBeNull();

    // 2. Confirm order
    const confirmed = await confirmOrder(unconfirmed.id, {
      actorId: "actor-1",
      partnerId: "part-1",
    });

    expect(confirmed.finalSnapshot).not.toBeNull();
    expect(confirmed.partnerConfirmedAt).not.toBeNull();
    const finalSnap = confirmed.finalSnapshot as unknown as FinancialSnapshot;
    expect(finalSnap.version).toBe(1);
    expect(finalSnap.contribution).toBe("15.00");
    expect(finalSnap.partnerEarning).toBe("9.00");
    expect(finalSnap.platformShare).toBe("6.00");
    expect(finalSnap.isEligible).toBe(true);

    // Audit recorded
    expect(recordAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "ORDER_CONFIRMED",
        entityId: unconfirmed.id,
      }),
    );
  });

  // ── 4. Changed financial data rejects confirmation ──
  it("#4 Changed financial data rejects confirmation", async () => {
    let priceChanged = false;
    const env = createLifecycleMockEnv();

    vi.mocked(prisma.$transaction).mockImplementation((async (cb: MockTxCallback) => {
      if (priceChanged) {
        // Concurrently changed selling price from 44 DT to 50 DT
        env.tx.partnerProduct.findUnique.mockResolvedValueOnce({
          id: "pp-1",
          partnerId: "part-1",
          productId: "prod-1",
          status: "ACTIVE",
          commissionType: null,
          commissionValue: null,
          product: {
            id: "prod-1",
            sellingPrice: new Decimal(50.0), // Concurrently updated!
            purchaseCost: new Decimal(20.0),
            packagingCost: new Decimal(1.0),
            deliveryCost: new Decimal(8.0),
            stockQuantity: 20,
            status: "ACTIVE",
          },
          partner: {
            id: "part-1",
            defaultCommissionType: null,
            defaultCommissionValue: null,
          },
        });
      }
      return cb(env.tx);
    }) as never);

    // 1. Create unconfirmed order at 44 DT
    const order = await createOrder(
      {
        productId: "prod-1",
        quantity: 1,
        customerFullName: "Client Test",
        phone: "98123456",
        governorate: "Tunis",
        city: "Tunis",
        address: "Rue Habib Bourguiba",
        confirmed: false,
      },
      { partnerId: "part-1", actorId: "actor-1" },
    );

    // 2. Price changes in catalog
    priceChanged = true;

    // 3. Confirm order must be rejected
    await expect(
      confirmOrder(order.id, {
        actorId: "actor-1",
        partnerId: "part-1",
      }),
    ).rejects.toThrow("Les conditions financières ont changé depuis votre aperçu");
  });

  // ── 5. Failed confirmation does not leave partial financial updates ──
  it("#5 Failed confirmation does not leave partial financial updates", async () => {
    const env = createLifecycleMockEnv();
    vi.mocked(prisma.$transaction).mockImplementation((async (cb: MockTxCallback) => {
      return cb(env.tx);
    }) as never);

    // Create unconfirmed order
    const order = await createOrder(
      {
        productId: "prod-1",
        quantity: 1,
        customerFullName: "Client Test",
        phone: "98123456",
        governorate: "Tunis",
        city: "Tunis",
        address: "Rue Habib Bourguiba",
        confirmed: false,
      },
      { partnerId: "part-1", actorId: "actor-1" },
    );

    // Concurrently change purchase cost so confirmation fails
    env.tx.partnerProduct.findUnique.mockResolvedValueOnce({
      id: "pp-1",
      partnerId: "part-1",
      productId: "prod-1",
      status: "ACTIVE",
      commissionType: null,
      commissionValue: null,
      product: {
        id: "prod-1",
        sellingPrice: new Decimal(44.0),
        purchaseCost: new Decimal(35.0), // Higher cost reduces contribution!
        packagingCost: new Decimal(1.0),
        deliveryCost: new Decimal(8.0),
        stockQuantity: 20,
        status: "ACTIVE",
      },
      partner: { id: "part-1", defaultCommissionType: null, defaultCommissionValue: null },
    });

    vi.mocked(recordAudit).mockClear();

    await expect(
      confirmOrder(order.id, {
        actorId: "actor-1",
        partnerId: "part-1",
      }),
    ).rejects.toThrow();

    // Verify order in database still has finalSnapshot: null and partnerConfirmedAt: null
    const persisted = env.getOrder();
    expect(persisted.finalSnapshot).toBeNull();
    expect(persisted.partnerConfirmedAt).toBeNull();
    // Audit log was not written
    expect(recordAudit).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "ORDER_CONFIRMED" }),
    );
  });

  // ── 6. Confirmed snapshot cannot be modified by later operations ──
  it("#6 Confirmed snapshot cannot be modified by later operations", async () => {
    const env = createLifecycleMockEnv();
    vi.mocked(prisma.$transaction).mockImplementation((async (cb: MockTxCallback) => {
      return cb(env.tx);
    }) as never);

    // 1. Create and confirm order
    const order = await createOrder(
      {
        productId: "prod-1",
        quantity: 1,
        customerFullName: "Client Test",
        phone: "98123456",
        governorate: "Tunis",
        city: "Tunis",
        address: "Rue Habib Bourguiba",
        confirmed: "on", // Confirmed atomically
      },
      { partnerId: "part-1", actorId: "actor-1" },
    );

    expect(order.finalSnapshot).not.toBeNull();
    const frozenFinalSnapshot = JSON.stringify(order.finalSnapshot);

    // 2. Re-confirmation must be rejected (immutability guard)
    await expect(
      confirmOrder(order.id, {
        actorId: "actor-1",
        partnerId: "part-1",
      }),
    ).rejects.toThrow("Cette commande est déjà confirmée. La snapshot financière est immuable.");

    // 3. Operational status transitions (VALIDATED -> PREPARING -> DELIVERED)
    await changeOrderStatus({
      orderId: order.id,
      to: "VALIDATED",
      actorId: "admin-1",
      role: "ADMIN",
    });
    expect(JSON.stringify(env.getOrder().finalSnapshot)).toBe(frozenFinalSnapshot);

    await changeOrderStatus({
      orderId: order.id,
      to: "PREPARING",
      actorId: "admin-1",
      role: "ADMIN",
    });
    expect(JSON.stringify(env.getOrder().finalSnapshot)).toBe(frozenFinalSnapshot);

    await changeOrderStatus({
      orderId: order.id,
      to: "PACKAGED",
      actorId: "admin-1",
      role: "ADMIN",
    });
    expect(JSON.stringify(env.getOrder().finalSnapshot)).toBe(frozenFinalSnapshot);

    await changeOrderStatus({
      orderId: order.id,
      to: "SHIPPED",
      actorId: "admin-1",
      role: "ADMIN",
    });
    expect(JSON.stringify(env.getOrder().finalSnapshot)).toBe(frozenFinalSnapshot);

    await changeOrderStatus({
      orderId: order.id,
      to: "IN_DELIVERY",
      actorId: "admin-1",
      role: "ADMIN",
    });
    expect(JSON.stringify(env.getOrder().finalSnapshot)).toBe(frozenFinalSnapshot);

    await changeOrderStatus({
      orderId: order.id,
      to: "DELIVERED",
      actorId: "admin-1",
      role: "ADMIN",
    });
    // finalSnapshot remains 100% untouched and identical
    expect(JSON.stringify(env.getOrder().finalSnapshot)).toBe(frozenFinalSnapshot);
  });

  // ── 7. Historical orders remain unchanged ──
  it("#7 Historical orders remain unchanged and are not recalculated", async () => {
    // Historical order created prior to contribution engine (both snapshots null)
    const env = createLifecycleMockEnv({
      order: {
        id: "ord-hist",
        initialSnapshot: null,
        finalSnapshot: null,
        contribution: new Decimal("20.000"),
        partnerEarning: new Decimal("12.000"),
        deliveryCost: new Decimal("7.000"),
      },
    });

    vi.mocked(prisma.$transaction).mockImplementation((async (cb: MockTxCallback) => {
      return cb(env.tx);
    }) as never);

    // Status transition on historical order
    await changeOrderStatus({
      orderId: "ord-hist",
      to: "VALIDATED",
      actorId: "admin-1",
      role: "ADMIN",
    });

    const orderAfterTransition = env.getOrder();
    // Snapshots remain null and are never back-populated or recalculated
    expect(orderAfterTransition.initialSnapshot).toBeNull();
    expect(orderAfterTransition.finalSnapshot).toBeNull();
    expect(String(orderAfterTransition.partnerEarning)).toBe("12");
  });

  // ── 8. Client cannot manipulate discount or financial values ──
  it("#8 Client cannot manipulate discount or financial values", async () => {
    const env = createLifecycleMockEnv();
    vi.mocked(prisma.$transaction).mockImplementation((async (cb: MockTxCallback) => {
      return cb(env.tx);
    }) as never);

    // A. Malicious client attempts to pass arbitrary discount and custom sellingPrice
    const maliciousInput = {
      productId: "prod-1",
      quantity: 1,
      customerFullName: "Attacker",
      phone: "98123456",
      governorate: "Tunis",
      city: "Tunis",
      address: "Rue Test",
      confirmed: "on",
      discount: 50, // Untrusted discount injection attempt!
      sellingPrice: 10, // Untrusted price override attempt!
    } as unknown as CreateOrderInput;

    const order = await createOrder(maliciousInput, { partnerId: "part-1", actorId: "part-1" });

    // Server completely ignored client discount and price:
    // NetRevenue = 44 * 1 - 0 = 44 DT
    // Costs = 20 + 1 + 8 = 29 DT
    // Contribution = 15 DT
    expect(order.unitSellingPrice.toString()).toBe("44.000");
    expect(order.contribution.toString()).toBe("15.00");
    const snapshot = order.finalSnapshot as unknown as FinancialSnapshot;
    expect(snapshot.discount).toBe("0.000");
    expect(snapshot.unitSellingPrice).toBe("44.000");

    // B. Malicious client attempts to forge a previewSnapshot with discount
    const forgedSnapshot: FinancialSnapshot = {
      ...snapshot,
      discount: "10.000",
      netRevenue: "34.000",
      contribution: "5.00",
    };

    await expect(
      createOrder(
        {
          productId: "prod-1",
          quantity: 1,
          customerFullName: "Attacker",
          phone: "98123456",
          governorate: "Tunis",
          city: "Tunis",
          address: "Rue Test",
          confirmed: "on",
          previewSnapshot: JSON.stringify(forgedSnapshot),
        },
        { partnerId: "part-1", actorId: "part-1" },
      ),
    ).rejects.toThrow("Les conditions financières ont changé depuis votre aperçu");
  });

  // ── 9. Unconfirmed order cannot enter operational status machine ──
  it("#9 Unconfirmed order cannot enter operations before partner confirmation", async () => {
    const env = createLifecycleMockEnv({
      order: {
        id: "ord-unconfirmed",
        initialSnapshot: { version: 1 },
        finalSnapshot: null, // NOT CONFIRMED!
      },
    });

    vi.mocked(prisma.$transaction).mockImplementation((async (cb: MockTxCallback) => {
      return cb(env.tx);
    }) as never);

    await expect(
      changeOrderStatus({
        orderId: "ord-unconfirmed",
        to: "VALIDATED",
        actorId: "admin-1",
        role: "ADMIN",
      }),
    ).rejects.toThrow(
      "La commande doit être confirmée par le partenaire avant d'entrer en opérations.",
    );
  });
});
