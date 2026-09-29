"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import {
  authorizeTelegramUser,
  revokeTelegramUser,
  TelegramError,
} from "@/modules/telegram/service";

/**
 * Granting or revoking ingestion rights is a security decision, so both actions
 * are SUPER_ADMIN only. Errors are surfaced as plain text — never stack traces.
 */
export async function authorizeUserAction(formData: FormData): Promise<void> {
  const user = await requireSession(["SUPER_ADMIN"]);
  const telegramUserId = String(formData.get("telegramUserId") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim() || null;
  try {
    await authorizeTelegramUser(telegramUserId, displayName, user.id);
  } catch (e) {
    if (e instanceof TelegramError) throw new Error(e.message);
    throw new Error("Impossible d'autoriser ce compte.");
  }
  revalidatePath("/parametres/system");
}

export async function revokeUserAction(formData: FormData): Promise<void> {
  const user = await requireSession(["SUPER_ADMIN"]);
  const telegramUserId = String(formData.get("telegramUserId") ?? "").trim();
  if (!telegramUserId) return;
  try {
    await revokeTelegramUser(telegramUserId, user.id);
  } catch {
    throw new Error("Impossible de révoquer ce compte.");
  }
  revalidatePath("/parametres/system");
}
