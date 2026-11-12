import { describe, it, expect } from "vitest";
import {
  LOCALES,
  DEFAULT_LOCALE,
  isRTL,
  LOCALE_INFOS,
  type Locale,
} from "@/lib/i18n/types";
import {
  fr,
  en,
  ar,
  getDictionary,
  translateKey,
  type TranslationDictionary,
} from "@/lib/i18n/dictionaries";

describe("Multilingual System — Dictionaries & Types", () => {
  it("defines the supported locales correctly", () => {
    expect(LOCALES).toEqual(["fr", "en", "ar"]);
    expect(DEFAULT_LOCALE).toBe("fr");
  });

  it("identifies RTL correctly", () => {
    expect(isRTL("ar")).toBe(true);
    expect(isRTL("fr")).toBe(false);
    expect(isRTL("en")).toBe(false);
    // @ts-expect-error test unknown locale fallback
    expect(isRTL("de")).toBe(false);
  });

  it("provides correct metadata for all locales", () => {
    expect(LOCALE_INFOS.fr.dir).toBe("ltr");
    expect(LOCALE_INFOS.fr.label).toBe("Français");
    expect(LOCALE_INFOS.fr.flag).toBe("🇫🇷");

    expect(LOCALE_INFOS.en.dir).toBe("ltr");
    expect(LOCALE_INFOS.en.label).toBe("English");
    expect(LOCALE_INFOS.en.flag).toBe("🇬🇧");

    expect(LOCALE_INFOS.ar.dir).toBe("rtl");
    expect(LOCALE_INFOS.ar.nativeLabel).toBe("العربية");
    expect(LOCALE_INFOS.ar.flag).toBe("🇹🇳");
  });

  // Recursive key validator
  function getDeepKeys(obj: Record<string, unknown>, prefix = ""): string[] {
    let keys: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        keys = keys.concat(getDeepKeys(v as Record<string, unknown>, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    return keys;
  }

  it("contains identical structure in English and Arabic compared to French dictionary", () => {
    const frKeys = getDeepKeys(fr as unknown as Record<string, unknown>).sort();
    const enKeys = getDeepKeys(en as unknown as Record<string, unknown>).sort();
    const arKeys = getDeepKeys(ar as unknown as Record<string, unknown>).sort();

    // Check English
    const missingInEn = frKeys.filter((k) => !enKeys.includes(k));
    const extraInEn = enKeys.filter((k) => !frKeys.includes(k));
    expect(missingInEn).toEqual([]);
    expect(extraInEn).toEqual([]);

    // Check Arabic
    const missingInAr = frKeys.filter((k) => !arKeys.includes(k));
    const extraInAr = arKeys.filter((k) => !frKeys.includes(k));
    expect(missingInAr).toEqual([]);
    expect(extraInAr).toEqual([]);
  });

  it("ensures no translations are empty strings", () => {
    const checkNoEmptyValues = (dict: Record<string, unknown>, lang: string) => {
      for (const [k, v] of Object.entries(dict)) {
        if (typeof v === "string") {
          expect(v.trim().length, `Empty translation for key ${k} in ${lang}`).toBeGreaterThan(0);
        } else if (v && typeof v === "object") {
          checkNoEmptyValues(v as Record<string, unknown>, `${lang}.${k}`);
        }
      }
    };

    checkNoEmptyValues(fr as unknown as Record<string, unknown>, "fr");
    checkNoEmptyValues(en as unknown as Record<string, unknown>, "en");
    checkNoEmptyValues(ar as unknown as Record<string, unknown>, "ar");
  });

  it("translates keys with fallback to French", () => {
    expect(translateKey(fr, "common.save")).toBe("Enregistrer");
    expect(translateKey(en, "common.save")).toBe("Save");
    expect(translateKey(ar, "common.save")).toBe("حفظ");

    // Missing key in dummy dictionary should fallback to French
    const partialDict = { common: {} };
    expect(translateKey(partialDict as unknown as TranslationDictionary, "common.save")).toBe("Enregistrer");
  });

  it("interpolates parameters accurately", () => {
    expect(
      translateKey(fr, "adminManagement.editModalTitle", {
        email: "karim@example.com",
      })
    ).toBe("Modifier l'administrateur : karim@example.com");

    expect(
      translateKey(en, "adminManagement.editModalTitle", {
        email: "karim@example.com",
      })
    ).toBe("Edit Administrator: karim@example.com");

    expect(
      translateKey(ar, "adminManagement.editModalTitle", {
        email: "karim@example.com",
      })
    ).toBe("تعديل حساب المدير: karim@example.com");
  });

  it("handles getDictionary for all locales with fallback", () => {
    expect(getDictionary("fr")).toBe(fr);
    expect(getDictionary("en")).toBe(en);
    expect(getDictionary("ar")).toBe(ar);
    // @ts-expect-error testing invalid locale
    expect(getDictionary("es")).toBe(fr);
  });
});
