import { Prisma, PartnerStatus, SocialPlatform } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";
import { notify, notifyPartnerApproved } from "@/modules/notifications/service";
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
    select: { id: true, displayName: true, code: true, performanceLevelId: true },
  });
  return partners;
}

export async function listPartnersWithoutLevel() {
  const partners = await prisma.partner.findMany({
    where: { status: "ACTIVE", performanceLevelId: null },
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

    // When approving a partner (PENDING -> ACTIVE), notify the partner and their referring partner
    if (before.status === "PENDING" && status === "ACTIVE") {
      const attribution = await tx.referralAttribution.findUnique({
        where: { referredPartnerId: partnerId },
        include: { referrerPartner: { select: { userId: true } } },
      });
      const referrerUserId = attribution?.referrerPartner?.userId ?? null;
      await notifyPartnerApproved(tx, {
        partnerId: partner.id,
        partnerUserId: partner.userId,
        partnerName: partner.displayName,
        referrerUserId,
      });
    }

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
        commissionType: opts.allowCommission ? commissionData.commissionType : (existing?.commissionType ?? null),
        commissionValue: opts.allowCommission ? commissionData.commissionValue : (existing?.commissionValue ? String(existing.commissionValue) : null),
      },
      update: {
        status: "ACTIVE",
        deactivatedAt: null,
        commissionType: opts.allowCommission ? commissionData.commissionType : (existing?.commissionType ?? null),
        commissionValue: opts.allowCommission ? commissionData.commissionValue : (existing?.commissionValue ? String(existing.commissionValue) : null),
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

    // ── Automatic Notification upon Assignment (Requirement 1) ──
    // Notify the partner when a product is assigned or reactivated.
    // Avoid duplicate notifications if already active or if an unread notification for this product exists.
    const isNewOrReactivated = !existing || existing.status !== "ACTIVE";
    const txNotification = (tx as unknown as { notification?: { create?: unknown } }).notification;
    if (isNewOrReactivated && typeof txNotification?.create === "function") {
      const partner = await tx.partner.findUnique({
        where: { id: parsed.partnerId },
        select: { id: true, userId: true },
      });
      const product = await tx.product.findUnique({
        where: { id: parsed.productId },
        select: { id: true, name: true },
      });

      if (partner?.userId && product) {
        const targetLink = `/catalogue/${product.id}`;
        const existingUnread = await tx.notification.findFirst({
          where: {
            userId: partner.userId,
            link: targetLink,
            readAt: null,
          },
        });

        if (!existingUnread) {
          const now = new Date();
          const formattedDate = now.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          const formattedTime = now.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          });
          const timestampStr = `le ${formattedDate} à ${formattedTime}`;

          await notify(tx, {
            userId: partner.userId,
            type: "SYSTEM",
            title: `Nouveau produit assigné : ${product.name}`,
            body: `Un nouveau produit vous a été assigné (${timestampStr}) ! Découvrez "${product.name}" dès maintenant dans votre catalogue.`,
            link: targetLink,
          });
        }
      }
    }

    return assignment;
  });
}

export type AssignmentTargetType = "ALL" | "BY_LEVEL" | "INDIVIDUAL" | "NO_LEVEL";

export async function assignProductWithTarget(
  input: {
    productId: string;
    targetType: AssignmentTargetType;
    partnerId?: string | null;
    performanceLevelId?: string | null;
    commissionType?: "PERCENTAGE" | "FIXED" | null;
    commissionValue?: number | null;
  },
  actorId: string,
  opts: { allowCommission: boolean },
) {
  const { productId, targetType, partnerId, performanceLevelId, commissionType, commissionValue } = input;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true },
  });
  if (!product) {
    throw new Error("Produit introuvable.");
  }

  // 1. Resolve eligible active partners server-side based on targetType
  let eligiblePartners: { id: string; userId: string | null }[] = [];

  if (targetType === "INDIVIDUAL") {
    if (!partnerId) {
      throw new Error("Veuillez sélectionner un partenaire.");
    }
    const partner = await prisma.partner.findFirst({
      where: { id: partnerId, status: "ACTIVE" },
      select: { id: true, userId: true },
    });
    if (!partner) {
      throw new Error("Partenaire introuvable ou inactif.");
    }
    eligiblePartners = [partner];
  } else if (targetType === "ALL") {
    eligiblePartners = await prisma.partner.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, userId: true },
    });
  } else if (targetType === "BY_LEVEL") {
    if (!performanceLevelId) {
      throw new Error("Veuillez sélectionner un niveau de performance.");
    }
    eligiblePartners = await prisma.partner.findMany({
      where: { status: "ACTIVE", performanceLevelId },
      select: { id: true, userId: true },
    });
  } else if (targetType === "NO_LEVEL") {
    // Explicitly target only partners whose performance level is NULL / not defined
    eligiblePartners = await prisma.partner.findMany({
      where: { status: "ACTIVE", performanceLevelId: null },
      select: { id: true, userId: true },
    });
  } else {
    throw new Error("Type de ciblage non valide.");
  }

  if (eligiblePartners.length === 0) {
    return {
      assignedCount: 0,
      alreadyAssignedCount: 0,
      totalEligible: 0,
    };
  }

  // 2. Identify partners who already have an ACTIVE assignment for this product
  const existingActive = await prisma.partnerProduct.findMany({
    where: {
      productId,
      partnerId: { in: eligiblePartners.map((p) => p.id) },
      status: "ACTIVE",
    },
    select: { partnerId: true },
  });
  const alreadyAssignedSet = new Set(existingActive.map((e) => e.partnerId));

  // 3. For individual target with commission modification, allow updating existing assignment
  if (targetType === "INDIVIDUAL" && alreadyAssignedSet.has(eligiblePartners[0].id)) {
    await assignProductToPartner(
      {
        partnerId: eligiblePartners[0].id,
        productId,
        commissionType: commissionType ?? null,
        commissionValue: commissionValue ?? null,
      },
      actorId,
      opts,
    );
    return {
      assignedCount: 1,
      alreadyAssignedCount: 1,
      totalEligible: 1,
    };
  }

  // 4. Assign only unassigned partners to prevent duplicates and spam
  const toAssign = eligiblePartners.filter((p) => !alreadyAssignedSet.has(p.id));

  for (const p of toAssign) {
    await assignProductToPartner(
      {
        partnerId: p.id,
        productId,
        commissionType: targetType === "INDIVIDUAL" ? (commissionType ?? null) : null,
        commissionValue: targetType === "INDIVIDUAL" ? (commissionValue ?? null) : null,
      },
      actorId,
      opts,
    );
  }

  return {
    assignedCount: toAssign.length,
    alreadyAssignedCount: alreadyAssignedSet.size,
    totalEligible: eligiblePartners.length,
  };
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

/**
 * Permanently deletes a partner and cleanly cleans up all associated test data
 * (orders, transactions, wallet, referral data, assignments, user account).
 */
export async function deletePartner(partnerId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const partner = await tx.partner.findUnique({
      where: { id: partnerId },
      include: {
        user: true,
        orders: { select: { id: true } },
      },
    });

    if (!partner) {
      throw new Error("Partenaire introuvable.");
    }

    const orderIds = partner.orders.map((o) => o.id);

    // 1. Delete all commissions and transactions referencing this partner's orders
    if (orderIds.length > 0) {
      await tx.referralCommission.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await tx.financialTransaction.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await tx.orderItem.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await tx.orderStatusHistory.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await tx.return.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await tx.shipment.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await tx.order.deleteMany({
        where: { id: { in: orderIds } },
      });
    }

    // 2. Delete referral commissions where partner is referrer or attached to their attributions
    await tx.referralCommission.deleteMany({
      where: {
        OR: [
          { referrerPartnerId: partnerId },
          {
            attribution: {
              OR: [
                { referrerPartnerId: partnerId },
                { referredPartnerId: partnerId },
              ],
            },
          },
        ],
      },
    });

    // 3. Delete referral attributions
    await tx.referralAttribution.deleteMany({
      where: {
        OR: [
          { referrerPartnerId: partnerId },
          { referredPartnerId: partnerId },
        ],
      },
    });

    // 4. Delete referral links
    await tx.referralLink.deleteMany({
      where: { partnerId },
    });

    // 5. Delete financial transactions & withdrawals
    await tx.financialTransaction.deleteMany({
      where: { partnerId },
    });
    await tx.withdrawal.deleteMany({
      where: { partnerId },
    });

    // 6. Delete wallet, partner products, socials, popup events
    await tx.wallet.deleteMany({
      where: { partnerId },
    });
    await tx.partnerProduct.deleteMany({
      where: { partnerId },
    });
    await tx.partnerSocialAccount.deleteMany({
      where: { partnerId },
    });
    await tx.partnerPopupEvent.deleteMany({
      where: { partnerId },
    });

    // 7. Delete customers owned by this partner
    const customers = await tx.customer.findMany({
      where: { ownerPartnerId: partnerId },
      select: { id: true },
    });
    const customerIds = customers.map((c) => c.id);
    if (customerIds.length > 0) {
      await tx.order.deleteMany({
        where: { customerId: { in: customerIds } },
      });
      await tx.customer.deleteMany({
        where: { id: { in: customerIds } },
      });
    }

    // 8. Clean up User references if user exists
    if (partner.userId) {
      await tx.auditLog.updateMany({
        where: { actorId: partner.userId },
        data: { actorId: null },
      });
      await tx.orderStatusHistory.updateMany({
        where: { changedById: partner.userId },
        data: { changedById: null },
      });
      await tx.financialTransaction.updateMany({
        where: { createdById: partner.userId },
        data: { createdById: null },
      });
      await tx.notification.deleteMany({
        where: { userId: partner.userId },
      });
    }

    // 9. Record audit log
    await recordAudit(tx, {
      actorId,
      action: "PARTNER_DELETED",
      entityType: "Partner",
      entityId: partnerId,
      before: {
        code: partner.code,
        displayName: partner.displayName,
        email: partner.user?.email,
      },
    });

    // 10. Delete partner & user
    await tx.partner.delete({
      where: { id: partnerId },
    });

    if (partner.userId) {
      await tx.user.delete({
        where: { id: partner.userId },
      });
    }

    return partner;
  });
}

