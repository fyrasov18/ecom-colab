export type Locale = "fr" | "en" | "ar";

export const LOCALES: Locale[] = ["fr", "en", "ar"];
export const DEFAULT_LOCALE: Locale = "fr";

export interface LocaleInfo {
  code: Locale;
  label: string;
  nativeLabel: string;
  flag: string;
  dir: "ltr" | "rtl";
}

export const LOCALE_INFOS: Record<Locale, LocaleInfo> = {
  fr: {
    code: "fr",
    label: "Français",
    nativeLabel: "Français",
    flag: "🇫🇷",
    dir: "ltr",
  },
  en: {
    code: "en",
    label: "English",
    nativeLabel: "English",
    flag: "🇬🇧",
    dir: "ltr",
  },
  ar: {
    code: "ar",
    label: "Arabe",
    nativeLabel: "العربية",
    flag: "🇹🇳",
    dir: "rtl",
  },
};

export function isRTL(locale: Locale): boolean {
  return locale === "ar";
}
