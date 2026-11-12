import { fr, type TranslationDictionary } from "./fr";
import { en } from "./en";
import { ar } from "./ar";
import type { Locale } from "../types";

export { fr, en, ar };
export type { TranslationDictionary };

export const DICTIONARIES: Record<Locale, TranslationDictionary> = {
  fr,
  en,
  ar,
};

export function getDictionary(locale: Locale): TranslationDictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES.fr;
}

/**
 * Nested key lookup with parameter interpolation.
 * Example: t('adminManagement.editModalTitle', { email: 'admin@test.com' })
 */
export function translateKey(
  dict: TranslationDictionary,
  path: string,
  params?: Record<string, string | number>,
): string {
  const parts = path.split(".");
  let current: unknown = dict;

  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      // Fallback to French if missing
      let fallbackCurrent: unknown = DICTIONARIES.fr;
      for (const fallbackPart of parts) {
        if (fallbackCurrent && typeof fallbackCurrent === "object" && fallbackPart in fallbackCurrent) {
          fallbackCurrent = (fallbackCurrent as Record<string, unknown>)[fallbackPart];
        } else {
          return path;
        }
      }
      current = fallbackCurrent;
      break;
    }
  }

  if (typeof current !== "string") {
    return path;
  }

  let result = current;
  if (params) {
    for (const [key, val] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(val));
    }
  }

  return result;
}
