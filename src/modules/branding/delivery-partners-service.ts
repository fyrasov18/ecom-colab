import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";
import { SETTING_KEYS } from "@/modules/settings/defaults";
import {
  DEFAULT_DELIVERY_PARTNERS_CONFIG,
  deliveryPartnersConfigSchema,
  type AddDeliveryPartnerInput,
  type DeliveryPartnerItem,
  type DeliveryPartnersConfig,
  type UpdateDeliveryPartnerInput,
  type UpdateDeliveryPartnersConfigInput,
  addDeliveryPartnerSchema,
  updateDeliveryPartnerSchema,
  updateDeliveryPartnersConfigSchema,
} from "./delivery-partners-schemas";
import { deleteLogoUpload } from "./storage";

export type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Retrieves the delivery partners section configuration and all registered partner entries.
 * Returns default configuration if not configured in the database.
 */
export async function getDeliveryPartnersConfig(
  db: DbClient = prisma,
): Promise<DeliveryPartnersConfig> {
  const row = await db.systemSetting.findUnique({
    where: { key: SETTING_KEYS.DELIVERY_PARTNERS },
    select: { value: true },
  });

  if (!row || !row.value) {
    return DEFAULT_DELIVERY_PARTNERS_CONFIG;
  }

  try {
    return deliveryPartnersConfigSchema.parse(row.value);
  } catch (err) {
    console.warn("[delivery-partners] Configuration parsing failed, falling back to defaults:", err);
    return DEFAULT_DELIVERY_PARTNERS_CONFIG;
  }
}

/**
 * Retrieves only active delivery partners sorted by displayOrder ASC for public pages.
 */
export async function getActiveDeliveryPartners(
  db: DbClient = prisma,
): Promise<{ config: DeliveryPartnersConfig; partners: DeliveryPartnerItem[] }> {
  const config = await getDeliveryPartnersConfig(db);

  if (!config.enabled) {
    return { config, partners: [] };
  }

  const active = config.partners
    .filter((p) => p.isActive)
    .sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
    });

  return { config, partners: active };
}

/**
 * Updates top-level section settings (enabled, multilingual titles and subtitles).
 */
export async function updateDeliveryPartnersConfig(
  input: UpdateDeliveryPartnersConfigInput,
  actorId: string,
  db: DbClient = prisma,
): Promise<DeliveryPartnersConfig> {
  const validated = updateDeliveryPartnersConfigSchema.parse(input);
  const current = await getDeliveryPartnersConfig(db);

  const updated: DeliveryPartnersConfig = {
    ...current,
    enabled: validated.enabled !== undefined ? validated.enabled : current.enabled,
    title: {
      fr: validated.title?.fr ?? current.title.fr,
      ar: validated.title?.ar ?? current.title.ar,
      en: validated.title?.en ?? current.title.en,
    },
    subtitle: {
      fr: validated.subtitle?.fr ?? current.subtitle.fr,
      ar: validated.subtitle?.ar ?? current.subtitle.ar,
      en: validated.subtitle?.en ?? current.subtitle.en,
    },
  };

  const parsed = deliveryPartnersConfigSchema.parse(updated);

  await db.systemSetting.upsert({
    where: { key: SETTING_KEYS.DELIVERY_PARTNERS },
    create: {
      key: SETTING_KEYS.DELIVERY_PARTNERS,
      category: "branding",
      description: "Configuration de la section et liste des partenaires de livraison affichés sur les pages d'authentification.",
      value: parsed as unknown as Prisma.InputJsonValue,
      updatedById: actorId,
    },
    update: {
      value: parsed as unknown as Prisma.InputJsonValue,
      updatedById: actorId,
    },
  });

  await recordAudit(db, {
    actorId,
    action: "DELIVERY_PARTNERS_CONFIG_UPDATED",
    entityType: "SystemSetting",
    entityId: SETTING_KEYS.DELIVERY_PARTNERS,
    before: {
      enabled: current.enabled,
      title: current.title,
      subtitle: current.subtitle,
    },
    after: {
      enabled: parsed.enabled,
      title: parsed.title,
      subtitle: parsed.subtitle,
    },
  });

  return parsed;
}

/**
 * Adds a new delivery company entry to the registry.
 */
export async function addDeliveryPartner(
  input: AddDeliveryPartnerInput,
  actorId: string,
  db: DbClient = prisma,
): Promise<DeliveryPartnerItem> {
  const validated = addDeliveryPartnerSchema.parse(input);
  const current = await getDeliveryPartnersConfig(db);

  const maxOrder = current.partners.reduce(
    (max, p) => Math.max(max, p.displayOrder),
    -1,
  );
  const displayOrder =
    validated.displayOrder > 0 ? validated.displayOrder : maxOrder + 1;

  const now = new Date().toISOString();
  const newPartner: DeliveryPartnerItem = {
    id: randomUUID(),
    name: validated.name,
    logoUrl: validated.logoUrl,
    displayOrder,
    isActive: validated.isActive,
    websiteUrl: validated.websiteUrl,
    createdAt: now,
    updatedAt: now,
  };

  const updatedConfig: DeliveryPartnersConfig = {
    ...current,
    partners: [...current.partners, newPartner],
  };

  const parsed = deliveryPartnersConfigSchema.parse(updatedConfig);

  await db.systemSetting.upsert({
    where: { key: SETTING_KEYS.DELIVERY_PARTNERS },
    create: {
      key: SETTING_KEYS.DELIVERY_PARTNERS,
      category: "branding",
      description: "Configuration de la section et liste des partenaires de livraison affichés sur les pages d'authentification.",
      value: parsed as unknown as Prisma.InputJsonValue,
      updatedById: actorId,
    },
    update: {
      value: parsed as unknown as Prisma.InputJsonValue,
      updatedById: actorId,
    },
  });

  await recordAudit(db, {
    actorId,
    action: "DELIVERY_PARTNER_ADDED",
    entityType: "DeliveryPartner",
    entityId: newPartner.id,
    before: null,
    after: newPartner,
  });

  return newPartner;
}

/**
 * Updates an existing delivery company entry (name, logoUrl, displayOrder, isActive, websiteUrl).
 */
export async function updateDeliveryPartner(
  id: string,
  input: UpdateDeliveryPartnerInput,
  actorId: string,
  db: DbClient = prisma,
): Promise<DeliveryPartnerItem> {
  const validated = updateDeliveryPartnerSchema.parse(input);
  const current = await getDeliveryPartnersConfig(db);

  const index = current.partners.findIndex((p) => p.id === id);
  if (index === -1) {
    throw new Error(`Société de livraison avec l'identifiant ${id} introuvable.`);
  }

  const existing = current.partners[index];
  const updatedItem: DeliveryPartnerItem = {
    ...existing,
    name: validated.name !== undefined ? validated.name : existing.name,
    logoUrl: validated.logoUrl !== undefined ? validated.logoUrl : existing.logoUrl,
    displayOrder:
      validated.displayOrder !== undefined ? validated.displayOrder : existing.displayOrder,
    isActive: validated.isActive !== undefined ? validated.isActive : existing.isActive,
    websiteUrl:
      validated.websiteUrl !== undefined ? validated.websiteUrl : existing.websiteUrl,
    updatedAt: new Date().toISOString(),
  };

  const nextPartners = [...current.partners];
  nextPartners[index] = updatedItem;

  const updatedConfig: DeliveryPartnersConfig = {
    ...current,
    partners: nextPartners,
  };

  const parsed = deliveryPartnersConfigSchema.parse(updatedConfig);

  await db.systemSetting.upsert({
    where: { key: SETTING_KEYS.DELIVERY_PARTNERS },
    create: {
      key: SETTING_KEYS.DELIVERY_PARTNERS,
      category: "branding",
      value: parsed as unknown as Prisma.InputJsonValue,
      updatedById: actorId,
    },
    update: {
      value: parsed as unknown as Prisma.InputJsonValue,
      updatedById: actorId,
    },
  });

  await recordAudit(db, {
    actorId,
    action: "DELIVERY_PARTNER_UPDATED",
    entityType: "DeliveryPartner",
    entityId: id,
    before: existing,
    after: updatedItem,
  });

  return updatedItem;
}

/**
 * Deletes a delivery company entry and cleans up its stored logo asset if applicable.
 */
export async function deleteDeliveryPartner(
  id: string,
  actorId: string,
  db: DbClient = prisma,
): Promise<{ success: true }> {
  const current = await getDeliveryPartnersConfig(db);
  const existing = current.partners.find((p) => p.id === id);

  if (!existing) {
    throw new Error(`Société de livraison avec l'identifiant ${id} introuvable.`);
  }

  // Clean up uploaded logo asset if present
  if (existing.logoUrl) {
    await deleteLogoUpload(existing.logoUrl);
  }

  const nextPartners = current.partners.filter((p) => p.id !== id);
  const updatedConfig: DeliveryPartnersConfig = {
    ...current,
    partners: nextPartners,
  };

  const parsed = deliveryPartnersConfigSchema.parse(updatedConfig);

  await db.systemSetting.upsert({
    where: { key: SETTING_KEYS.DELIVERY_PARTNERS },
    create: {
      key: SETTING_KEYS.DELIVERY_PARTNERS,
      category: "branding",
      value: parsed as unknown as Prisma.InputJsonValue,
      updatedById: actorId,
    },
    update: {
      value: parsed as unknown as Prisma.InputJsonValue,
      updatedById: actorId,
    },
  });

  await recordAudit(db, {
    actorId,
    action: "DELIVERY_PARTNER_DELETED",
    entityType: "DeliveryPartner",
    entityId: id,
    before: existing,
    after: null,
  });

  return { success: true };
}

/**
 * Reorders delivery company entries according to a list of IDs.
 */
export async function reorderDeliveryPartners(
  orderedIds: string[],
  actorId: string,
  db: DbClient = prisma,
): Promise<DeliveryPartnerItem[]> {
  const current = await getDeliveryPartnersConfig(db);

  const idToOrder = new Map<string, number>();
  orderedIds.forEach((id, idx) => {
    idToOrder.set(id, idx);
  });

  const nextPartners = current.partners.map((p) => {
    const newOrder = idToOrder.get(p.id);
    return {
      ...p,
      displayOrder: newOrder !== undefined ? newOrder : p.displayOrder,
      updatedAt: new Date().toISOString(),
    };
  });

  nextPartners.sort((a, b) => a.displayOrder - b.displayOrder);

  const updatedConfig: DeliveryPartnersConfig = {
    ...current,
    partners: nextPartners,
  };

  const parsed = deliveryPartnersConfigSchema.parse(updatedConfig);

  await db.systemSetting.upsert({
    where: { key: SETTING_KEYS.DELIVERY_PARTNERS },
    create: {
      key: SETTING_KEYS.DELIVERY_PARTNERS,
      category: "branding",
      value: parsed as unknown as Prisma.InputJsonValue,
      updatedById: actorId,
    },
    update: {
      value: parsed as unknown as Prisma.InputJsonValue,
      updatedById: actorId,
    },
  });

  await recordAudit(db, {
    actorId,
    action: "DELIVERY_PARTNERS_REORDERED",
    entityType: "SystemSetting",
    entityId: SETTING_KEYS.DELIVERY_PARTNERS,
    before: { order: current.partners.map((p) => ({ id: p.id, order: p.displayOrder })) },
    after: { order: nextPartners.map((p) => ({ id: p.id, order: p.displayOrder })) },
  });

  return nextPartners;
}

/**
 * Resets delivery partners configuration to default settings.
 */
export async function resetDeliveryPartnersConfig(
  actorId: string,
  db: DbClient = prisma,
): Promise<DeliveryPartnersConfig> {
  const current = await getDeliveryPartnersConfig(db);

  // Clean up any uploaded logos
  for (const partner of current.partners) {
    if (partner.logoUrl) {
      await deleteLogoUpload(partner.logoUrl);
    }
  }

  await db.systemSetting.deleteMany({
    where: { key: SETTING_KEYS.DELIVERY_PARTNERS },
  });

  await recordAudit(db, {
    actorId,
    action: "DELIVERY_PARTNERS_RESET",
    entityType: "SystemSetting",
    entityId: SETTING_KEYS.DELIVERY_PARTNERS,
    before: current,
    after: DEFAULT_DELIVERY_PARTNERS_CONFIG,
  });

  return DEFAULT_DELIVERY_PARTNERS_CONFIG;
}
