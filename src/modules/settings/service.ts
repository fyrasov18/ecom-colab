import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/audit/service";
import {
  SETTING_CATEGORIES,
  SETTING_DEFAULTS,
  SETTING_DESCRIPTIONS,
  SETTING_KEYS,
  type SettingKey,
} from "./defaults";

type Db = PrismaClient | Prisma.TransactionClient;

const settingValueSchemas: Record<string, z.ZodTypeAny> = {
  [SETTING_KEYS.SETTLEMENT_PERIOD_HOURS]: z
    .number()
    .int("Doit être un entier")
    .min(1, "Minimum 1 heure")
    .max(720, "Maximum 720 heures (30 jours)"),
  [SETTING_KEYS.MIN_WITHDRAWAL_AMOUNT]: z
    .number()
    .positive("Doit être positif")
    .max(1_000_000),
  [SETTING_KEYS.RETURN_COST_RULE]: z.enum([
    "REVERSE_PENDING_EARNING",
    "REVERSE_PLUS_DELIVERY",
    "NO_COST",
  ]),
};

/** Read a setting, falling back to the compiled default. */
export async function getSetting<T = unknown>(
  key: SettingKey,
  db: Db = prisma,
): Promise<T> {
  const row = await db.systemSetting.findUnique({ where: { key } });
  if (row) return row.value as T;
  return SETTING_DEFAULTS[key] as T;
}

export async function getSettlementPeriodHours(db: Db = prisma): Promise<number> {
  return getSetting<number>(SETTING_KEYS.SETTLEMENT_PERIOD_HOURS, db);
}

export async function getMinWithdrawalAmount(db: Db = prisma): Promise<number> {
  return getSetting<number>(SETTING_KEYS.MIN_WITHDRAWAL_AMOUNT, db);
}

export async function getReturnCostRule(db: Db = prisma) {
  return getSetting<string>(SETTING_KEYS.RETURN_COST_RULE, db);
}

export type SettingDTO = {
  key: string;
  category: string;
  description: string;
  value: unknown;
  defaultValue: unknown;
};

export async function listFinanceSettings(): Promise<SettingDTO[]> {
  const rows = await prisma.systemSetting.findMany({
    where: { category: "finance" },
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return Object.values(SETTING_KEYS).map((key) => ({
    key,
    category: SETTING_CATEGORIES[key],
    description: SETTING_DESCRIPTIONS[key],
    value: byKey.get(key)?.value ?? SETTING_DEFAULTS[key],
    defaultValue: SETTING_DEFAULTS[key],
  }));
}

/**
 * Update a setting with validation + audit. Sensitive settings are
 * SUPER_ADMIN only — enforced by the caller's role check plus audit.
 */
export async function updateSetting(opts: {
  key: SettingKey;
  value: unknown;
  actorId: string;
}): Promise<void> {
  const { key, value, actorId } = opts;
  const schema = settingValueSchemas[key];
  if (!schema) throw new Error(`Unknown setting: ${key}`);

  const parsed = schema.parse(value);

  await prisma.$transaction(async (tx) => {
    const before = await tx.systemSetting.findUnique({ where: { key } });
    const after = await tx.systemSetting.upsert({
      where: { key },
      create: {
        key,
        value: parsed as Prisma.InputJsonValue,
        category: SETTING_CATEGORIES[key],
        description: SETTING_DESCRIPTIONS[key],
        updatedById: actorId,
      },
      update: {
        value: parsed as Prisma.InputJsonValue,
        updatedById: actorId,
      },
    });
    await recordAudit(tx, {
      actorId,
      action: "SETTING_UPDATED",
      entityType: "SystemSetting",
      entityId: key,
      before: before ? { value: before.value } : null,
      after: { value: after.value },
    });
  });
}
