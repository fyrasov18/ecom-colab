import Decimal from "decimal.js";
import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";
import { SETTING_KEYS } from "@/modules/settings/defaults";

export type DbClient = PrismaClient | Prisma.TransactionClient;

export type ReferralLevel = 1 | 2 | 3;

export const REFERRAL_LEVELS = {
  LEVEL_1: 1 as ReferralLevel,
  LEVEL_2: 2 as ReferralLevel,
  LEVEL_3: 3 as ReferralLevel,
} as const;

/** Commission rates per referral tier (percentage of Pool B: 5%, 10%, 15%) */
export const REFERRAL_LEVEL_RATES: Record<ReferralLevel, Decimal> = {
  1: new Decimal("0.05"), // 5%
  2: new Decimal("0.10"), // 10%
  3: new Decimal("0.15"), // 15%
};

export const DEFAULT_LEVEL2_THRESHOLD = 3;
export const DEFAULT_LEVEL3_THRESHOLD = 10;
export const DEFAULT_AUTO_PROMOTION_ENABLED = false;

export interface ReferralThresholdSettings {
  level2Threshold: number;
  level3Threshold: number;
  autoPromotionEnabled: boolean;
}

export interface PartnerReferralLevelHistoryEntry {
  level: ReferralLevel;
  effectiveDate: string; // ISO string
  reason: string;
  actorId?: string | null;
}

export interface PartnerReferralLevelState {
  partnerId: string;
  currentLevel: ReferralLevel;
  effectiveDate: string; // ISO string when current level became active
  highestLevelReached: ReferralLevel;
  eligibleLevel: ReferralLevel;
  pendingConfirmation: boolean;
  history: PartnerReferralLevelHistoryEntry[];
  updatedAt: string;
}

export interface PartnerReferralLevelResult {
  level: ReferralLevel;
  rate: Decimal;
  qualifiedCount: number;
  targetLevel: ReferralLevel;
  effectiveDate: Date;
  highestLevelReached: ReferralLevel;
  isEligibleForPromotion: boolean;
  promotionPendingConfirmation: boolean;
  autoPromotionEnabled: boolean;
  eligibleLevel: ReferralLevel;
}

/** Get the commission rate Decimal for a referral level */
export function getReferralLevelRate(level: ReferralLevel): Decimal {
  const rate = REFERRAL_LEVEL_RATES[level];
  if (!rate) {
    throw new Error(`Niveau de parrainage invalide: ${level}. Doit être 1, 2 ou 3.`);
  }
  return rate;
}

/**
 * Reads dynamic thresholds and auto-promotion flag from SystemSetting,
 * falling back to default configuration values (3, 10, false).
 */
export async function getReferralThresholdSettings(
  db: DbClient = prisma,
): Promise<ReferralThresholdSettings> {
  const [l2Row, l3Row, autoRow] = await Promise.all([
    db.systemSetting.findUnique({ where: { key: SETTING_KEYS.REFERRAL_LEVEL2_THRESHOLD } }),
    db.systemSetting.findUnique({ where: { key: SETTING_KEYS.REFERRAL_LEVEL3_THRESHOLD } }),
    db.systemSetting.findUnique({ where: { key: SETTING_KEYS.REFERRAL_AUTO_PROMOTION_ENABLED } }),
  ]);

  const level2Threshold =
    typeof l2Row?.value === "number" ? l2Row.value : DEFAULT_LEVEL2_THRESHOLD;
  const level3Threshold =
    typeof l3Row?.value === "number" ? l3Row.value : DEFAULT_LEVEL3_THRESHOLD;
  const autoPromotionEnabled =
    typeof autoRow?.value === "boolean" ? autoRow.value : DEFAULT_AUTO_PROMOTION_ENABLED;

  return { level2Threshold, level3Threshold, autoPromotionEnabled };
}

/** Reads auto-promotion setting directly */
export async function isAutoPromotionEnabled(db: DbClient = prisma): Promise<boolean> {
  const row = await db.systemSetting.findUnique({
    where: { key: SETTING_KEYS.REFERRAL_AUTO_PROMOTION_ENABLED },
  });
  return typeof row?.value === "boolean" ? row.value : DEFAULT_AUTO_PROMOTION_ENABLED;
}

/**
 * Evaluates the target referral level from direct qualified count and configurable thresholds.
 * Evaluates target level: Level 3 (count >= 10), Level 2 (count >= 3), Level 1 (otherwise).
 */
export function evaluateTargetLevel(
  qualifiedCount: number,
  thresholds: { level2Threshold: number; level3Threshold: number },
): ReferralLevel {
  if (qualifiedCount >= thresholds.level3Threshold) {
    return 3;
  }
  if (qualifiedCount >= thresholds.level2Threshold) {
    return 2;
  }
  return 1;
}

/** Reads persisted partner referral level state from SystemSetting */
export async function getPartnerReferralLevelState(
  partnerId: string,
  db: DbClient = prisma,
): Promise<PartnerReferralLevelState | null> {
  const row = await db.systemSetting.findUnique({
    where: { key: `referral.partner_level:${partnerId}` },
  });
  if (!row || !row.value) return null;
  return row.value as unknown as PartnerReferralLevelState;
}

/** Saves partner referral level state in SystemSetting */
export async function savePartnerReferralLevelState(
  state: PartnerReferralLevelState,
  db: DbClient = prisma,
): Promise<void> {
  const key = `referral.partner_level:${state.partnerId}`;
  await db.systemSetting.upsert({
    where: { key },
    create: {
      key,
      value: state as unknown as Prisma.InputJsonValue,
      category: "referral_level",
      description: `Niveau de parrainage pour le partenaire ${state.partnerId}`,
    },
    update: {
      value: state as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Counts distinct QUALIFIED direct attributions for a partner.
 * Direct referrals only! Downline / indirect partners NEVER count.
 */
export async function countDirectQualifiedReferrals(
  partnerId: string,
  db: DbClient = prisma,
): Promise<number> {
  return await db.referralAttribution.count({
    where: {
      referrerPartnerId: partnerId,
      status: "QUALIFIED",
    },
  });
}

/**
 * Gets partner's current referral level, evaluates dynamic thresholds,
 * handles promotion state (auto-promote or flag for admin confirmation),
 * preserves effective date, and enforces inactivity policy (NEVER demotes).
 */
export async function getPartnerReferralLevel(
  partnerId: string,
  tx?: Prisma.TransactionClient | PrismaClient,
): Promise<PartnerReferralLevelResult> {
  const db = tx ?? prisma;

  // 1. Load partner to determine baseline creation date
  const partner = await db.partner.findUnique({
    where: { id: partnerId },
    select: { id: true, createdAt: true },
  });
  const defaultDate = partner?.createdAt ?? new Date();

  // 2. Count distinct QUALIFIED direct attributions (direct only, downline never count)
  const qualifiedCount = await countDirectQualifiedReferrals(partnerId, db);

  // 3. Dynamic threshold evaluation from system settings
  const { level2Threshold, level3Threshold, autoPromotionEnabled } =
    await getReferralThresholdSettings(db);

  // 4. Evaluate target level
  const targetLevel = evaluateTargetLevel(qualifiedCount, {
    level2Threshold,
    level3Threshold,
  });

  // 5. Retrieve or initialize persisted partner level state
  let state = await getPartnerReferralLevelState(partnerId, db);
  if (!state) {
    state = {
      partnerId,
      currentLevel: 1,
      effectiveDate: defaultDate.toISOString(),
      highestLevelReached: 1,
      eligibleLevel: targetLevel,
      pendingConfirmation: false,
      history: [
        {
          level: 1,
          effectiveDate: defaultDate.toISOString(),
          reason: "INITIAL_LEVEL",
        },
      ],
      updatedAt: new Date().toISOString(),
    };
  }

  // 6. Inactivity Policy: Partners are NEVER automatically demoted for inactivity
  // Highest level reached is preserved. currentLevel cannot drop below highestLevelReached.
  const oldLevel = state.currentLevel;

  // 7. Promotion Evaluation
  if (targetLevel > state.currentLevel) {
    if (autoPromotionEnabled) {
      // Auto-promotion is enabled -> promote immediately
      const nowIso = new Date().toISOString();
      state.currentLevel = targetLevel;
      state.highestLevelReached = Math.max(state.highestLevelReached, targetLevel) as ReferralLevel;
      state.effectiveDate = nowIso;
      state.eligibleLevel = targetLevel;
      state.pendingConfirmation = false;
      state.history.push({
        level: targetLevel,
        effectiveDate: nowIso,
        reason: "AUTO_PROMOTION",
      });
      state.updatedAt = nowIso;

      await savePartnerReferralLevelState(state, db);

      await recordAudit(db, {
        action: "PARTNER_REFERRAL_LEVEL_PROMOTED",
        entityType: "PartnerReferralLevel",
        entityId: partnerId,
        before: { level: oldLevel },
        after: {
          level: targetLevel,
          effectiveDate: nowIso,
          qualifiedCount,
        },
      });
    } else {
      // Auto-promotion disabled -> flag promotion eligibility for admin confirmation
      state.eligibleLevel = targetLevel;
      state.pendingConfirmation = true;
      state.updatedAt = new Date().toISOString();

      await savePartnerReferralLevelState(state, db);

      await recordAudit(db, {
        action: "PARTNER_PROMOTION_ELIGIBLE",
        entityType: "PartnerReferralLevel",
        entityId: partnerId,
        before: { currentLevel: state.currentLevel },
        after: {
          eligibleLevel: targetLevel,
          pendingConfirmation: true,
          qualifiedCount,
        },
      });
    }
  } else {
    // If targetLevel <= currentLevel, partner keeps currentLevel (inactivity protected)
    if (state.pendingConfirmation && targetLevel <= state.currentLevel) {
      state.pendingConfirmation = false;
      state.eligibleLevel = state.currentLevel;
      state.updatedAt = new Date().toISOString();
      await savePartnerReferralLevelState(state, db);
    }
  }

  return {
    level: state.currentLevel,
    rate: REFERRAL_LEVEL_RATES[state.currentLevel],
    qualifiedCount,
    targetLevel,
    effectiveDate: new Date(state.effectiveDate),
    highestLevelReached: state.highestLevelReached,
    isEligibleForPromotion: targetLevel > state.currentLevel,
    promotionPendingConfirmation: targetLevel > state.currentLevel && !autoPromotionEnabled,
    autoPromotionEnabled,
    eligibleLevel: targetLevel,
  };
}

/**
 * Admin confirmation function to promote a partner eligible for a higher level.
 * Updates current level, preserves effective date, and records audit trail.
 */
export async function confirmPartnerPromotion(
  partnerId: string,
  targetLevel?: ReferralLevel,
  actorId?: string,
  tx?: Prisma.TransactionClient | PrismaClient,
): Promise<PartnerReferralLevelResult> {
  const db = tx ?? prisma;

  let state = await getPartnerReferralLevelState(partnerId, db);
  const partner = await db.partner.findUnique({
    where: { id: partnerId },
    select: { id: true, createdAt: true },
  });

  const defaultDate = partner?.createdAt ?? new Date();
  if (!state) {
    state = {
      partnerId,
      currentLevel: 1,
      effectiveDate: defaultDate.toISOString(),
      highestLevelReached: 1,
      eligibleLevel: 1,
      pendingConfirmation: false,
      history: [
        {
          level: 1,
          effectiveDate: defaultDate.toISOString(),
          reason: "INITIAL_LEVEL",
        },
      ],
      updatedAt: new Date().toISOString(),
    };
  }

  const promotedLevel: ReferralLevel = targetLevel ?? state.eligibleLevel ?? 2;
  const oldLevel = state.currentLevel;
  const nowIso = new Date().toISOString();

  state.currentLevel = promotedLevel;
  state.highestLevelReached = Math.max(state.highestLevelReached, promotedLevel) as ReferralLevel;
  state.effectiveDate = nowIso;
  state.eligibleLevel = promotedLevel;
  state.pendingConfirmation = false;
  state.history.push({
    level: promotedLevel,
    effectiveDate: nowIso,
    reason: "ADMIN_CONFIRMATION",
    actorId: actorId ?? null,
  });
  state.updatedAt = nowIso;

  await savePartnerReferralLevelState(state, db);

  await recordAudit(db, {
    actorId,
    action: "PARTNER_REFERRAL_LEVEL_CONFIRMED",
    entityType: "PartnerReferralLevel",
    entityId: partnerId,
    before: { level: oldLevel },
    after: {
      level: promotedLevel,
      effectiveDate: nowIso,
      confirmedBy: actorId,
    },
  });

  const qualifiedCount = await countDirectQualifiedReferrals(partnerId, db);
  const { autoPromotionEnabled } = await getReferralThresholdSettings(db);

  return {
    level: state.currentLevel,
    rate: REFERRAL_LEVEL_RATES[state.currentLevel],
    qualifiedCount,
    targetLevel: state.currentLevel,
    effectiveDate: new Date(state.effectiveDate),
    highestLevelReached: state.highestLevelReached,
    isEligibleForPromotion: false,
    promotionPendingConfirmation: false,
    autoPromotionEnabled,
    eligibleLevel: state.currentLevel,
  };
}

/**
 * Resolves which referral level was effective for a partner on a specific historical date.
 * Inspects the partner's level history and finds the latest level whose effectiveDate <= date.
 * If none found, falls back to Level 1.
 * This guarantees that finalized historical commissions are NEVER retroactively recalculated.
 */
export async function getPartnerReferralLevelAtDate(
  partnerId: string,
  date: Date,
  tx?: Prisma.TransactionClient | PrismaClient,
): Promise<{ level: ReferralLevel; rate: Decimal; effectiveDate: Date }> {
  const db = tx ?? prisma;
  const state = await getPartnerReferralLevelState(partnerId, db);

  if (!state || !state.history || state.history.length === 0) {
    return {
      level: 1,
      rate: REFERRAL_LEVEL_RATES[1],
      effectiveDate: new Date(0),
    };
  }

  const targetTime = date.getTime();
  const matching = state.history
    .filter((h) => new Date(h.effectiveDate).getTime() <= targetTime)
    .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());

  if (matching.length > 0) {
    const entry = matching[0]!;
    return {
      level: entry.level,
      rate: REFERRAL_LEVEL_RATES[entry.level],
      effectiveDate: new Date(entry.effectiveDate),
    };
  }

  return {
    level: 1,
    rate: REFERRAL_LEVEL_RATES[1],
    effectiveDate: new Date(state.history[0]?.effectiveDate ?? 0),
  };
}

/** Updates referral dynamic thresholds and auto-promotion configuration */
export async function updateReferralSettings(
  settings: {
    level2Threshold?: number;
    level3Threshold?: number;
    autoPromotionEnabled?: boolean;
  },
  actorId?: string,
  tx?: Prisma.TransactionClient | PrismaClient,
): Promise<void> {
  const db = tx ?? prisma;

  if (settings.level2Threshold !== undefined) {
    await db.systemSetting.upsert({
      where: { key: SETTING_KEYS.REFERRAL_LEVEL2_THRESHOLD },
      create: {
        key: SETTING_KEYS.REFERRAL_LEVEL2_THRESHOLD,
        value: settings.level2Threshold,
        category: "referral",
        description: "Seuil de parrainages directs qualifiés pour le Niveau 2.",
        updatedById: actorId ?? null,
      },
      update: {
        value: settings.level2Threshold,
        updatedById: actorId ?? null,
      },
    });
  }

  if (settings.level3Threshold !== undefined) {
    await db.systemSetting.upsert({
      where: { key: SETTING_KEYS.REFERRAL_LEVEL3_THRESHOLD },
      create: {
        key: SETTING_KEYS.REFERRAL_LEVEL3_THRESHOLD,
        value: settings.level3Threshold,
        category: "referral",
        description: "Seuil de parrainages directs qualifiés pour le Niveau 3.",
        updatedById: actorId ?? null,
      },
      update: {
        value: settings.level3Threshold,
        updatedById: actorId ?? null,
      },
    });
  }

  if (settings.autoPromotionEnabled !== undefined) {
    await db.systemSetting.upsert({
      where: { key: SETTING_KEYS.REFERRAL_AUTO_PROMOTION_ENABLED },
      create: {
        key: SETTING_KEYS.REFERRAL_AUTO_PROMOTION_ENABLED,
        value: settings.autoPromotionEnabled,
        category: "referral",
        description: "Activer la promotion automatique de niveau de parrainage.",
        updatedById: actorId ?? null,
      },
      update: {
        value: settings.autoPromotionEnabled,
        updatedById: actorId ?? null,
      },
    });
  }

  if (actorId) {
    await recordAudit(db, {
      actorId,
      action: "REFERRAL_SETTINGS_UPDATED",
      entityType: "SystemSetting",
      entityId: "referral",
      after: settings,
    });
  }
}
