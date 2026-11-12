import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./types";

export async function getServerLocale(): Promise<Locale> {
  try {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get("ep_lang")?.value as Locale | undefined;
    if (cookieLocale && LOCALES.includes(cookieLocale)) {
      return cookieLocale;
    }
  } catch {
    // If called outside request context (e.g. tests or build time)
  }
  return DEFAULT_LOCALE;
}
