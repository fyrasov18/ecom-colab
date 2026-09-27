import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

export type AuditEntry = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Append-only audit record. Pass the active transaction client to
 * make the audit atomic with the business operation.
 */
export async function recordAudit(db: Db, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      before: entry.before === undefined || entry.before === null
        ? Prisma.JsonNull
        : (entry.before as Prisma.InputJsonValue),
      after: entry.after === undefined || entry.after === null
        ? Prisma.JsonNull
        : (entry.after as Prisma.InputJsonValue),
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}

/** Convenience wrapper using the global client (outside a transaction). */
export async function audit(entry: AuditEntry): Promise<void> {
  await recordAudit(prisma, entry);
}
