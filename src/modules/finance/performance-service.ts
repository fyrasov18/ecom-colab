import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";
import {
  performanceLevelSchema,
  orderLevelsAsLadder,
  type PerformanceLevelInput,
} from "./performance-levels";

export class PerformanceLevelError extends Error {}

/** Ladder view for the admin settings screen. */
export async function listPerformanceLevels(opts: { includeInactive?: boolean } = {}) {
  const levels = await prisma.performanceLevel.findMany({
    where: opts.includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: "desc" }, { name: "asc" }],
    include: { _count: { select: { partners: true } } },
  });
  return orderLevelsAsLadder(levels);
}

export async function getPerformanceLevel(id: string) {
  return prisma.performanceLevel.findUnique({
    where: { id },
    include: { _count: { select: { partners: true } } },
  });
}

export async function createPerformanceLevel(
  input: PerformanceLevelInput,
  actorId: string,
) {
  const data = performanceLevelSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.performanceLevel.findUnique({
      where: { name: data.name },
    });
    if (existing) {
      throw new PerformanceLevelError(`Le niveau « ${data.name} » existe déjà.`);
    }
    const level = await tx.performanceLevel.create({
      data: {
        name: data.name,
        description: data.description || null,
        sharePercentage: new Prisma.Decimal(data.sharePercentage.toFixed(2)),
        criteria: (data.criteria ?? undefined) as Prisma.InputJsonValue | undefined,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
    });
    await recordAudit(tx, {
      actorId,
      action: "PERFORMANCE_LEVEL_CREATED",
      entityType: "PerformanceLevel",
      entityId: level.id,
      after: {
        name: level.name,
        sharePercentage: level.sharePercentage.toString(),
        isActive: level.isActive,
        sortOrder: level.sortOrder,
      },
    });
    return level;
  });
}
export async function updatePerformanceLevel(
  id: string,
  input: PerformanceLevelInput,
  actorId: string,
) {
  const data = performanceLevelSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const before = await tx.performanceLevel.findUniqueOrThrow({ where: { id } });
    // A share change is a financial-rule change: before/after are recorded so
    // the audit trail shows the exact transition. Existing orders are untouched
    // because each one carries its own frozen snapshot.
    const level = await tx.performanceLevel.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description || null,
        sharePercentage: new Prisma.Decimal(data.sharePercentage.toFixed(2)),
        ...(data.criteria !== undefined
          ? { criteria: data.criteria as Prisma.InputJsonValue }
          : {}),
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
    });
    await recordAudit(tx, {
      actorId,
      action: "PERFORMANCE_LEVEL_UPDATED",
      entityType: "PerformanceLevel",
      entityId: id,
      before: {
        name: before.name,
        sharePercentage: before.sharePercentage.toString(),
        isActive: before.isActive,
        sortOrder: before.sortOrder,
      },
      after: {
        name: level.name,
        sharePercentage: level.sharePercentage.toString(),
        isActive: level.isActive,
        sortOrder: level.sortOrder,
      },
    });
    return level;
  });
}

/**
 * Levels are never hard-deleted while a partner holds one: deactivation is the
 * safe lifecycle operation, and it stops affecting new orders immediately.
 */
export async function deletePerformanceLevel(id: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const level = await tx.performanceLevel.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { partners: true } } },
    });
    if (level._count.partners > 0) {
      throw new PerformanceLevelError(
        "Ce niveau est encore attribué à des partenaires. Désactivez-le plutôt que de le supprimer.",
      );
    }
    await tx.performanceLevel.delete({ where: { id } });
    await recordAudit(tx, {
      actorId,
      action: "PERFORMANCE_LEVEL_DELETED",
      entityType: "PerformanceLevel",
      entityId: id,
      before: { name: level.name, sharePercentage: level.sharePercentage.toString() },
    });
  });
}

/** Assign (or clear) a partner's performance tier. Audited. */
export async function assignPerformanceLevel(
  partnerId: string,
  performanceLevelId: string | null,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.partner.findUniqueOrThrow({
      where: { id: partnerId },
      select: { performanceLevelId: true },
    });
    if (performanceLevelId) {
      const level = await tx.performanceLevel.findUniqueOrThrow({
        where: { id: performanceLevelId },
      });
      if (!level.isActive) {
        throw new PerformanceLevelError("Impossible d'attribuer un niveau inactif.");
      }
    }
    const partner = await tx.partner.update({
      where: { id: partnerId },
      data: { performanceLevelId },
      include: { performanceLevel: true },
    });
    await recordAudit(tx, {
      actorId,
      action: "PARTNER_LEVEL_CHANGED",
      entityType: "Partner",
      entityId: partnerId,
      before: { performanceLevelId: before.performanceLevelId },
      after: {
        performanceLevelId,
        performanceLevelName: partner.performanceLevel?.name ?? null,
      },
    });
    return partner;
  });
}

/** Active level for a partner — read inside the order transaction. */
export async function readPartnerLevel(
  db: Prisma.TransactionClient | typeof prisma,
  partnerId: string,
) {
  const partner = await db.partner.findUnique({
    where: { id: partnerId },
    select: {
      performanceLevel: {
        select: { id: true, name: true, sharePercentage: true, isActive: true },
      },
    },
  });
  return partner?.performanceLevel ?? null;
}

