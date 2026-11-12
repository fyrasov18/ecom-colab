import { Prisma, ProductStatus, type ProductSuggestionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify, notifyBackOffice } from "@/modules/notifications/service";
import { slugify } from "@/modules/products/schemas";
import {
  suggestionSubmissionSchema,
  suggestionStatusUpdateSchema,
  linkProductSuggestionSchema,
  createProductFromSuggestionSchema,
  type SuggestionSubmissionInput,
  type SuggestionStatusUpdateInput,
} from "./schemas";
import type {
  PartnerSuggestionListItem,
  PartnerSuggestionDetail,
  AdminSuggestionListItem,
  AdminSuggestionDetail,
  ContributionAnalytics,
  GlobalContributionMetrics,
  PartnerContributionMetric,
} from "./types";

/**
 * Submit a new product suggestion by a partner.
 */
export async function createSuggestion(
  partnerId: string,
  rawInput: SuggestionSubmissionInput,
) {
  const validated = suggestionSubmissionSchema.parse(rawInput);

  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });

  if (!partner) {
    throw new Error("Partenaire introuvable.");
  }

  if (partner.status !== "ACTIVE") {
    throw new Error("Seuls les partenaires actifs peuvent soumettre des suggestions de produits.");
  }

  return prisma.$transaction(async (tx) => {
    const suggestion = await tx.productSuggestion.create({
      data: {
        partnerId: partner.id,
        name: validated.name,
        estimatedSellingPrice: new Prisma.Decimal(validated.estimatedSellingPrice),
        imageUrl: validated.imageUrl,
        images: validated.images && validated.images.length > 0 ? validated.images : undefined,
        description: validated.description || null,
        estimatedPurchasePrice: validated.estimatedPurchasePrice
          ? new Prisma.Decimal(validated.estimatedPurchasePrice)
          : null,
        supplierName: validated.supplierName || null,
        supplierContact: validated.supplierContact || null,
        supplierUrl: validated.supplierUrl || null,
        characteristics: validated.characteristics || null,
        targetAudience: validated.targetAudience || null,
        partnerReason: validated.partnerReason || null,
        additionalNotes: validated.additionalNotes || null,
        status: "PENDING",
      },
    });

    // Create initial history log
    await tx.productSuggestionHistory.create({
      data: {
        suggestionId: suggestion.id,
        previousStatus: null,
        newStatus: "PENDING",
        actorId: partner.userId,
        actorName:
          partner.displayName ||
          `${partner.user.firstName} ${partner.user.lastName}`.trim() ||
          "Partenaire",
        feedback: "Suggestion de produit soumise avec succès.",
      },
    });

    // Send confirmation notification to partner
    await notify(tx, {
      userId: partner.userId,
      type: "SYSTEM",
      title: "Suggestion de produit enregistrée",
      body: `Votre suggestion « ${suggestion.name} » a été transmise à l'équipe avec succès.`,
      link: `/suggestions-produits/${suggestion.id}`,
    });

    // Send operational alert to Administrators
    await notifyBackOffice(tx, {
      type: "SYSTEM",
      title: "Nouvelle suggestion de produit",
      body: `${partner.displayName} (${partner.code}) a suggéré le produit « ${suggestion.name} ».`,
      link: `/produits/suggestions/${suggestion.id}`,
    });

    return suggestion;
  });
}

/**
 * List suggestions submitted by a specific partner.
 * Strictly omits internal administrative notes to prevent data leaks.
 */
export async function listPartnerSuggestions(
  partnerId: string,
  options?: { status?: ProductSuggestionStatus; search?: string },
): Promise<PartnerSuggestionListItem[]> {
  const where: Prisma.ProductSuggestionWhereInput = {
    partnerId,
    ...(options?.status ? { status: options.status } : {}),
    ...(options?.search
      ? {
          name: { contains: options.search, mode: "insensitive" },
        }
      : {}),
  };

  const items = await prisma.productSuggestion.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      estimatedSellingPrice: true,
      estimatedPurchasePrice: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      partnerFeedback: true,
      productId: true,
      product: {
        select: {
          name: true,
        },
      },
    },
  });

  return items.map((i) => ({
    id: i.id,
    name: i.name,
    imageUrl: i.imageUrl,
    estimatedSellingPrice: Number(i.estimatedSellingPrice),
    estimatedPurchasePrice: i.estimatedPurchasePrice ? Number(i.estimatedPurchasePrice) : null,
    status: i.status,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
    partnerFeedback: i.partnerFeedback,
    productId: i.productId,
    productName: i.product?.name ?? null,
  }));
}

/**
 * Get detailed view of a suggestion for a partner.
 * Strictly verifies partner ownership and omits internalNotes.
 */
export async function getPartnerSuggestion(
  partnerId: string,
  suggestionId: string,
): Promise<PartnerSuggestionDetail | null> {
  const suggestion = await prisma.productSuggestion.findFirst({
    where: {
      id: suggestionId,
      partnerId,
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          sellingPrice: true,
          stockQuantity: true,
          status: true,
        },
      },
      history: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          previousStatus: true,
          newStatus: true,
          actorName: true,
          feedback: true,
          createdAt: true,
        },
      },
    },
  });

  if (!suggestion) return null;

  const rawImages = suggestion.images;
  const images: string[] = Array.isArray(rawImages)
    ? rawImages.filter((x): x is string => typeof x === "string")
    : [];

  return {
    id: suggestion.id,
    name: suggestion.name,
    imageUrl: suggestion.imageUrl,
    images: images.length > 0 ? images : [suggestion.imageUrl],
    estimatedSellingPrice: Number(suggestion.estimatedSellingPrice),
    estimatedPurchasePrice: suggestion.estimatedPurchasePrice
      ? Number(suggestion.estimatedPurchasePrice)
      : null,
    description: suggestion.description,
    supplierName: suggestion.supplierName,
    supplierContact: suggestion.supplierContact,
    supplierUrl: suggestion.supplierUrl,
    characteristics: suggestion.characteristics,
    targetAudience: suggestion.targetAudience,
    partnerReason: suggestion.partnerReason,
    additionalNotes: suggestion.additionalNotes,
    status: suggestion.status,
    partnerFeedback: suggestion.partnerFeedback,
    statusUpdatedAt: suggestion.statusUpdatedAt?.toISOString() ?? null,
    createdAt: suggestion.createdAt.toISOString(),
    updatedAt: suggestion.updatedAt.toISOString(),
    productId: suggestion.productId,
    productCreatedAt: suggestion.productCreatedAt?.toISOString() ?? null,
    linkedProduct: suggestion.product
      ? {
          id: suggestion.product.id,
          name: suggestion.product.name,
          slug: suggestion.product.slug,
          sellingPrice: Number(suggestion.product.sellingPrice),
          stockQuantity: suggestion.product.stockQuantity,
          status: suggestion.product.status,
        }
      : null,
    history: suggestion.history.map((h) => ({
      id: h.id,
      previousStatus: h.previousStatus,
      newStatus: h.newStatus,
      actorName: h.actorName,
      feedback: h.feedback,
      createdAt: h.createdAt.toISOString(),
    })),
  };
}

/**
 * List all suggestions for Administrators with search & filtering.
 */
export async function listAdminSuggestions(filter?: {
  status?: ProductSuggestionStatus;
  search?: string;
  partnerId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<AdminSuggestionListItem[]> {
  const where: Prisma.ProductSuggestionWhereInput = {
    ...(filter?.status ? { status: filter.status } : {}),
    ...(filter?.partnerId ? { partnerId: filter.partnerId } : {}),
    ...(filter?.startDate || filter?.endDate
      ? {
          createdAt: {
            ...(filter.startDate ? { gte: new Date(filter.startDate) } : {}),
            ...(filter.endDate ? { lte: new Date(filter.endDate) } : {}),
          },
        }
      : {}),
    ...(filter?.search
      ? {
          OR: [
            { name: { contains: filter.search, mode: "insensitive" } },
            { partner: { displayName: { contains: filter.search, mode: "insensitive" } } },
            { partner: { code: { contains: filter.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const items = await prisma.productSuggestion.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      partner: {
        select: {
          id: true,
          code: true,
          displayName: true,
          phone: true,
        },
      },
      product: {
        select: {
          name: true,
        },
      },
    },
  });

  return items.map((i) => ({
    id: i.id,
    name: i.name,
    imageUrl: i.imageUrl,
    estimatedSellingPrice: Number(i.estimatedSellingPrice),
    estimatedPurchasePrice: i.estimatedPurchasePrice ? Number(i.estimatedPurchasePrice) : null,
    status: i.status,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
    partner: {
      id: i.partner.id,
      code: i.partner.code,
      displayName: i.partner.displayName,
      phone: i.partner.phone,
    },
    productId: i.productId,
    productName: i.product?.name ?? null,
    description: i.description,
    partnerFeedback: i.partnerFeedback,
    internalNotes: i.internalNotes,
  }));
}

/**
 * Get detailed view of a suggestion for Administrators.
 */
export async function getAdminSuggestion(
  suggestionId: string,
): Promise<AdminSuggestionDetail | null> {
  const suggestion = await prisma.productSuggestion.findUnique({
    where: { id: suggestionId },
    include: {
      partner: {
        select: {
          id: true,
          code: true,
          displayName: true,
          phone: true,
        },
      },
      statusUpdatedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          sellingPrice: true,
          stockQuantity: true,
          status: true,
        },
      },
      history: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          previousStatus: true,
          newStatus: true,
          actorName: true,
          feedback: true,
          internalNotes: true,
          createdAt: true,
        },
      },
    },
  });

  if (!suggestion) return null;

  const rawImages = suggestion.images;
  const images: string[] = Array.isArray(rawImages)
    ? rawImages.filter((x): x is string => typeof x === "string")
    : [];

  return {
    id: suggestion.id,
    name: suggestion.name,
    imageUrl: suggestion.imageUrl,
    images: images.length > 0 ? images : [suggestion.imageUrl],
    estimatedSellingPrice: Number(suggestion.estimatedSellingPrice),
    estimatedPurchasePrice: suggestion.estimatedPurchasePrice
      ? Number(suggestion.estimatedPurchasePrice)
      : null,
    description: suggestion.description,
    supplierName: suggestion.supplierName,
    supplierContact: suggestion.supplierContact,
    supplierUrl: suggestion.supplierUrl,
    characteristics: suggestion.characteristics,
    targetAudience: suggestion.targetAudience,
    partnerReason: suggestion.partnerReason,
    additionalNotes: suggestion.additionalNotes,
    status: suggestion.status,
    partnerFeedback: suggestion.partnerFeedback,
    internalNotes: suggestion.internalNotes,
    statusUpdatedAt: suggestion.statusUpdatedAt?.toISOString() ?? null,
    statusUpdatedBy: suggestion.statusUpdatedBy
      ? {
          id: suggestion.statusUpdatedBy.id,
          name:
            `${suggestion.statusUpdatedBy.firstName} ${suggestion.statusUpdatedBy.lastName}`.trim() ||
            suggestion.statusUpdatedBy.email,
          email: suggestion.statusUpdatedBy.email,
        }
      : null,
    createdAt: suggestion.createdAt.toISOString(),
    updatedAt: suggestion.updatedAt.toISOString(),
    partner: {
      id: suggestion.partner.id,
      code: suggestion.partner.code,
      displayName: suggestion.partner.displayName,
      phone: suggestion.partner.phone,
    },
    productId: suggestion.productId,
    productName: suggestion.product?.name ?? null,
    productCreatedAt: suggestion.productCreatedAt?.toISOString() ?? null,
    linkedProduct: suggestion.product
      ? {
          id: suggestion.product.id,
          name: suggestion.product.name,
          slug: suggestion.product.slug,
          sellingPrice: Number(suggestion.product.sellingPrice),
          stockQuantity: suggestion.product.stockQuantity,
          status: suggestion.product.status,
        }
      : null,
    history: suggestion.history.map((h) => ({
      id: h.id,
      previousStatus: h.previousStatus,
      newStatus: h.newStatus,
      actorName: h.actorName,
      feedback: h.feedback,
      internalNotes: h.internalNotes,
      createdAt: h.createdAt.toISOString(),
    })),
  };
}

/**
 * Update the status of a suggestion, with partner feedback and internal notes.
 * Important: Accepting does NOT create a product or modify stock.
 */
export async function updateSuggestionStatus(
  suggestionId: string,
  adminUser: { id: string; name?: string | null; firstName?: string | null; lastName?: string | null; email?: string; role?: string },
  input: SuggestionStatusUpdateInput,
) {
  const validated = suggestionStatusUpdateSchema.parse(input);

  const suggestion = await prisma.productSuggestion.findUnique({
    where: { id: suggestionId },
    include: {
      partner: {
        select: {
          id: true,
          userId: true,
          displayName: true,
        },
      },
    },
  });

  if (!suggestion) {
    throw new Error("Suggestion introuvable.");
  }

  if (suggestion.status === "PRODUCT_CREATED") {
    throw new Error(
      "Cette suggestion a déjà abouti à la création d'un produit officiel et son statut ne peut plus être modifié.",
    );
  }

  const previousStatus = suggestion.status;
  const statusChanged = previousStatus !== validated.status;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.productSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: validated.status,
        partnerFeedback: validated.partnerFeedback !== undefined ? validated.partnerFeedback : suggestion.partnerFeedback,
        internalNotes: validated.internalNotes !== undefined ? validated.internalNotes : suggestion.internalNotes,
        statusUpdatedAt: new Date(),
        statusUpdatedById: adminUser.id,
      },
    });

    // Record in history timeline
    await tx.productSuggestionHistory.create({
      data: {
        suggestionId,
        previousStatus,
        newStatus: validated.status,
        actorId: adminUser.id,
        actorName: adminUser.name || adminUser.email || "Administrateur",
        feedback: validated.partnerFeedback || null,
        internalNotes: validated.internalNotes || null,
      },
    });

    // Send targeted partner notification
    if (statusChanged || validated.partnerFeedback) {
      let title = "Mise à jour de votre suggestion de produit";
      let body = `Votre suggestion « ${suggestion.name} » a été mise à jour.`;

      if (validated.status === "UNDER_REVIEW") {
        title = "Suggestion en cours d'examen";
        body = `Votre suggestion « ${suggestion.name} » est actuellement examinée par notre équipe produit.`;
      } else if (validated.status === "ACCEPTED") {
        title = "Suggestion de produit acceptée ! 🎉";
        body = `Excellente nouvelle ! Votre suggestion « ${suggestion.name} » a été acceptée par l'administration.`;
      } else if (validated.status === "REJECTED") {
        title = "Statut de votre suggestion de produit";
        body = `Votre suggestion « ${suggestion.name} » n'a pas été retenue pour le catalogue officiel.`;
      } else if (validated.partnerFeedback && !statusChanged) {
        title = "Nouveau retour de l'équipe produit";
        body = `L'administration a laissé un commentaire sur votre suggestion « ${suggestion.name} ».`;
      }

      await notify(tx, {
        userId: suggestion.partner.userId,
        type: "SYSTEM",
        title,
        body,
        link: `/suggestions-produits/${suggestion.id}`,
      });
    }

    return updated;
  });
}

/**
 * Link an existing catalog product to a suggestion.
 * Ensures strict 1-to-1 attribution: prevents duplicate product attribution.
 */
export async function linkSuggestionToProduct(
  suggestionId: string,
  productId: string,
  adminUser: { id: string; name?: string | null; firstName?: string | null; lastName?: string | null; email?: string; role?: string },
  internalNotes?: string | null,
) {
  const validated = linkProductSuggestionSchema.parse({
    suggestionId,
    productId,
    internalNotes,
  });

  const [suggestion, product, alreadyLinked] = await Promise.all([
    prisma.productSuggestion.findUnique({
      where: { id: validated.suggestionId },
      include: { partner: { select: { id: true, userId: true, displayName: true } } },
    }),
    prisma.product.findUnique({
      where: { id: validated.productId },
      select: { id: true, name: true },
    }),
    prisma.productSuggestion.findUnique({
      where: { productId: validated.productId },
      select: { id: true, name: true },
    }),
  ]);

  if (!suggestion) throw new Error("Suggestion introuvable.");
  if (!product) throw new Error("Produit catalogue introuvable.");

  if (suggestion.productId) {
    throw new Error("Cette suggestion est déjà liée à un produit catalogue existant.");
  }

  if (alreadyLinked && alreadyLinked.id !== suggestionId) {
    throw new Error(
      `Ce produit est déjà attribué à une autre suggestion (« ${alreadyLinked.name} »). L'attribution doit rester unique.`,
    );
  }

  const previousStatus = suggestion.status;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.productSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: "PRODUCT_CREATED",
        productId: product.id,
        productCreatedAt: new Date(),
        statusUpdatedAt: new Date(),
        statusUpdatedById: adminUser.id,
        internalNotes: validated.internalNotes || suggestion.internalNotes,
      },
    });

    // Record in history timeline
    await tx.productSuggestionHistory.create({
      data: {
        suggestionId,
        previousStatus,
        newStatus: "PRODUCT_CREATED",
        actorId: adminUser.id,
        actorName: adminUser.name || adminUser.email || "Administrateur",
        feedback: `Suggestion associée au produit catalogue « ${product.name} ».`,
        internalNotes: validated.internalNotes || null,
      },
    });

    // Notify partner that product is now live
    await notify(tx, {
      userId: suggestion.partner.userId,
      type: "SYSTEM",
      title: "Produit ajouté au catalogue ! 🚀",
      body: `Le produit issu de votre suggestion « ${suggestion.name} » est désormais disponible dans le catalogue sous le nom « ${product.name} » !`,
      link: `/catalogue/${product.id}`,
    });

    return { product, suggestion: updated };
  });
}

/**
 * Helper to generate a unique slug for product creation.
 */
async function generateUniqueSlug(tx: Prisma.TransactionClient, baseName: string): Promise<string> {
  const root = slugify(baseName) || "produit";
  let candidate = root;
  let counter = 1;

  while (true) {
    const existing = await tx.product.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
    candidate = `${root}-${++counter}`;
  }
}

/**
 * Create a new product directly from a suggestion in an atomic transaction.
 * Preserves partner attribution and changes suggestion status to PRODUCT_CREATED.
 */
export async function createProductFromSuggestion(
  suggestionId: string,
  adminUser: { id: string; name?: string | null; firstName?: string | null; lastName?: string | null; email?: string; role?: string },
  rawInput: unknown,
) {
  const validated = createProductFromSuggestionSchema.parse(rawInput);

  const suggestion = await prisma.productSuggestion.findUnique({
    where: { id: suggestionId },
    include: {
      partner: {
        select: {
          id: true,
          userId: true,
          displayName: true,
        },
      },
    },
  });

  if (!suggestion) throw new Error("Suggestion introuvable.");

  if (suggestion.productId) {
    throw new Error("Un produit a déjà été créé et lié à cette suggestion.");
  }

  const previousStatus = suggestion.status;

  return prisma.$transaction(async (tx) => {
    // 1. Generate unique slug
    const slug = await generateUniqueSlug(tx, validated.name);

    // 2. Create official Product with source PARTNER_SUGGESTION
    const product = await tx.product.create({
      data: {
        name: validated.name,
        slug,
        description: validated.description || null,
        purchaseCost: new Prisma.Decimal(validated.purchaseCost),
        packagingCost: new Prisma.Decimal(validated.packagingCost),
        deliveryCost: new Prisma.Decimal(validated.deliveryCost),
        sellingPrice: new Prisma.Decimal(validated.sellingPrice),
        stockQuantity: validated.stockQuantity,
        lowStockThreshold: validated.lowStockThreshold,
        status: ProductStatus.ACTIVE,
        categoryId: validated.categoryId || null,
        isWinning: validated.isWinning,
        isNew: validated.isNew,
        isRecommended: validated.isRecommended,
        source: "PARTNER_SUGGESTION",
      },
    });

    // 3. Attach image as ProductMedia if present
    if (suggestion.imageUrl) {
      await tx.productMedia.create({
        data: {
          productId: product.id,
          type: "IMAGE",
          googleDriveUrl: suggestion.imageUrl,
          title: suggestion.name,
          sortOrder: 0,
        },
      });
    }

    // 4. Optionally auto-assign to the submitting partner so it appears in their catalog
    if (validated.autoAssignToPartner) {
      await tx.partnerProduct.upsert({
        where: {
          partnerId_productId: {
            partnerId: suggestion.partner.id,
            productId: product.id,
          },
        },
        create: {
          partnerId: suggestion.partner.id,
          productId: product.id,
          status: "ACTIVE",
        },
        update: {
          status: "ACTIVE",
        },
      });
    }

    // 5. Update suggestion record with 1-to-1 link
    const updatedSuggestion = await tx.productSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: "PRODUCT_CREATED",
        productId: product.id,
        productCreatedAt: new Date(),
        statusUpdatedAt: new Date(),
        statusUpdatedById: adminUser.id,
        internalNotes: validated.internalNotes || suggestion.internalNotes,
      },
    });

    // 6. Record history timeline
    await tx.productSuggestionHistory.create({
      data: {
        suggestionId,
        previousStatus,
        newStatus: "PRODUCT_CREATED",
        actorId: adminUser.id,
        actorName: adminUser.name || adminUser.email || "Administrateur",
        feedback: `Produit « ${product.name} » créé et publié au catalogue.`,
        internalNotes: validated.internalNotes || null,
      },
    });

    // 7. Send partner celebration notification
    await notify(tx, {
      userId: suggestion.partner.userId,
      type: "SYSTEM",
      title: "Produit créé avec succès ! 🚀",
      body: `Félicitations ! Le produit « ${product.name} » issu de votre suggestion a été créé et intégré au catalogue !`,
      link: `/catalogue/${product.id}`,
    });

    return { product, suggestion: updatedSuggestion };
  });
}

/**
 * List products available for linking to a suggestion (products not yet associated with any suggestion).
 */
export async function getAvailableProductsForLinking(): Promise<
  { id: string; name: string; sku: string | null }[]
> {
  return prisma.product.findMany({
    where: { originSuggestion: null },
    select: { id: true, name: true, sku: true },
    orderBy: { name: "asc" },
    take: 150,
  });
}

/**
 * Partner Contribution Analytics:
 * Computes global statistics and partner-level contribution metrics.
 * Separated strictly from financial commissions / settlements.
 */
export async function getPartnerContributionAnalytics(opts?: {
  search?: string;
  sortBy?: "total" | "accepted" | "created" | "rate" | "name";
  sortOrder?: "asc" | "desc";
}): Promise<ContributionAnalytics> {
  const [suggestions, partners] = await Promise.all([
    prisma.productSuggestion.findMany({
      select: {
        id: true,
        partnerId: true,
        status: true,
        productId: true,
        productCreatedAt: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.partner.findMany({
      where: {
        status: "ACTIVE",
      },
      select: {
        id: true,
        code: true,
        displayName: true,
        phone: true,
      },
    }),
  ]);

  // Compute global metrics
  const global: GlobalContributionMetrics = {
    totalSuggestions: suggestions.length,
    pendingReview: suggestions.filter((s) => s.status === "PENDING").length,
    underReview: suggestions.filter((s) => s.status === "UNDER_REVIEW").length,
    accepted: suggestions.filter((s) => s.status === "ACCEPTED").length,
    rejected: suggestions.filter((s) => s.status === "REJECTED").length,
    productsCreated: suggestions.filter((s) => s.status === "PRODUCT_CREATED").length,
  };

  // Group suggestions by partner
  const suggestionsByPartner = new Map<string, typeof suggestions>();
  for (const s of suggestions) {
    const list = suggestionsByPartner.get(s.partnerId) || [];
    list.push(s);
    suggestionsByPartner.set(s.partnerId, list);
  }

  // Compute metrics for each partner
  let partnerMetrics: PartnerContributionMetric[] = partners.map((p) => {
    const pSuggestions = suggestionsByPartner.get(p.id) || [];
    const total = pSuggestions.length;
    const accepted = pSuggestions.filter((s) => s.status === "ACCEPTED").length;
    const rejected = pSuggestions.filter((s) => s.status === "REJECTED").length;
    const created = pSuggestions.filter((s) => s.status === "PRODUCT_CREATED").length;

    // Denominator for acceptance rate: only decisions taken (accepted + rejected + created)
    const decidedCount = accepted + rejected + created;
    const acceptanceRate =
      decidedCount > 0 ? Number((((accepted + created) / decidedCount) * 100).toFixed(1)) : null;

    const linkedProducts = pSuggestions
      .filter((s) => s.product !== null)
      .map((s) => ({
        id: s.product!.id,
        name: s.product!.name,
        slug: s.product!.slug,
        createdAt: s.productCreatedAt ? s.productCreatedAt.toISOString() : s.product!.createdAt.toISOString(),
      }));

    return {
      partnerId: p.id,
      partnerCode: p.code,
      partnerName: p.displayName,
      phone: p.phone,
      totalSuggestions: total,
      acceptedSuggestions: accepted,
      rejectedSuggestions: rejected,
      productsCreated: created,
      acceptanceRate,
      linkedProducts,
    };
  });

  // Filter search
  if (opts?.search && opts.search.trim()) {
    const q = opts.search.trim().toLowerCase();
    partnerMetrics = partnerMetrics.filter(
      (p) =>
        p.partnerName.toLowerCase().includes(q) ||
        p.partnerCode.toLowerCase().includes(q) ||
        (p.phone && p.phone.includes(q)),
    );
  }

  // Sort
  const sortBy = opts?.sortBy || "total";
  const order = opts?.sortOrder || "desc";
  const multiplier = order === "asc" ? 1 : -1;

  partnerMetrics.sort((a, b) => {
    if (sortBy === "name") {
      return multiplier * a.partnerName.localeCompare(b.partnerName);
    }
    if (sortBy === "accepted") {
      return multiplier * (a.acceptedSuggestions - b.acceptedSuggestions);
    }
    if (sortBy === "created") {
      return multiplier * (a.productsCreated - b.productsCreated);
    }
    if (sortBy === "rate") {
      const rateA = a.acceptanceRate ?? -1;
      const rateB = b.acceptanceRate ?? -1;
      return multiplier * (rateA - rateB);
    }
    // Default: total
    return multiplier * (a.totalSuggestions - b.totalSuggestions);
  });

  return {
    global,
    partners: partnerMetrics,
  };
}
