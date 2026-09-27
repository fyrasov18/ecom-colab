import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { d, roundMoney } from "@/lib/money";
import { recordAudit } from "@/modules/audit/service";
import { alertIfLowStock } from "@/modules/products/service";
import { getSetting } from "@/modules/settings/service";
import { SETTING_KEYS } from "@/modules/settings/defaults";
import {
  computePartnerEarning,
  resolveCommission,
} from "@/modules/finance/commission";
import {
  CONFIRMATION_TEXT,
  createOrderSchema,
  type CreateOrderInput,
} from "./schemas";

export class OrderError extends Error {}

async function nextOrderNumber(tx: Prisma.TransactionClient): Promise<number> {
  await tx.$executeRaw`CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1001`;
  const rows = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('order_number_seq') AS nextval`;
  return Number(rows[0].nextval);
}

/**
 * Partner creates a CONFIRMED order (customer already confirmed offline).
 * Enforces assignment, stock, positive contribution, confirmation checkbox;
 * freezes the financial snapshot (never changes later).
 * Cost model: product & packaging × quantity, delivery once per order.
 */
export async function createOrder(
  input: CreateOrderInput,
  ctx: { partnerId: string; actorId: string },
) {
  const data = createOrderSchema.parse(input);
  const { partnerId, actorId } = ctx;

  return prisma.$transaction(async (tx) => {
    const assignment = await tx.partnerProduct.findUnique({
      where: {
        partnerId_productId: { partnerId, productId: data.productId },
      },
      include: { product: true, partner: true },
    });
    if (!assignment || assignment.status !== "ACTIVE") {
      throw new OrderError("Ce produit ne vous est pas assigné.");
    }
    const product = assignment.product;
    const partner = assignment.partner;

    if (product.status !== "ACTIVE" && product.status !== "OUT_OF_STOCK") {
      throw new OrderError("Ce produit n'est pas disponible à la vente.");
    }
    if (product.stockQuantity < data.quantity) {
      throw new OrderError(
        `Stock insuffisant (disponible : ${product.stockQuantity}).`,
      );
    }

    // ── Frozen financial snapshot ──
    const globalCommission = await getSetting<{
      commissionType: "PERCENTAGE" | "FIXED";
      commissionValue: number;
    }>(SETTING_KEYS.GLOBAL_COMMISSION, tx);

    const rule = resolveCommission({
      partnerProduct: {
        commissionType: assignment.commissionType,
        commissionValue: assignment.commissionValue,
      },
      partner: {
        commissionType: partner.defaultCommissionType,
        commissionValue: partner.defaultCommissionValue,
      },
      product: {
        commissionType: product.commissionType,
        commissionValue: product.commissionValue,
      },
      global: globalCommission,
    });

    const quantity = data.quantity;
    const revenue = d(data.sellingPrice).times(quantity);
    const productCost = roundMoney(d(product.purchaseCost).times(quantity));
    const packagingCost = roundMoney(d(product.packagingCost).times(quantity));
    const deliveryCost = roundMoney(product.deliveryCost); // one parcel per order
    const contribution = roundMoney(
      revenue.minus(productCost).minus(packagingCost).minus(deliveryCost),
    );
    if (contribution.lte(0)) {
      throw new OrderError(
        "Prix de vente trop bas : contribution positive requise. " +
          `(Minimum : ${roundMoney(productCost.plus(packagingCost).plus(deliveryCost))} DT)`,
      );
    }
    const { earning, platformShare } = computePartnerEarning(contribution, rule);

    // ── Customer (phone dedup per partner) ──
    const customer = await tx.customer.upsert({
      where: {
        ownerPartnerId_phone: { ownerPartnerId: partnerId, phone: data.phone },
      },
      create: {
        ownerPartnerId: partnerId,
        fullName: data.customerFullName,
        phone: data.phone,
        governorate: data.governorate,
        city: data.city,
        address: data.address,
      },
      update: {
        fullName: data.customerFullName,
        governorate: data.governorate,
        city: data.city,
        address: data.address,
      },
    });

    const orderNumber = await nextOrderNumber(tx);

    const order = await tx.order.create({
      data: {
        orderNumber,
        partnerId,
        createdById: actorId,
        customerId: customer.id,
        status: "CONFIRMED",
        quantity,
        notes: data.notes || null,
        partnerConfirmedAt: new Date(),
        unitSellingPrice: String(data.sellingPrice),
        productCost: productCost.toFixed(3),
        packagingCost: packagingCost.toFixed(3),
        deliveryCost: deliveryCost.toFixed(3),
        contribution: contribution.toFixed(3),
        commissionType: rule.type,
        commissionValue: rule.value.toFixed(3),
        commissionSource: rule.source,
        partnerEarning: earning.toFixed(3),
        platformShare: platformShare.toFixed(3),
        items: {
          create: {
            productId: product.id,
            quantity,
            unitPrice: String(data.sellingPrice),
            productName: product.name,
            productSlug: product.slug,
          },
        },
      },
    });

    const updated = await tx.product.update({
      where: { id: product.id },
      data: { stockQuantity: { decrement: quantity } },
    });

    // Phase 7: alert the back office only when the order pushed the product
    // *through* its low-stock threshold (not on every order while it is low).
    await alertIfLowStock(tx, updated, product);

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        newStatus: "CONFIRMED",
        changedById: actorId,
        reason: `Commande créée — ${CONFIRMATION_TEXT}`,
      },
    });

    await recordAudit(tx, {
      actorId,
      action: "ORDER_CREATED",
      entityType: "Order",
      entityId: order.id,
      after: {
        orderNumber,
        partnerId,
        productId: product.id,
        quantity,
        unitSellingPrice: order.unitSellingPrice,
        contribution: order.contribution,
        partnerEarning: order.partnerEarning,
        commissionSource: order.commissionSource,
        customerId: customer.id,
        partnerConfirmed: true,
      },
    });

    return order;
  });
}

