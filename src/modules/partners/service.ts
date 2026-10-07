import { Prisma, PartnerStatus, SocialPlatform } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";
import { assignProductSchema, socialAccountSchema } from "./schemas";

const PAGE_SIZE = 20;

export type PartnerFilters = {
  search?: string;
  status?: PartnerStatus;
  page?: number;
};

export async function listPartners(filters: PartnerFilters = {}) {
  const { search, status, page = 1 } = filters;
  const where: Prisma.PartnerWhereInput = {
    AND: [
      status ? { status } : {},
      search
        ? {
            OR: [
              { displayName: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
              { user: { email: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {},
    ],
  };

  const [total, items] = await Promise.all([
    prisma.partner.count({ where }),
    prisma.partner.findMany({
      where,
      // id tie-breaker: stable total order across pages on createdAt ties.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { email: true, status: true } },
        wallet: true,
        _count: { select: { assignedProducts: true, orders: true } },
      },
    }),
  ]);

  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function listPartnerOptions() {
  const partners = await prisma.partner.findMany({
    where: { status: "ACTIVE" },
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true, code: true },
  });
  return partners;
}

export async function getPartnerAdmin(id: string) {
  return prisma.partner.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, status: true, firstName: true, lastName: true } },
      invitedBy: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      socialAccounts: { orderBy: { createdAt: "asc" } },
      wallet: true,
      performanceLevel: {
        select: { id: true, name: true, sharePercentage: true, isActive: true },
      },
      assignedProducts: {
        where: { status: "ACTIVE" },
        include: { product: { select: { id: true, name: true, status: true, sellingPrice: true } } },
        orderBy: { assignedAt: "asc" },
      },
      _count: { select: { orders: true, customers: true } },
    },
  });
}

export async function setPartnerStatus(
  partnerId: string,
  status: PartnerStatus,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.partner.findUniqueOrThrow({ where: { id: partnerId } });
    const partner = await tx.partner.update({ where: { id: partnerId }, data: { status } });
    await recordAudit(tx, {
      actorId,
      action: "PARTNER_STATUS_CHANGED",
      entityType: "Partner",
      entityId: partnerId,
      before: { status: before.status },
      after: { status: partner.status },
    });
    return partner;
  });
}

export async function addSocialAccount(
  partnerId: string,
  input: { platform: SocialPlatform; label: string; url: string },
  actorId: string,
) {
  const data = socialAccountSchema.parse(input);
  const account = await prisma.partnerSocialAccount.create({
    data: { partnerId, ...data },
  });
  await recordAudit(prisma, {
    actorId,
    action: "PARTNER_SOCIAL_ADDED",
    entityType: "PartnerSocialAccount",
    entityId: account.id,
    after: { partnerId, platform: data.platform, url: data.url },
  });
  return account;
}

export async function removeSocialAccount(id: string, actorId: string) {
  const account = await prisma.partnerSocialAccount.findUniqueOrThrow({ where: { id } });
  await prisma.partnerSocialAccount.delete({ where: { id } });
  await recordAudit(prisma, {
    actorId,
    action: "PARTNER_SOCIAL_REMOVED",
    entityType: "PartnerSocialAccount",
    entityId: id,
    before: { partnerId: account.partnerId, platform: account.platform, url: account.url },
  });
}

// ── Product assignments ──

export async function assignProductToPartner(
  input: {
    partnerId: string;
    productId: string;
    commissionType: "PERCENTAGE" | "FIXED" | null;
    commissionValue: number | null;
  },
  actorId: string,
  opts: { allowCommission: boolean },
) {
  const parsed = assignProductSchema.parse(input);
  if ((parsed.commissionType == null) !== (parsed.commissionValue == null)) {
    throw new Error("Type et valeur de commission doivent être définis ensemble.");
  }
  if (parsed.commissionType === "PERCENTAGE" && (parsed.commissionValue ?? 0) > 100) {
    throw new Error("Le pourcentage ne peut pas dépasser 100.");
  }
  // Commission overrides are SUPER_ADMIN only (sensitive financial rule).
  const useCommission = opts.allowCommission && parsed.commissionType != null;
  const commissionData = {
    commissionType: useCommission ? parsed.commissionType : null,
    commissionValue: useCommission && parsed.commissionValue != null ? String(parsed.commissionValue) : null,
  };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.partnerProduct.findUnique({
      where: {
        partnerId_productId: { partnerId: parsed.partnerId, productId: parsed.productId },
      },
    });
    const assignment = await tx.partnerProduct.upsert({
      where: {
        partnerId_productId: { partnerId: parsed.partnerId, productId: parsed.productId },
      },
      create: {
        partnerId: parsed.partnerId,
        productId: parsed.productId,
        status: "ACTIVE",
        commissionType: commissionData.commissionType,
        commissionValue: commissionData.commissionValue,
      },
      update: {
        status: "ACTIVE",
        deactivatedAt: null,
        commissionType: commissionData.commissionType,
        commissionValue: commissionData.commissionValue,
      },
    });
    await recordAudit(tx, {
      actorId,
      action: existing ? "ASSIGNMENT_UPDATED" : "ASSIGNMENT_CREATED",
      entityType: "PartnerProduct",
      entityId: assignment.id,
      before: existing
        ? {
            status: existing.status,
            commissionType: existing.commissionType,
            commissionValue: existing.commissionValue,
          }
        : null,
      after: {
        partnerId: parsed.partnerId,
        productId: parsed.productId,
        status: assignment.status,
        commissionType: assignment.commissionType,
        commissionValue: assignment.commissionValue,
      },
    });
    return assignment;
  });
}

export async function deactivateAssignment(
  partnerId: string,
  productId: string,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.partnerProduct.findUniqueOrThrow({
      where: { partnerId_productId: { partnerId, productId } },
    });
    const assignment = await tx.partnerProduct.update({
      where: { partnerId_productId: { partnerId, productId } },
      data: { status: "INACTIVE", deactivatedAt: new Date() },
    });
    await recordAudit(tx, {
      actorId,
      action: "ASSIGNMENT_DEACTIVATED",
      entityType: "PartnerProduct",
      entityId: assignment.id,
      before: { status: before.status },
      after: { status: assignment.status },
    });
    return assignment;
  });
}

