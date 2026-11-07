import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";
import { alertIfLowStock } from "@/modules/products/service";
import { getSetting } from "@/modules/settings/service";
import { SETTING_KEYS } from "@/modules/settings/defaults";
import { readPartnerLevel } from "@/modules/finance/performance-service";
import {
  calculateOrderContribution,
  resolveContributionRate,
  verifyConfirmationIntegrity,
  type FinancialSnapshot,
} from "@/modules/finance/contribution-engine";
import {
  CONFIRMATION_TEXT,
  createOrderSchema,
  unconfirmedOrderSchema,
  type CreateOrderInput,
  type CreateUnconfirmedOrderInput,
} from "./schemas";

export class OrderError extends Error {}

export const MAX_ORDER_TRANSACTION_ATTEMPTS = 3;

/**
 * Checks whether an error represents a database transaction serialization conflict,
 * write skew collision, or deadlock (Prisma P2034 or Postgres 40001).
 */
export function isSerializationError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2034") return true;
  }
  if (typeof err === "object" && err !== null && "code" in err) {
    if ((err as { code: string }).code === "P2034") return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("P2034") ||
    msg.includes("40001") ||
    msg.includes("could not serialize access") ||
    msg.includes("write conflict") ||
    msg.includes("deadlock detected")
  );
}

async function nextOrderNumber(tx: Prisma.TransactionClient): Promise<number> {
  await tx.$executeRaw`CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1001`;
  const rows = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('order_number_seq') AS nextval`;
  return Number(rows[0].nextval);
}

/**
 * Partner creates an order.
 * - Always populates `initialSnapshot` at creation time.
 * - If confirmed (default partner flow with confirmed: "on"), populates `finalSnapshot` and `partnerConfirmedAt` atomically.
 * - If unconfirmed (opts.unconfirmed = true or confirmed !== "on"), creates order in unconfirmed state (initialSnapshot populated, finalSnapshot: null, partnerConfirmedAt: null).
 * - Enforces assignment, stock, minimum contribution (> 7.00 DT).
 * - Cost model: product & packaging × quantity, delivery once per order.
 * - Discount is hardcoded to 0; client cannot inject discounts.
 *
 * Transaction Isolation & Concurrency:
 * - Runs with explicit Serializable isolation to guarantee strict serializability of
 *   all financial reads (Product prices/costs, settings, partner level).
 * - Retries up to 3 total attempts exclusively on serialization conflicts (P2034/40001).
 * - Every retry fully re-reads all financial parameters fresh from the database and
 *   re-validates the client preview snapshot.
 * - Business rule rejections, validation errors, and permission failures are never retried.
 */
export async function createOrder(
  input: CreateOrderInput | CreateUnconfirmedOrderInput,
  ctx: { partnerId: string; actorId: string },
  opts?: { unconfirmed?: boolean },
) {
  const isUnconfirmedMode = opts?.unconfirmed === true || input.confirmed === false || !("confirmed" in input) || input.confirmed !== "on";
  const data = isUnconfirmedMode
    ? unconfirmedOrderSchema.parse(input)
    : createOrderSchema.parse(input);

  const { partnerId, actorId } = ctx;
  const isConfirmed = !isUnconfirmedMode && data.confirmed === "on";

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ORDER_TRANSACTION_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
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

          // ── Canonical Contribution Calculation ──
          // Re-read fresh from the database on every attempt
          const globalCommission = await getSetting<{
            commissionType: "PERCENTAGE" | "FIXED";
            commissionValue: number;
          }>(SETTING_KEYS.GLOBAL_COMMISSION, tx);

          const minContribution = await getSetting<number>(
            SETTING_KEYS.MIN_ORDER_CONTRIBUTION,
            tx,
          );

          const level = await readPartnerLevel(tx, partnerId);

          const rateRule = resolveContributionRate({
            partnerProduct: {
              commissionType: assignment.commissionType,
              commissionValue: assignment.commissionValue,
            },
            partner: {
              commissionType: partner.defaultCommissionType,
              commissionValue: partner.defaultCommissionValue,
            },
            performanceLevel: level,
            global: globalCommission,
          });

          const quantity = data.quantity;
          // SECURITY: Selling price is NEVER taken from the client.
          // Discount is hardcoded to 0 (no unapproved discount mechanism).
          const calculation = calculateOrderContribution({
            sellingPrice: product.sellingPrice,
            quantity,
            purchaseCost: product.purchaseCost,
            packagingCost: product.packagingCost,
            deliveryCost: product.deliveryCost,
            discount: 0,
            minContributionThreshold: minContribution,
            rateRule,
          });

          if (!calculation.isEligible) {
            throw new OrderError(
              `Contribution insuffisante : minimum requis supérieur à ${calculation.minContributionThreshold.toFixed(2)} DT. ` +
                `Contribution actuelle : ${calculation.contribution.toFixed(2)} DT.`,
            );
          }

          // ── Snapshot integrity verification ──
          const initialSnapshot: FinancialSnapshot = calculation.snapshot;

          if (isConfirmed && data.previewSnapshot) {
            let parsedPreview: FinancialSnapshot;
            try {
              parsedPreview =
                typeof data.previewSnapshot === "string"
                  ? (JSON.parse(data.previewSnapshot) as FinancialSnapshot)
                  : (data.previewSnapshot as FinancialSnapshot);
            } catch {
              throw new OrderError(
                "Aperçu financier invalide. Veuillez actualiser la page avant de confirmer.",
              );
            }

            if (!parsedPreview || typeof parsedPreview !== "object") {
              throw new OrderError(
                "Aperçu financier invalide. Veuillez actualiser la page avant de confirmer.",
              );
            }

            const integrity = verifyConfirmationIntegrity(parsedPreview, calculation.snapshot);
            if (!integrity.isIdentical) {
              throw new OrderError(
                "Les conditions financières ont changé depuis votre aperçu. Veuillez actualiser la page avant de confirmer.",
              );
            }
          }

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

          const confirmedAt = isConfirmed ? new Date() : null;
          const finalSnapshot = isConfirmed
            ? (calculation.snapshot as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull;

          const order = await tx.order.create({
            data: {
              orderNumber,
              partnerId,
              createdById: actorId,
              customerId: customer.id,
              status: "CONFIRMED",
              quantity,
              notes: data.notes || null,
              partnerConfirmedAt: confirmedAt,
              unitSellingPrice: calculation.unitSellingPrice.toFixed(3),
              productCost: calculation.productCost.toFixed(3),
              packagingCost: calculation.packagingCostTotal.toFixed(3),
              deliveryCost: calculation.deliveryCostTotal.toFixed(3),
              contribution: calculation.contribution.toFixed(2),
              commissionType: calculation.commissionType,
              commissionValue: calculation.rate.toFixed(2),
              commissionSource: calculation.commissionSource,
              partnerEarning: calculation.partnerEarning.toFixed(2),
              platformShare: calculation.platformShare.toFixed(2),
              performanceLevelName: calculation.performanceLevelName,
              partnerSharePercentage: calculation.performanceLevelName
                ? calculation.rate.toFixed(2)
                : null,
              initialSnapshot: initialSnapshot as unknown as Prisma.InputJsonValue,
              finalSnapshot,
              items: {
                create: {
                  productId: product.id,
                  quantity,
                  unitPrice: calculation.unitSellingPrice.toFixed(3),
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

          await alertIfLowStock(tx, updated, product);

          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              newStatus: "CONFIRMED",
              changedById: actorId,
              reason: isConfirmed
                ? `Commande créée et confirmée — ${CONFIRMATION_TEXT}`
                : "Commande créée (en attente de confirmation)",
            },
          });

          await recordAudit(tx, {
            actorId,
            action: isConfirmed ? "ORDER_CREATED_CONFIRMED" : "ORDER_CREATED",
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
              performanceLevelName: order.performanceLevelName,
              partnerSharePercentage: order.partnerSharePercentage,
              customerId: customer.id,
              partnerConfirmed: isConfirmed,
              hasFinalSnapshot: isConfirmed,
            },
          });

          return order;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000,
        },
      );
    } catch (err) {
      lastError = err;
      if (
        err instanceof OrderError ||
        !isSerializationError(err) ||
        attempt >= MAX_ORDER_TRANSACTION_ATTEMPTS
      ) {
        throw err;
      }
      // Exponential backoff jitter before retry to resolve concurrency collision
      const jitterMs = Math.floor(Math.random() * 30) + 20 * attempt;
      await new Promise((resolve) => setTimeout(resolve, jitterMs));
    }
  }

  throw lastError;
}

/**
 * Creates an unconfirmed order with `initialSnapshot` populated and `finalSnapshot: null`.
 */
export async function createUnconfirmedOrder(
  input: CreateUnconfirmedOrderInput,
  ctx: { partnerId: string; actorId: string },
) {
  return createOrder(input, ctx, { unconfirmed: true });
}

/**
 * Confirms an unconfirmed order.
 * - Re-reads authoritative financial data (product selling price, costs, global commission, level)
 *   inside a Serializable transaction.
 * - Recalculates contribution.
 * - Verifies integrity against initialSnapshot (and optional previewSnapshot).
 * - Rejects confirmation if financial conditions changed.
 * - Generates and freezes `finalSnapshot`. Once set, `finalSnapshot` is immutable.
 * - Sets `partnerConfirmedAt = new Date()`.
 * - Failed confirmation rolls back completely, leaving zero partial financial updates.
 */
export async function confirmOrder(
  orderId: string,
  ctx: {
    actorId: string;
    partnerId?: string;
    previewSnapshot?: unknown;
  },
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ORDER_TRANSACTION_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const order = await tx.order.findUniqueOrThrow({
            where: { id: orderId },
            include: { items: true },
          });

          if (ctx.partnerId && order.partnerId !== ctx.partnerId) {
            throw new OrderError("Accès refusé à cette commande.");
          }

          // Immutability: Once confirmed, finalSnapshot can NEVER be modified.
          if (order.finalSnapshot !== null) {
            throw new OrderError(
              "Cette commande est déjà confirmée. La snapshot financière est immuable.",
            );
          }

          const firstItem = order.items[0];
          if (!firstItem) {
            throw new OrderError("Commande sans article.");
          }

          const assignment = await tx.partnerProduct.findUnique({
            where: {
              partnerId_productId: {
                partnerId: order.partnerId,
                productId: firstItem.productId,
              },
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

          // Authoritative financial re-reads inside transaction
          const globalCommission = await getSetting<{
            commissionType: "PERCENTAGE" | "FIXED";
            commissionValue: number;
          }>(SETTING_KEYS.GLOBAL_COMMISSION, tx);

          const minContribution = await getSetting<number>(
            SETTING_KEYS.MIN_ORDER_CONTRIBUTION,
            tx,
          );

          const level = await readPartnerLevel(tx, order.partnerId);

          const rateRule = resolveContributionRate({
            partnerProduct: {
              commissionType: assignment.commissionType,
              commissionValue: assignment.commissionValue,
            },
            partner: {
              commissionType: partner.defaultCommissionType,
              commissionValue: partner.defaultCommissionValue,
            },
            performanceLevel: level,
            global: globalCommission,
          });

          const calculation = calculateOrderContribution({
            sellingPrice: product.sellingPrice,
            quantity: order.quantity,
            purchaseCost: product.purchaseCost,
            packagingCost: product.packagingCost,
            deliveryCost: product.deliveryCost,
            discount: 0,
            minContributionThreshold: minContribution,
            rateRule,
          });

          if (!calculation.isEligible) {
            throw new OrderError(
              `Contribution insuffisante : minimum requis supérieur à ${calculation.minContributionThreshold.toFixed(2)} DT. ` +
                `Contribution actuelle : ${calculation.contribution.toFixed(2)} DT.`,
            );
          }

          // Verify confirmation integrity against initial snapshot or preview
          const referenceSnapshot = (ctx.previewSnapshot
            ? typeof ctx.previewSnapshot === "string"
              ? JSON.parse(ctx.previewSnapshot)
              : ctx.previewSnapshot
            : order.initialSnapshot) as FinancialSnapshot | null;

          if (referenceSnapshot) {
            const integrity = verifyConfirmationIntegrity(referenceSnapshot, calculation.snapshot);
            if (!integrity.isIdentical) {
              throw new OrderError(
                "Les conditions financières ont changé depuis votre aperçu. Veuillez actualiser la page avant de confirmer.",
              );
            }
          }

          const confirmedAt = new Date();
          const finalSnapshot = calculation.snapshot as unknown as Prisma.InputJsonValue;

          const updatedOrder = await tx.order.update({
            where: { id: order.id },
            data: {
              partnerConfirmedAt: confirmedAt,
              finalSnapshot,
              unitSellingPrice: calculation.unitSellingPrice.toFixed(3),
              productCost: calculation.productCost.toFixed(3),
              packagingCost: calculation.packagingCostTotal.toFixed(3),
              deliveryCost: calculation.deliveryCostTotal.toFixed(3),
              contribution: calculation.contribution.toFixed(2),
              commissionType: calculation.commissionType,
              commissionValue: calculation.rate.toFixed(2),
              commissionSource: calculation.commissionSource,
              partnerEarning: calculation.partnerEarning.toFixed(2),
              platformShare: calculation.platformShare.toFixed(2),
              performanceLevelName: calculation.performanceLevelName,
              partnerSharePercentage: calculation.performanceLevelName
                ? calculation.rate.toFixed(2)
                : null,
            },
          });

          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              newStatus: order.status,
              changedById: ctx.actorId,
              reason: `Commande confirmée — ${CONFIRMATION_TEXT}`,
            },
          });

          await recordAudit(tx, {
            actorId: ctx.actorId,
            action: "ORDER_CONFIRMED",
            entityType: "Order",
            entityId: order.id,
            before: {
              partnerConfirmedAt: null,
              finalSnapshot: null,
            },
            after: {
              partnerConfirmedAt: confirmedAt,
              finalSnapshot: calculation.snapshot,
              contribution: updatedOrder.contribution,
              partnerEarning: updatedOrder.partnerEarning,
            },
          });

          return updatedOrder;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000,
        },
      );
    } catch (err) {
      lastError = err;
      if (
        err instanceof OrderError ||
        !isSerializationError(err) ||
        attempt >= MAX_ORDER_TRANSACTION_ATTEMPTS
      ) {
        throw err;
      }
      const jitterMs = Math.floor(Math.random() * 30) + 20 * attempt;
      await new Promise((resolve) => setTimeout(resolve, jitterMs));
    }
  }

  throw lastError;
}
