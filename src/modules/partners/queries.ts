import { prisma } from "@/lib/prisma";

/** Partner row behind a signed-in partner user (commission defaults, code, …). */
export async function getPartnerById(partnerId: string) {
  return prisma.partner.findUniqueOrThrow({ where: { id: partnerId } });
}
