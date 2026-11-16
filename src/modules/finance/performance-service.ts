import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";
import {
  performanceLevelSchema,
  orderLevelsAsLadder,
  evaluateLevelCriteria,
  calculatePerformanceScore,
  type PerformanceLevelInput,
  type PartnerMetrics,
  type CriteriaEvaluation,
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
  options?: { reason?: string },
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.partner.findUniqueOrThrow({
      where: { id: partnerId },
      select: { performanceLevelId: true, userId: true },
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
        reason: options?.reason ?? null,
      },
    });

    // ── AUTOMATIC PERFORMANCE LEVEL UPGRADE ALERT ──
    if (performanceLevelId && performanceLevelId !== before.performanceLevelId) {
      const prevLevel = before.performanceLevelId
        ? await tx.performanceLevel.findUnique({
            where: { id: before.performanceLevelId },
          })
        : null;
      const nextLevel = partner.performanceLevel;

      if (nextLevel) {
        const prevOrder = prevLevel?.sortOrder ?? -1;
        const nextOrder = nextLevel.sortOrder;
        const prevShare = prevLevel ? Number(prevLevel.sharePercentage) : -1;
        const nextShare = Number(nextLevel.sharePercentage);

        // Upgrade condition: moving up the ladder (higher sortOrder, or equal sortOrder with higher share)
        const isUpgrade =
          !prevLevel ||
          nextOrder > prevOrder ||
          (nextOrder === prevOrder && nextShare > prevShare);

        if (isUpgrade) {
          const { queuePerformanceLevelUpgrade } = await import(
            "@/modules/announcements/service"
          );
          await queuePerformanceLevelUpgrade(
            {
              partnerId,
              previousLevelName: prevLevel?.name ?? "Standard",
              newLevelName: nextLevel.name,
              previousSortOrder: prevOrder >= 0 ? prevOrder : undefined,
              newSortOrder: nextOrder,
              newSharePercentage: nextShare,
              description: nextLevel.description ?? undefined,
              actorId,
            },
            tx,
          );
        }
      }
    }

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

/** Retrieve complete history of partner level assignments from AuditLog. */
export async function getPartnerLevelHistory(partnerId: string) {
  const logs = await prisma.auditLog.findMany({
    where: {
      entityType: "Partner",
      entityId: partnerId,
      action: "PARTNER_LEVEL_CHANGED",
    },
    include: {
      actor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return logs.map((log) => {
    const before = (log.before as { performanceLevelId?: string | null }) ?? {};
    const after = (log.after as {
      performanceLevelId?: string | null;
      performanceLevelName?: string | null;
      reason?: string | null;
    }) ?? {};

    return {
      id: log.id,
      createdAt: log.createdAt,
      actorName: log.actor
        ? `${log.actor.firstName} ${log.actor.lastName}`.trim() || log.actor.email
        : "Système",
      previousLevelId: before.performanceLevelId ?? null,
      newLevelId: after.performanceLevelId ?? null,
      newLevelName: after.performanceLevelName ?? null,
      reason: after.reason ?? null,
    };
  });
}

export type PartnerPerformanceOverviewDTO = {
  id: string;
  code: string;
  displayName: string;
  phone: string | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  metrics: PartnerMetrics;
  score: number;
  currentLevel: {
    id: string;
    name: string;
    sortOrder: number;
    sharePercentage: number;
    criteria: unknown;
    isActive: boolean;
  } | null;
  nextLevel: {
    id: string;
    name: string;
    sortOrder: number;
    sharePercentage: number;
    criteria: unknown;
    isActive: boolean;
  } | null;
  eligibleLevel: {
    id: string;
    name: string;
    sortOrder: number;
    sharePercentage: number;
    criteria: unknown;
    isActive: boolean;
  } | null;
  canPromote: boolean;
  nextLevelProgress: CriteriaEvaluation | null;
};

/**
 * Fetch all partners with real-time operational metrics and evaluation against
 * performance level criteria thresholds.
 */
export async function getPartnersPerformanceOverview(): Promise<PartnerPerformanceOverviewDTO[]> {
  const [levels, partners, orderGroups, deliveredOrders] = await Promise.all([
    listPerformanceLevels({ includeInactive: false }),
    prisma.partner.findMany({
      where: { status: "ACTIVE" },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        performanceLevel: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.groupBy({
      by: ["partnerId", "status"],
      _count: { _all: true },
    }),
    prisma.order.findMany({
      where: { status: "DELIVERED" },
      select: { partnerId: true, unitSellingPrice: true, quantity: true },
    }),
  ]);

  const countsByPartner = new Map<string, Record<string, number>>();
  for (const g of orderGroups) {
    if (!countsByPartner.has(g.partnerId)) {
      countsByPartner.set(g.partnerId, {});
    }
    countsByPartner.get(g.partnerId)![g.status] = g._count._all;
  }

  const turnoverByPartner = new Map<string, number>();
  for (const ord of deliveredOrders) {
    const current = turnoverByPartner.get(ord.partnerId) ?? 0;
    const lineAmount = Number(ord.unitSellingPrice) * ord.quantity;
    turnoverByPartner.set(ord.partnerId, current + lineAmount);
  }

  // Ladder ascending for finding the immediate next level
  const levelsAsc = [...levels].sort((a, b) => a.sortOrder - b.sortOrder);

  return partners.map((partner) => {
    const counts = countsByPartner.get(partner.id) ?? {};
    const totalOrders = Object.values(counts).reduce((a, b) => a + b, 0);
    const cancelledOrders = counts.CANCELLED ?? 0;
    const deliveredOrdersCount = counts.DELIVERED ?? 0;
    const returnedOrRefused = (counts.REFUSED ?? 0) + (counts.RETURNED ?? 0);
    const resolved = deliveredOrdersCount + returnedOrRefused;
    const deliveryRate = resolved > 0 ? Math.round((deliveredOrdersCount / resolved) * 100) : 0;
    const returnRate = resolved > 0 ? Math.round((returnedOrRefused / resolved) * 100) : 0;
    const confirmationRate =
      totalOrders > 0 ? Math.round(((totalOrders - cancelledOrders) / totalOrders) * 100) : 0;
    const turnover = Math.round((turnoverByPartner.get(partner.id) ?? 0) * 1000) / 1000;

    const metrics: PartnerMetrics = {
      totalOrders,
      deliveredOrders: deliveredOrdersCount,
      deliveryRate,
      confirmationRate,
      returnRate,
      turnover,
    };

    const score = calculatePerformanceScore(metrics);

    const currentSortOrder = partner.performanceLevel?.sortOrder ?? -1;

    // Next higher level in the hierarchy
    const nextLevel = levelsAsc.find((l) => l.sortOrder > currentSortOrder) ?? null;

    // Highest tier the partner currently qualifies for
    // `levels` is already sorted by sortOrder desc
    const eligibleLevel =
      levels.find((l) => evaluateLevelCriteria(metrics, l.criteria).isEligible) ?? null;

    const canPromote =
      eligibleLevel !== null &&
      (!partner.performanceLevel ||
        (eligibleLevel.id !== partner.performanceLevel.id &&
          eligibleLevel.sortOrder > currentSortOrder));

    const targetForProgress = nextLevel ?? eligibleLevel;
    const nextLevelProgress = targetForProgress
      ? evaluateLevelCriteria(metrics, targetForProgress.criteria)
      : null;

    return {
      id: partner.id,
      code: partner.code,
      displayName: partner.displayName,
      phone: partner.phone,
      user: partner.user,
      metrics,
      score,
      currentLevel: partner.performanceLevel
        ? {
            id: partner.performanceLevel.id,
            name: partner.performanceLevel.name,
            sortOrder: partner.performanceLevel.sortOrder,
            sharePercentage: Number(partner.performanceLevel.sharePercentage),
            criteria: partner.performanceLevel.criteria,
            isActive: partner.performanceLevel.isActive,
          }
        : null,
      nextLevel: nextLevel
        ? {
            id: nextLevel.id,
            name: nextLevel.name,
            sortOrder: nextLevel.sortOrder,
            sharePercentage: Number(nextLevel.sharePercentage),
            criteria: nextLevel.criteria,
            isActive: nextLevel.isActive,
          }
        : null,
      eligibleLevel: eligibleLevel
        ? {
            id: eligibleLevel.id,
            name: eligibleLevel.name,
            sortOrder: eligibleLevel.sortOrder,
            sharePercentage: Number(eligibleLevel.sharePercentage),
            criteria: eligibleLevel.criteria,
            isActive: eligibleLevel.isActive,
          }
        : null,
      canPromote,
      nextLevelProgress,
    };
  });
}

/**
 * Automatically evaluate all active partners (or a selected list) and promote
 * those who meet the eligibility criteria for a higher level.
 */
export async function evaluateAndPromoteEligiblePartners(
  actorId: string,
  partnerIds?: string[],
) {
  const overview = await getPartnersPerformanceOverview();
  const candidates = overview.filter((p) => {
    if (!p.canPromote || !p.eligibleLevel) return false;
    if (partnerIds && partnerIds.length > 0) {
      return partnerIds.includes(p.id);
    }
    return true;
  });

  const promoted: Array<{ partnerId: string; partnerName: string; newLevelName: string }> = [];

  for (const c of candidates) {
    if (c.eligibleLevel) {
      await assignPerformanceLevel(c.id, c.eligibleLevel.id, actorId, {
        reason: "Promotion automatique basée sur les critères de performance",
      });
      promoted.push({
        partnerId: c.id,
        partnerName: c.displayName,
        newLevelName: c.eligibleLevel.name,
      });
    }
  }

  return { promotedCount: promoted.length, promoted };
}

