"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useTransition,
} from "react";
import { DEFAULT_LOCALE, LOCALES, isRTL, type Locale, LOCALE_INFOS, type LocaleInfo } from "./types";
import { getDictionary, translateKey, type TranslationDictionary } from "./dictionaries";
import { saveUserLanguagePreferenceAction } from "./actions";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dir: "ltr" | "rtl";
  isRtl: boolean;
  dict: TranslationDictionary;
  localeInfo: LocaleInfo;
  t: (path: string, params?: Record<string, string | number>) => string;
  formatMoney: (amount: number | string | { toString(): string }, opts?: { showCurrency?: boolean }) => string;
  formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getClientInitialLocale(fallback: Locale): Locale {
  if (typeof window === "undefined") return fallback;

  try {
    // 1. URL search param ?lang=
    const q = new URLSearchParams(window.location.search).get("lang") as Locale | null;
    if (q && LOCALES.includes(q)) return q;

    // 2. LocalStorage
    const stored = (localStorage.getItem("ep_lang") || localStorage.getItem("ep_auth_lang")) as Locale | null;
    if (stored && LOCALES.includes(stored)) return stored;

    // 3. Document cookie
    const match = document.cookie.match(/(?:^|;\s*)ep_lang=([^;]+)/);
    if (match && LOCALES.includes(match[1] as Locale)) {
      return match[1] as Locale;
    }
  } catch {
    // Fallback
  }

  return fallback;
}

export function I18nProvider({
  initialLocale = DEFAULT_LOCALE,
  children,
}: {
  initialLocale?: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => getClientInitialLocale(initialLocale));
  const [, startTransition] = useTransition();

  // Sync DOM on mount or locale change, and listen to cross-tab / custom language events
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRTL(locale) ? "rtl" : "ltr";

    const handleStorage = () => {
      const stored = localStorage.getItem("ep_lang") as Locale | null;
      if (stored && LOCALES.includes(stored)) {
        setLocaleState(stored);
        document.documentElement.lang = stored;
        document.documentElement.dir = isRTL(stored) ? "rtl" : "ltr";
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("ep-lang-change", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("ep-lang-change", handleStorage);
    };
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    if (!LOCALES.includes(newLocale)) return;

    setLocaleState(newLocale);

    try {
      // 1. Update DOM
      document.documentElement.lang = newLocale;
      document.documentElement.dir = isRTL(newLocale) ? "rtl" : "ltr";

      // 2. Update Cookie (1 year)
      document.cookie = `ep_lang=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;

      // 3. Update localStorage
      localStorage.setItem("ep_lang", newLocale);
      localStorage.setItem("ep_auth_lang", newLocale);

      // 4. Dispatch event
      window.dispatchEvent(new Event("ep-lang-change"));
    } catch {
      // Ignore storage errors
    }

    // 5. Persist to server session/database in background
    startTransition(async () => {
      await saveUserLanguagePreferenceAction(newLocale).catch(() => {});
    });
  }, []);

  const dict = useMemo(() => getDictionary(locale), [locale]);
  const isRtl = useMemo(() => isRTL(locale), [locale]);
  const dir = isRtl ? "rtl" : "ltr";
  const localeInfo = LOCALE_INFOS[locale];

  const t = useCallback(
    (path: string, params?: Record<string, string | number>) => {
      return translateKey(dict, path, params);
    },
    [dict],
  );

  const formatMoney = useCallback(
    (amount: number | string | { toString(): string }, opts: { showCurrency?: boolean } = {}) => {
      const { showCurrency = true } = opts;
      const num = typeof amount === "number" ? amount : parseFloat(String(amount)) || 0;
      const formattedNumber = num.toFixed(3);

      if (!showCurrency) return formattedNumber;

      const currencyMap: Record<Locale, string> = {
        fr: "DT",
        en: "TND",
        ar: "د.ت",
      };
      const curr = currencyMap[locale];

      return `${formattedNumber} ${curr}`;
    },
    [locale],
  );

  const formatDate = useCallback(
    (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
      const d = typeof date === "object" ? date : new Date(date);
      const intlLocale = locale === "ar" ? "ar-TN" : locale === "en" ? "en-US" : "fr-FR";
      const defaultOpts: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "short",
        year: "numeric",
      };
      return new Intl.DateTimeFormat(intlLocale, options ?? defaultOpts).format(d);
    },
    [locale],
  );

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => {
      const intlLocale = locale === "ar" ? "ar-TN" : locale === "en" ? "en-US" : "fr-FR";
      return new Intl.NumberFormat(intlLocale, options).format(value);
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      dir,
      isRtl,
      dict,
      localeInfo,
      t,
      formatMoney,
      formatDate,
      formatNumber,
    }),
    [locale, setLocale, dir, isRtl, dict, localeInfo, t, formatMoney, formatDate, formatNumber],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Provide a resilient fallback if rendered outside provider (e.g. testing)
    const fallbackDict = getDictionary(DEFAULT_LOCALE);
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      dir: "ltr",
      isRtl: false,
      dict: fallbackDict,
      localeInfo: LOCALE_INFOS[DEFAULT_LOCALE],
      t: (path: string, params?: Record<string, string | number>) =>
        translateKey(fallbackDict, path, params),
      formatMoney: (a) => `${parseFloat(String(a)).toFixed(3)} DT`,
      formatDate: (d) => new Date(d).toLocaleDateString("fr-FR"),
      formatNumber: (n) => String(n),
    };
  }
  return ctx;
}
