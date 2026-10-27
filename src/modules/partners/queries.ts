import type { PartnerStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Partner row behind a signed-in partner user (commission defaults, code, …). */
export async function getPartnerById(partnerId: string) {
  return prisma.partner.findUniqueOrThrow({ where: { id: partnerId } });
}

/** Minimal status lookup for the RBAC gate — no sensitive fields. */
export async function getPartnerStatus(partnerId: string): Promise<PartnerStatus | null> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { status: true },
  });
  return partner?.status ?? null;
}

