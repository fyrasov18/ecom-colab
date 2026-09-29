/**
 * Telegram ingestion — parsing, validation and the wizard state machine.
 *
 * PURE module: no Prisma, no fetch, no env access. Everything here is
 * unit-testable in isolation, which is where the security-critical logic lives
 * (command routing, field validation, step transitions).
 *
 * Scope (MVP, per spec §21): /start, /newproduct, /cancel, /help.
 * Nothing is ever published automatically — the flow only produces a DRAFT.
 */

import { z } from "zod";

export const TELEGRAM_COMMANDS = [
  "start",
  "newproduct",
  "cancel",
  "help",
] as const;
export type TelegramCommand = (typeof TELEGRAM_COMMANDS)[number];

/** Ordered wizard steps. `CONFIRM` is the review step, not a data field. */
export const TELEGRAM_STEPS = [
  "IDLE",
  "NAME",
  "DESCRIPTION",
  "PURCHASE_COST",
  "SELLING_PRICE",
  "STOCK",
  "SKU",
  "CATEGORY",
  "SUPPLIER_REF",
  "CONFIRM",
] as const;
export type TelegramStep = (typeof TELEGRAM_STEPS)[number];

/** Ordered: each step knows the next one, and which fields are optional. */
const STEP_ORDER: TelegramStep[] = [
  "NAME",
  "DESCRIPTION",
  "PURCHASE_COST",
  "SELLING_PRICE",
  "STOCK",
  "SKU",
  "CATEGORY",
  "SUPPLIER_REF",
  "CONFIRM",
];

/** Optional steps still get asked, but accept a blank answer. */
const OPTIONAL_STEPS: ReadonlySet<TelegramStep> = new Set([
  "SKU",
  "CATEGORY",
  "SUPPLIER_REF",
]);

export function stepAfter(step: TelegramStep): TelegramStep {
  const i = STEP_ORDER.indexOf(step);
  if (i < 0 || i === STEP_ORDER.length - 1) return "IDLE";
  return STEP_ORDER[i + 1];
}

export function isOptionalStep(step: TelegramStep): boolean {
  return OPTIONAL_STEPS.has(step);
}

export function isKnownStep(value: string): value is TelegramStep {
  return (TELEGRAM_STEPS as readonly string[]).includes(value);
}

// ───────────────────────── Field validation ─────────────────────────

const TEXT_MAX = 160;

/** Money: positive, at most 3 decimals, sane ceiling. Rejects junk outright. */
const moneyField = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s/g, "").replace(",", "."))
  .refine((v) => /^\d{1,7}(\.\d{1,3})?$/.test(v), "Montant invalide")
  .refine((v) => Number(v) > 0, "Le montant doit être supérieur à zéro")
  .refine((v) => Number(v) <= 1_000_000, "Montant trop élevé");

const stockField = z
  .string()
  .trim()
  .refine((v) => /^\d{1,6}$/.test(v), "Stock invalide")
  .refine((v) => Number(v) >= 0 && Number(v) <= 1_000_000, "Stock hors limites");

const shortText = z
  .string()
  .trim()
  .min(1, "Valeur trop courte")
  .max(TEXT_MAX, "Valeur trop longue");

const longText = z
  .string()
  .trim()
  .min(1, "Valeur trop courte")
  .max(2000, "Description trop longue");

export type FieldResult =
  | { ok: true; value: string; number?: number }
  | { ok: false; error: string };

type ZodStringLike = {
  safeParse: (
    v: string,
  ) => { success: true; data: string } | { success: false; error: { issues: { message: string }[] } };
};

function run(
  schema: ZodStringLike,
  raw: string,
  asNumber = false,
): FieldResult {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Valeur invalide" };
  }
  return asNumber
    ? { ok: true, value: parsed.data, number: Number(parsed.data) }
    : { ok: true, value: parsed.data };
}

/** Validate one wizard answer against the step that asked for it. */
export function validateStepInput(step: TelegramStep, raw: string): FieldResult {
  const value = raw.trim();

  if (isOptionalStep(step) && value === "") {
    return { ok: true, value: "" };
  }

  switch (step) {
    case "NAME":
      return run(shortText, value);
    case "DESCRIPTION":
      return run(longText, value);
    case "PURCHASE_COST":
      return run(moneyField, value, true);
    case "SELLING_PRICE":
      return run(moneyField, value, true);
    case "STOCK":
      return run(stockField, value, true);
    case "SKU":
    case "CATEGORY":
    case "SUPPLIER_REF":
      return run(shortText, value);
    default:
      return { ok: false, error: "Étape inconnue." };
  }
}
// ───────────────────────── Compact message parsing ─────────────────────────

/**
 * Compact single-message intake (spec §23):
 *   Nom: … / Cost: … / Prix: … / Stock: … / Description: …
 *
 * Deliberately NOT NLP: only explicit `Key: value` lines are recognised, so a
 * free-text sentence can never be misread as a price.
 */
const FIELD_ALIASES: Record<string, keyof ParsedProduct> = {
  nom: "name",
  name: "name",
  description: "description",
  desc: "description",
  cost: "purchaseCost",
  "purchase cost": "purchaseCost",
  purchasecost: "purchaseCost",
  prix: "sellingPrice",
  "selling price": "sellingPrice",
  price: "sellingPrice",
  sellingprice: "sellingPrice",
  stock: "stock",
  sku: "sku",
  categorie: "category",
  category: "category",
  fournisseur: "supplierRef",
  supplier: "supplierRef",
  "supplier ref": "supplierRef",
};

export type ParsedProduct = {
  name: string;
  description: string;
  purchaseCost: number;
  sellingPrice: number;
  stock: number;
  sku: string;
  category: string;
  supplierRef: string;
};

/** Fields a compact message must contain to skip the wizard entirely. */
const REQUIRED_COMPACT_FIELDS: (keyof ParsedProduct)[] = [
  "name",
  "purchaseCost",
  "sellingPrice",
  "stock",
];

export type CompactParseResult =
  | { ok: true; product: ParsedProduct }
  | { ok: false; error: string; field?: keyof ParsedProduct };

/** Parse `Key: value` lines; unknown keys are ignored, not fatal. */
export function parseCompactProduct(text: string): CompactParseResult {
  const raw: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-zÀ-ÿ ]{2,20})\s*:\s*(.+)$/);
    if (!m) continue;
    const key = FIELD_ALIASES[m[1].trim().toLowerCase()];
    if (key) raw[key] = m[2].trim();
  }

  if (Object.keys(raw).length === 0) {
    return {
      ok: false,
      error:
        "Format non reconnu. Utilisez « Nom: … / Cost: … / Prix: … / Stock: … » ou /newproduct.",
    };
  }

  for (const field of REQUIRED_COMPACT_FIELDS) {
    if (!raw[field]) return { ok: false, error: `Champ manquant : ${field}.`, field };
  }

  const nameCheck = validateStepInput("NAME", raw.name);
  if (!nameCheck.ok) return { ok: false, error: nameCheck.error, field: "name" };

  const costCheck = validateStepInput("PURCHASE_COST", raw.purchaseCost);
  if (!costCheck.ok) return { ok: false, error: costCheck.error, field: "purchaseCost" };

  const priceCheck = validateStepInput("SELLING_PRICE", raw.sellingPrice);
  if (!priceCheck.ok) return { ok: false, error: priceCheck.error, field: "sellingPrice" };

  const stockCheck = validateStepInput("STOCK", raw.stock);
  if (!stockCheck.ok) return { ok: false, error: stockCheck.error, field: "stock" };

  const desc = (raw.description ?? "").trim();

  return {
    ok: true,
    product: {
      name: nameCheck.value,
      description: desc.slice(0, 2000),
      purchaseCost: costCheck.number!,
      sellingPrice: priceCheck.number!,
      stock: stockCheck.number!,
      sku: (raw.sku ?? "").slice(0, TEXT_MAX),
      category: (raw.category ?? "").slice(0, TEXT_MAX),
      supplierRef: (raw.supplierRef ?? "").slice(0, TEXT_MAX),
    },
  };
}

/** Business sanity check applied before the DRAFT is created. */
export function validateProductEconomics(p: {
  purchaseCost: number;
  sellingPrice: number;
}): { ok: true } | { ok: false; error: string } {
  if (p.sellingPrice <= 0) return { ok: false, error: "Le prix de vente est requis." };
  if (p.purchaseCost < 0) return { ok: false, error: "Le coût produit est invalide." };
  if (p.sellingPrice < p.purchaseCost) {
    return {
      ok: false,
      error:
        "Le prix de vente est inférieur au coût produit — vérifiez les valeurs saisies.",
    };
  }
  return { ok: true };
}

// ───────────────────────── Command parsing ─────────────────────────

/** `/newproduct@BotName args` → command + args. Handles the /done alias. */
export function parseCommand(
  text: string,
): { command: TelegramCommand | "done"; args: string } | null {
  const t = text.trim();
  if (!t.startsWith("/")) return null;
  const m = t.match(/^\/([a-z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i);
  if (!m) return null;
  const name = m[1].toLowerCase();
  const args = (m[2] ?? "").trim();
  if (name === "done") return { command: "done", args };
  if ((TELEGRAM_COMMANDS as readonly string[]).includes(name)) {
    return { command: name as TelegramCommand, args };
  }
  return null;
}
