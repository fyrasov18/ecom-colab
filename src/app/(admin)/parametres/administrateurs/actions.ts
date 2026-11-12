"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import {
  createAdministrator,
  updateAdministrator,
  toggleAdminStatus,
  resetAdminPassword,
} from "@/modules/admin-management/service";

export type AdminActionState = {
  ok: boolean;
  message?: string;
  error?: string;
};

export async function createAdminAction(
  _prev?: AdminActionState | null,
  formData?: FormData,
): Promise<AdminActionState> {
  const user = await requireSession(["SUPER_ADMIN"]);

  try {
    const form = formData ?? new FormData();
    const permissionsRaw = form.getAll("permissions").map(String);

    const raw = {
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      role: String(form.get("role") ?? "ADMIN"),
      permissions: permissionsRaw,
    };

    const res = await createAdministrator(user.id, raw);
    revalidatePath("/parametres/administrateurs");
    return { ok: true, message: `L'administrateur ${res.email} a été créé avec succès.` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors de la création.",
    };
  }
}

export async function updateAdminAction(
  _prev?: AdminActionState | null,
  formData?: FormData,
): Promise<AdminActionState> {
  const user = await requireSession(["SUPER_ADMIN"]);

  try {
    const form = formData ?? new FormData();
    const permissionsRaw = form.getAll("permissions").map(String);

    const raw = {
      adminId: String(form.get("adminId") ?? ""),
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      role: String(form.get("role") ?? "ADMIN"),
      status: String(form.get("status") ?? "ACTIVE"),
      permissions: permissionsRaw,
    };

    const res = await updateAdministrator(user.id, raw);
    revalidatePath("/parametres/administrateurs");
    return { ok: true, message: res.message };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors de la modification.",
    };
  }
}

export async function toggleAdminStatusAction(
  adminId: string,
  newStatus: "ACTIVE" | "DISABLED",
): Promise<AdminActionState> {
  const user = await requireSession(["SUPER_ADMIN"]);

  try {
    const res = await toggleAdminStatus(user.id, adminId, newStatus);
    revalidatePath("/parametres/administrateurs");
    return { ok: true, message: res.message };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors du changement de statut.",
    };
  }
}

export async function resetAdminPasswordAction(
  _prev?: AdminActionState | null,
  formData?: FormData,
): Promise<AdminActionState> {
  const user = await requireSession(["SUPER_ADMIN"]);

  try {
    const form = formData ?? new FormData();
    const adminId = String(form.get("adminId") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");

    const res = await resetAdminPassword(user.id, adminId, newPassword);
    revalidatePath("/parametres/administrateurs");
    return { ok: true, message: res.message };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors de la réinitialisation du mot de passe.",
    };
  }
}
