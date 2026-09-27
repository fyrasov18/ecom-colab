import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type AuditFilters = {
  q?: string;
  entityType?: string;
  action?: string;
  actorId?: string;
  page?: number;
  pageSize?: number;
};

export async function listAuditLogs(filters: AuditFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 30));
  const skip = (page - 1) * pageSize;

  const where: Prisma.AuditLogWhereInput = {};

  if (filters.entityType && filters.entityType !== "ALL") {
    where.entityType = filters.entityType;
  }

  if (filters.action && filters.action !== "ALL") {
    where.action = filters.action;
  }

  if (filters.actorId) {
    where.actorId = filters.actorId;
  }

  if (filters.q && filters.q.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { action: { contains: q, mode: "insensitive" } },
      { entityType: { contains: q, mode: "insensitive" } },
      { entityId: { contains: q, mode: "insensitive" } },
      {
        actor: {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  const [total, items, distinctActions, distinctEntities] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
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
    }),
    prisma.auditLog.findMany({
      select: { action: true },
      distinct: ["action"],
      orderBy: { action: "asc" },
    }),
    prisma.auditLog.findMany({
      select: { entityType: true },
      distinct: ["entityType"],
      orderBy: { entityType: "asc" },
    }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    availableActions: distinctActions.map((a) => a.action),
    availableEntityTypes: distinctEntities.map((e) => e.entityType),
  };
}
