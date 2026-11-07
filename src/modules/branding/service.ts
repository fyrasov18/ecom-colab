import { revalidatePath, revalidateTag } from "next/cache";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";
import {
  BRANDING_SETTING_KEYS,
  DEFAULT_AUTH_PAGES_DESIGN,
  DEFAULT_DASHBOARD_DESIGN,
  DEFAULT_PLATFORM_BRANDING,
  type AuthPagesDesign,
  type DashboardDesign,
  type PartnerBranding,
  type PlatformBranding,
  type ResolvedBranding,
} from "./defaults";
import {
  authPagesDesignSchema,
  type AuthPagesDesignInput,
} from "./auth-design-schemas";
import {
  dashboardDesignSchema,
  partnerBrandingSchema,
  platformBrandingSchema,
  type DashboardDesignInput,
  type PartnerBrandingInput,
  type PlatformBrandingInput,
} from "./schemas";

export type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Reads platform branding settings from SystemSetting with fallback to compile-time defaults.
 */
export async function getPlatformBranding(db: DbClient = prisma): Promise<PlatformBranding> {
  const row = await db.systemSetting.findUnique({
    where: { key: BRANDING_SETTING_KEYS.PLATFORM_BRANDING },
  });

  if (!row || !row.value || typeof row.value !== "object") {
    return DEFAULT_PLATFORM_BRANDING;
  }

  const val = row.value as Record<string, unknown>;
  return {
    platformName: typeof val.platformName === "string" ? val.platformName : DEFAULT_PLATFORM_BRANDING.platformName,
    platformTagline: typeof val.platformTagline === "string" ? val.platformTagline : DEFAULT_PLATFORM_BRANDING.platformTagline,
    platformDescription: typeof val.platformDescription === "string" ? val.platformDescription : DEFAULT_PLATFORM_BRANDING.platformDescription,
    logoLightUrl: typeof val.logoLightUrl === "string" ? val.logoLightUrl : null,
    logoDarkUrl: typeof val.logoDarkUrl === "string" ? val.logoDarkUrl : null,
    logoMarkUrl: typeof val.logoMarkUrl === "string" ? val.logoMarkUrl : null,
    faviconUrl: typeof val.faviconUrl === "string" ? val.faviconUrl : DEFAULT_PLATFORM_BRANDING.faviconUrl,
  };
}

/**
 * Reads dashboard design configuration (colors, radius, sidebar) with fallback to defaults.
 */
export async function getDashboardDesign(db: DbClient = prisma): Promise<DashboardDesign> {
  const row = await db.systemSetting.findUnique({
    where: { key: BRANDING_SETTING_KEYS.DASHBOARD_DESIGN },
  });

  if (!row || !row.value || typeof row.value !== "object") {
    return DEFAULT_DASHBOARD_DESIGN;
  }

  const val = row.value as Record<string, unknown>;
  return {
    primaryColor: typeof val.primaryColor === "string" ? val.primaryColor : DEFAULT_DASHBOARD_DESIGN.primaryColor,
    secondaryColor: typeof val.secondaryColor === "string" ? val.secondaryColor : DEFAULT_DASHBOARD_DESIGN.secondaryColor,
    accentColor: typeof val.accentColor === "string" ? val.accentColor : DEFAULT_DASHBOARD_DESIGN.accentColor,
    sidebarBg: typeof val.sidebarBg === "string" ? val.sidebarBg : DEFAULT_DASHBOARD_DESIGN.sidebarBg,
    borderRadius: (val.borderRadius === "6px" || val.borderRadius === "10px" || val.borderRadius === "14px" || val.borderRadius === "20px")
      ? val.borderRadius
      : DEFAULT_DASHBOARD_DESIGN.borderRadius,
    themeMode: (val.themeMode === "dark" || val.themeMode === "light" || val.themeMode === "system")
      ? val.themeMode
      : DEFAULT_DASHBOARD_DESIGN.themeMode,
  };
}

/**
 * Updates platform-wide branding with server-side validation and audit logging.
 */
export async function updatePlatformBranding(
  input: PlatformBrandingInput,
  actorId: string,
  db: DbClient = prisma,
): Promise<PlatformBranding> {
  const validated = platformBrandingSchema.parse(input);
  const current = await getPlatformBranding(db);

  await db.systemSetting.upsert({
    where: { key: BRANDING_SETTING_KEYS.PLATFORM_BRANDING },
    create: {
      key: BRANDING_SETTING_KEYS.PLATFORM_BRANDING,
      value: validated as Prisma.InputJsonValue,
      category: "branding",
      description: "Identité de marque et logos de la plateforme",
      updatedById: actorId,
    },
    update: {
      value: validated as Prisma.InputJsonValue,
      updatedById: actorId,
    },
  });

  await recordAudit(db, {
    actorId,
    action: "PLATFORM_BRANDING_UPDATED",
    entityType: "SystemSetting",
    entityId: BRANDING_SETTING_KEYS.PLATFORM_BRANDING,
    before: current,
    after: validated,
  });

  try {
    revalidateTag("platform-branding");
    revalidatePath("/", "layout");
  } catch {
    // Revalidation is a no-op outside Next request context
  }

  return validated as PlatformBranding;
}

/**
 * Updates dashboard visual design settings (colors, theme, radius) with audit logging.
 */
export async function updateDashboardDesign(
  input: DashboardDesignInput,
  actorId: string,
  db: DbClient = prisma,
): Promise<DashboardDesign> {
  const validated = dashboardDesignSchema.parse(input);
  const current = await getDashboardDesign(db);

  await db.systemSetting.upsert({
    where: { key: BRANDING_SETTING_KEYS.DASHBOARD_DESIGN },
    create: {
      key: BRANDING_SETTING_KEYS.DASHBOARD_DESIGN,
      value: validated as Prisma.InputJsonValue,
      category: "branding",
      description: "Personnalisation des couleurs et du design du tableau de bord",
      updatedById: actorId,
    },
    update: {
      value: validated as Prisma.InputJsonValue,
      updatedById: actorId,
    },
  });

  await recordAudit(db, {
    actorId,
    action: "DASHBOARD_DESIGN_UPDATED",
    entityType: "SystemSetting",
    entityId: BRANDING_SETTING_KEYS.DASHBOARD_DESIGN,
    before: current,
    after: validated,
  });

  try {
    revalidateTag("dashboard-design");
    revalidatePath("/", "layout");
  } catch {
    // Revalidation is a no-op outside Next request context
  }

  return validated;
}

/**
 * Resets platform branding settings back to factory defaults.
 */
export async function resetPlatformBranding(actorId: string, db: DbClient = prisma): Promise<PlatformBranding> {
  const current = await getPlatformBranding(db);

  await db.systemSetting.deleteMany({
    where: { key: BRANDING_SETTING_KEYS.PLATFORM_BRANDING },
  });

  await recordAudit(db, {
    actorId,
    action: "PLATFORM_BRANDING_RESET",
    entityType: "SystemSetting",
    entityId: BRANDING_SETTING_KEYS.PLATFORM_BRANDING,
    before: current,
    after: DEFAULT_PLATFORM_BRANDING,
  });

  try {
    revalidateTag("platform-branding");
    revalidatePath("/", "layout");
  } catch {
    // Revalidation no-op
  }

  return DEFAULT_PLATFORM_BRANDING;
}

/**
 * Resets dashboard design back to factory default emerald theme.
 */
export async function resetDashboardDesign(actorId: string, db: DbClient = prisma): Promise<DashboardDesign> {
  const current = await getDashboardDesign(db);

  await db.systemSetting.deleteMany({
    where: { key: BRANDING_SETTING_KEYS.DASHBOARD_DESIGN },
  });

  await recordAudit(db, {
    actorId,
    action: "DASHBOARD_DESIGN_RESET",
    entityType: "SystemSetting",
    entityId: BRANDING_SETTING_KEYS.DASHBOARD_DESIGN,
    before: current,
    after: DEFAULT_DASHBOARD_DESIGN,
  });

  try {
    revalidateTag("dashboard-design");
    revalidatePath("/", "layout");
  } catch {
    // Revalidation no-op
  }

  return DEFAULT_DASHBOARD_DESIGN;
}

/**
 * Reads authentication pages design settings with fallback to compile-time defaults.
 */
export async function getAuthPagesDesign(db: DbClient = prisma): Promise<AuthPagesDesign> {
  const row = await db.systemSetting.findUnique({
    where: { key: BRANDING_SETTING_KEYS.AUTH_DESIGN },
  });

  if (!row || !row.value || typeof row.value !== "object") {
    return DEFAULT_AUTH_PAGES_DESIGN;
  }

  const parseResult = authPagesDesignSchema.safeParse(row.value);
  if (parseResult.success) {
    return parseResult.data;
  }

  return DEFAULT_AUTH_PAGES_DESIGN;
}

/**
 * Updates authentication pages design settings with server-side validation and audit logging.
 */
export async function updateAuthPagesDesign(
  input: AuthPagesDesignInput,
  actorId: string,
  db: DbClient = prisma,
): Promise<AuthPagesDesign> {
  const validated = authPagesDesignSchema.parse(input);
  const current = await getAuthPagesDesign(db);

  await db.systemSetting.upsert({
    where: { key: BRANDING_SETTING_KEYS.AUTH_DESIGN },
    create: {
      key: BRANDING_SETTING_KEYS.AUTH_DESIGN,
      value: validated as Prisma.InputJsonValue,
      category: "branding",
      description: "Personnalisation du design et contenu des pages d'authentification",
      updatedById: actorId,
    },
    update: {
      value: validated as Prisma.InputJsonValue,
      updatedById: actorId,
    },
  });

  await recordAudit(db, {
    actorId,
    action: "AUTH_PAGES_DESIGN_UPDATED",
    entityType: "SystemSetting",
    entityId: BRANDING_SETTING_KEYS.AUTH_DESIGN,
    before: current,
    after: validated,
  });

  try {
    revalidateTag("auth-pages-design");
    revalidatePath("/login");
    revalidatePath("/register");
    revalidatePath("/parametres/auth-design");
  } catch {
    // Revalidation no-op
  }

  return validated;
}

/**
 * Resets authentication pages design back to factory defaults.
 */
export async function resetAuthPagesDesign(actorId: string, db: DbClient = prisma): Promise<AuthPagesDesign> {
  const current = await getAuthPagesDesign(db);

  await db.systemSetting.deleteMany({
    where: { key: BRANDING_SETTING_KEYS.AUTH_DESIGN },
  });

  await recordAudit(db, {
    actorId,
    action: "AUTH_PAGES_DESIGN_RESET",
    entityType: "SystemSetting",
    entityId: BRANDING_SETTING_KEYS.AUTH_DESIGN,
    before: current,
    after: DEFAULT_AUTH_PAGES_DESIGN,
  });

  try {
    revalidateTag("auth-pages-design");
    revalidatePath("/login");
    revalidatePath("/register");
    revalidatePath("/parametres/auth-design");
  } catch {
    // Revalidation no-op
  }

  return DEFAULT_AUTH_PAGES_DESIGN;
}


/**
 * Reads a partner's company branding information with explicit column projection.
 */
export async function getPartnerBranding(
  partnerId: string,
  db: DbClient = prisma,
): Promise<PartnerBranding | null> {
  const partner = await db.partner.findUnique({
    where: { id: partnerId },
    select: {
      id: true,
      displayName: true,
      companyName: true,
      companyLogoUrl: true,
      companyLogoDarkUrl: true,
      companyMarkUrl: true,
      brandColorPrimary: true,
      brandColorSecondary: true,
      companyDescription: true,
      supportEmail: true,
      supportPhone: true,
      websiteUrl: true,
    },
  });

  if (!partner) return null;

  return {
    partnerId: partner.id,
    companyName: partner.companyName || partner.displayName,
    companyLogoUrl: partner.companyLogoUrl,
    companyLogoDarkUrl: partner.companyLogoDarkUrl,
    companyMarkUrl: partner.companyMarkUrl,
    brandColorPrimary: partner.brandColorPrimary,
    brandColorSecondary: partner.brandColorSecondary,
    companyDescription: partner.companyDescription,
    supportEmail: partner.supportEmail,
    supportPhone: partner.supportPhone,
    websiteUrl: partner.websiteUrl,
  };
}

/**
 * Updates a partner's company branding with ownership verification and audit logging.
 */
export async function updatePartnerBranding(
  partnerId: string,
  input: PartnerBrandingInput,
  actorId: string,
  db: DbClient = prisma,
): Promise<PartnerBranding> {
  const validated = partnerBrandingSchema.parse(input);
  const current = await getPartnerBranding(partnerId, db);

  const updated = await db.partner.update({
    where: { id: partnerId },
    data: {
      companyName: validated.companyName,
      companyLogoUrl: validated.companyLogoUrl,
      companyLogoDarkUrl: validated.companyLogoDarkUrl,
      companyMarkUrl: validated.companyMarkUrl,
      brandColorPrimary: validated.brandColorPrimary,
      brandColorSecondary: validated.brandColorSecondary,
      companyDescription: validated.companyDescription,
      supportEmail: validated.supportEmail,
      supportPhone: validated.supportPhone,
      websiteUrl: validated.websiteUrl,
    },
    select: {
      id: true,
      displayName: true,
      companyName: true,
      companyLogoUrl: true,
      companyLogoDarkUrl: true,
      companyMarkUrl: true,
      brandColorPrimary: true,
      brandColorSecondary: true,
      companyDescription: true,
      supportEmail: true,
      supportPhone: true,
      websiteUrl: true,
    },
  });

  await recordAudit(db, {
    actorId,
    action: "PARTNER_BRANDING_UPDATED",
    entityType: "Partner",
    entityId: partnerId,
    before: current,
    after: validated,
  });

  try {
    revalidatePath("/mon-entreprise");
    revalidatePath(`/partenaires/${partnerId}`);
    revalidatePath("/", "layout");
  } catch {
    // Revalidation no-op
  }

  return {
    partnerId: updated.id,
    companyName: updated.companyName || updated.displayName,
    companyLogoUrl: updated.companyLogoUrl,
    companyLogoDarkUrl: updated.companyLogoDarkUrl,
    companyMarkUrl: updated.companyMarkUrl,
    brandColorPrimary: updated.brandColorPrimary,
    brandColorSecondary: updated.brandColorSecondary,
    companyDescription: updated.companyDescription,
    supportEmail: updated.supportEmail,
    supportPhone: updated.supportPhone,
    websiteUrl: updated.websiteUrl,
  };
}

/**
 * Central hierarchical branding resolver:
 * 1. Partner branding (if in partner scope AND custom branding exists)
 * 2. Platform branding (if customized in SystemSetting)
 * 3. Default EcomPartner fallback
 */
export async function resolveBrandingContext(opts: {
  scope?: "admin" | "partenaire";
  partnerId?: string | null;
  db?: DbClient;
}): Promise<ResolvedBranding> {
  const { scope = "admin", partnerId, db = prisma } = opts;

  const [platform, design] = await Promise.all([
    getPlatformBranding(db),
    getDashboardDesign(db),
  ]);

  if (scope === "partenaire" && partnerId) {
    const partner = await getPartnerBranding(partnerId, db);
    if (partner) {
      const isCustomPartner = Boolean(
        partner.companyLogoUrl ||
        partner.companyLogoDarkUrl ||
        partner.companyMarkUrl ||
        partner.companyName !== partner.partnerId
      );

      return {
        name: partner.companyName || platform.platformName,
        tagline: platform.platformTagline,
        logoLight: partner.companyLogoDarkUrl || partner.companyLogoUrl || platform.logoLightUrl,
        logoDark: partner.companyLogoUrl || platform.logoDarkUrl,
        logoMark: partner.companyMarkUrl || platform.logoMarkUrl,
        faviconUrl: platform.faviconUrl || DEFAULT_PLATFORM_BRANDING.faviconUrl!,
        primaryColor: partner.brandColorPrimary || design.primaryColor,
        accentColor: partner.brandColorSecondary || design.accentColor,
        sidebarBg: design.sidebarBg,
        borderRadius: design.borderRadius,
        isPartner: true,
        isCustom: isCustomPartner,
      };
    }
  }

  const isCustomPlatform = Boolean(
    platform.logoLightUrl ||
    platform.logoDarkUrl ||
    platform.logoMarkUrl ||
    platform.platformName !== DEFAULT_PLATFORM_BRANDING.platformName ||
    design.primaryColor !== DEFAULT_DASHBOARD_DESIGN.primaryColor
  );

  return {
    name: platform.platformName,
    tagline: platform.platformTagline,
    logoLight: platform.logoLightUrl,
    logoDark: platform.logoDarkUrl,
    logoMark: platform.logoMarkUrl,
    faviconUrl: platform.faviconUrl || DEFAULT_PLATFORM_BRANDING.faviconUrl!,
    primaryColor: design.primaryColor,
    accentColor: design.accentColor,
    sidebarBg: design.sidebarBg,
    borderRadius: design.borderRadius,
    isPartner: false,
    isCustom: isCustomPlatform,
  };
}

export {
  getDeliveryPartnersConfig,
  getActiveDeliveryPartners,
  updateDeliveryPartnersConfig,
  addDeliveryPartner,
  updateDeliveryPartner,
  deleteDeliveryPartner,
  reorderDeliveryPartners,
  resetDeliveryPartnersConfig,
} from "./delivery-partners-service";
export * from "./delivery-partners-schemas";
