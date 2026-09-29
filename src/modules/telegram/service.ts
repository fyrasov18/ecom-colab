import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";
import { notifyBackOffice } from "@/modules/notifications/service";
import {
  isKnownStep,
  stepAfter,
  validateStepInput,
  type TelegramStep,
} from "./parser";

export class TelegramError extends Error {}

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Record a delivered update. Returns false when the update_id was already
 * processed — this unique key is what makes the webhook idempotent, so a
 * Telegram retry can never create a second product.
 */
export async function recordUpdate(input: {
  updateId: string;
  telegramUserId: string;
  kind: string;
}): Promise<boolean> {
  try {
    await prisma.telegramUpdate.create({ data: input });
    return true;
  } catch {
    // P2002 = duplicate update_id → already handled.
    return false;
  }
}

/** Look up a session by id (used to update wizard state from a route). */
export async function getSessionById(id: string) {
  return prisma.telegramSession.findUnique({ where: { id } });
}

/** Abandoned conversations expire: they must never be resumed weeks later. */
export const SESSION_TTL_MINUTES = 60;

export function sessionExpiry(from = new Date()): Date {
  return new Date(from.getTime() + SESSION_TTL_MINUTES * 60_000);
}

/**
 * Authorisation is keyed on the stable Telegram id, never a username.
 * Returns false when the user is unknown, disabled, or revoked.
 */
export async function isAuthorized(telegramUserId: string): Promise<boolean> {
  const row = await prisma.telegramAuthorizedUser.findUnique({
    where: { telegramUserId },
    select: { status: true },
  });
  return row?.status === "ACTIVE";
}

export async function listAuthorizedUsers() {
  return prisma.telegramAuthorizedUser.findMany({
    orderBy: { authorizedAt: "desc" },
  });
}

export async function authorizeTelegramUser(
  telegramUserId: string,
  displayName: string | null,
  actorId: string,
) {
  const clean = telegramUserId.trim();
  if (!/^-?\d{1,20}$/.test(clean)) {
    throw new TelegramError("Identifiant Telegram invalide (entier attendu).");
  }
  return prisma.$transaction(async (tx) => {
    const row = await tx.telegramAuthorizedUser.upsert({
      where: { telegramUserId: clean },
      create: { telegramUserId: clean, displayName, authorizedById: actorId },
      update: { status: "ACTIVE", revokedAt: null, displayName },
    });
    await recordAudit(tx, {
      actorId,
      action: "TELEGRAM_USER_AUTHORIZED",
      entityType: "TelegramAuthorizedUser",
      entityId: row.id,
      after: { telegramUserId: clean, status: "ACTIVE" },
    });
    return row;
  });
}

export async function revokeTelegramUser(telegramUserId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.telegramAuthorizedUser.findUniqueOrThrow({
      where: { telegramUserId },
    });
    const row = await tx.telegramAuthorizedUser.update({
      where: { telegramUserId },
      data: { status: "DISABLED", revokedAt: new Date() },
    });
    // Kill any in-flight session so a revoked user cannot finish a wizard.
    await tx.telegramSession.updateMany({
      where: { telegramUserId, status: "ACTIVE" },
      data: { status: "CANCELLED" },
    });
    await recordAudit(tx, {
      actorId,
      action: "TELEGRAM_USER_REVOKED",
      entityType: "TelegramAuthorizedUser",
      entityId: before.id,
      before: { status: before.status },
      after: { status: row.status },
    });
    return row;
  });
}
/** Current ACTIVE, unexpired session — or null. Expired rows are ignored. */
/**
 * These helpers accept an explicit transaction client so they can join a
 * caller's transaction. Route handlers omit the argument and fall back to the
 * shared client — keeping `@/lib/prisma` out of `src/app/**` (eslint guard).
 */
export async function getActiveSession(
  db: Db = prisma,
  telegramUserId: string,
  now = new Date(),
) {
  return db.telegramSession.findFirst({
    where: { telegramUserId, status: "ACTIVE", expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
}

export async function startSession(db: Db = prisma, telegramUserId: string) {
  // Only one live conversation per user: an existing one is replaced, not stacked.
  await db.telegramSession.updateMany({
    where: { telegramUserId, status: "ACTIVE" },
    data: { status: "CANCELLED" },
  });
  return db.telegramSession.create({
    data: {
      telegramUserId,
      step: "NAME",
      status: "ACTIVE",
      expiresAt: sessionExpiry(),
    },
  });
}

/** Close the session; pass productId to link the created DRAFT. */
export async function finishSession(
  db: Db = prisma,
  sessionId: string,
  status: "COMPLETED" | "CANCELLED",
  productId?: string,
) {
  return db.telegramSession.update({
    where: { id: sessionId },
    data: { status, step: "IDLE", ...(productId ? { productId } : {}) },
  });
}

/** Store one answer on the session and return the next step. */
export async function applyAnswer(
  db: Db = prisma,
  session: { id: string; step: string; data?: unknown },
  raw: string,
): Promise<{ ok: true; step: TelegramStep } | { ok: false; error: string }> {
  if (!isKnownStep(session.step) || session.step === "IDLE") {
    return { ok: false, error: "Aucune saisie en cours." };
  }
  const check = validateStepInput(session.step, raw);
  if (!check.ok) return { ok: false, error: check.error };

  const data = {
    ...((session.data as Record<string, unknown> | null) ?? {}),
  } as Record<string, unknown>;
  data[session.step.toLowerCase()] = check.number ?? check.value;

  const next = stepAfter(session.step);
  await db.telegramSession.update({
    where: { id: session.id },
    data: {
      step: next,
      data: data as Prisma.InputJsonValue,
      expiresAt: sessionExpiry(),
    },
  });
  return { ok: true, step: next };
}

// ───────────────────────── Product draft creation ─────────────────────────

/** URL-safe slug with a random suffix so a Telegram retry can never collide. */
function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "produit"}-${Math.random().toString(36).slice(2, 8)}`;
}

export type DraftInput = {
  name: string;
  description?: string;
  purchaseCost: number;
  sellingPrice: number;
  stock: number;
  sku?: string;
  category?: string;
  supplierRef?: string;
};

/**
 * Create a DRAFT product from ingested data.
 *
 * DRAFT is the whole point: the product is NOT sellable and NOT visible to any
 * partner until an Admin reviews it and sets it ACTIVE. Every import is audited
 * and the back office is notified in the same transaction.
 */
export async function createProductDraft(
  input: DraftInput,
  meta: { telegramUserId: string; sessionId?: string | null },
) {
  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        name: input.name,
        slug: slugify(input.name),
        description: input.description || null,
        // Costs default to the verified figures; packaging/delivery are unknown
        // from Telegram, so an Admin must set them before activation.
        purchaseCost: new Prisma.Decimal(input.purchaseCost.toFixed(3)),
        packagingCost: new Prisma.Decimal(0),
        deliveryCost: new Prisma.Decimal(0),
        sellingPrice: new Prisma.Decimal(input.sellingPrice.toFixed(3)),
        stockQuantity: input.stock,
        status: "DRAFT",
        source: "TELEGRAM",
        sku: input.sku || null,
        category: input.category || null,
        supplierRef: input.supplierRef || null,
        ingestedFrom: `telegram:${meta.telegramUserId}`,
      },
    });

    await recordAudit(tx, {
      actorId: null,
      action: "TELEGRAM_PRODUCT_IMPORTED",
      entityType: "Product",
      entityId: created.id,
      after: {
        name: created.name,
        source: "TELEGRAM",
        telegramUserId: meta.telegramUserId,
        status: "DRAFT",
        sellingPrice: created.sellingPrice.toString(),
        purchaseCost: created.purchaseCost.toString(),
        stock: created.stockQuantity,
      },
    });

    if (meta.sessionId) {
      await finishSession(tx, meta.sessionId, "COMPLETED", created.id);
    }

    await notifyBackOffice(tx, {
      type: "SYSTEM",
      title: "Nouveau produit à vérifier",
      body: `« ${created.name} » a été importé depuis Telegram et attend votre validation.`,
      link: `/produits/${created.id}`,
    });

    return created;
  });

  return product;
}
