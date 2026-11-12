"use server";

import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LOCALES, type Locale } from "./types";

export async function saveUserLanguagePreferenceAction(
  locale: Locale,
): Promise<{ success: boolean; message: string }> {
  if (!LOCALES.includes(locale)) {
    return { success: false, message: "Langue non supportée." };
  }

  try {
    const cookieStore = await cookies();
    cookieStore.set("ep_lang", locale, {
      path: "/",
      maxAge: 31536000, // 1 year
      sameSite: "lax",
    });
  } catch {
    // Cookie error
  }

  // If user is authenticated, save preference to database
  try {
    const session = await auth();
    if (session?.user?.id) {
      await prisma.systemSetting.upsert({
        where: { key: `user.language.${session.user.id}` },
        create: {
          key: `user.language.${session.user.id}`,
          value: locale,
          category: "security",
          description: `Préférence linguistique de l'utilisateur ${session.user.id}`,
          updatedById: session.user.id,
        },
        update: {
          value: locale,
          updatedById: session.user.id,
        },
      });
    }
  } catch {
    // Non-blocking database fallback
  }

  return { success: true, message: "Préférence enregistrée." };
}
