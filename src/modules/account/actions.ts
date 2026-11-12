"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  updateAccountProfile,
  changeAccountPassword,
} from "./service";

export type AccountActionState = {
  ok: boolean;
  message?: string;
  error?: string;
};

export async function updateAccountProfileAction(
  _prev?: AccountActionState | null,
  formData?: FormData,
): Promise<AccountActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Non authentifié." };
  }

  try {
    const form = formData ?? new FormData();
    const raw = {
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      phone: String(form.get("phone") ?? ""),
    };

    const res = await updateAccountProfile(session.user.id, raw);
    revalidatePath("/parametres/compte");
    revalidatePath("/mon-compte");
    return { ok: true, message: res.message };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors de la mise à jour.",
    };
  }
}

export async function changeAccountPasswordAction(
  _prev?: AccountActionState | null,
  formData?: FormData,
): Promise<AccountActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Non authentifié." };
  }

  try {
    const form = formData ?? new FormData();
    const raw = {
      currentPassword: String(form.get("currentPassword") ?? ""),
      newPassword: String(form.get("newPassword") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
    };

    const res = await changeAccountPassword(session.user.id, raw);
    return { ok: true, message: res.message };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors de la modification du mot de passe.",
    };
  }
}
