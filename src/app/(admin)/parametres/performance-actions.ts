"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionError } from "@/lib/permissions";
import { z } from "zod";
import {
  PerformanceLevelError,
  assignPerformanceLevel,
  createPerformanceLevel,
  deletePerformanceLevel,
  updatePerformanceLevel,
} from "@/modules/finance/performance-service";

export type LevelActionState = { ok: boolean; error?: string; message?: string };

const formSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80),
  description: z.string().trim().max(500),
  sharePercentage: z.coerce.number().min(0).max(100),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
  isActive: z.coerce.boolean(),
});

function fail(e: unknown): LevelActionState {
  if (e instanceof z.ZodError) {
    return { ok: false, error: e.issues[0]?.message ?? "Données invalides." };
  }
  if (e instanceof PerformanceLevelError) return { ok: false, error: e.message };
  return { ok: false, error: "Opération impossible." };
}

export async function savePerformanceLevel(
  _prev: LevelActionState,
  formData: FormData,
): Promise<LevelActionState> {
  // Financial mutations require dedicated MANAGE_CONTRIBUTION_SETTINGS permission.
  let user;
  try {
    user = await requirePermission("MANAGE_CONTRIBUTION_SETTINGS");
  } catch (err) {
    if (err instanceof PermissionError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: "Action non autorisée : permission MANAGE_CONTRIBUTION_SETTINGS requise." };
  }
  const id = String(formData.get("id") ?? "").trim();
  try {
    const input = formSchema.parse({
      name: formData.get("name"),
      description: formData.get("description") ?? "",
      sharePercentage: formData.get("sharePercentage"),
      sortOrder: formData.get("sortOrder"),
      isActive: formData.get("isActive") === "on",
    });
    if (id) {
      await updatePerformanceLevel(id, input, user.id);
    } else {
      await createPerformanceLevel(input, user.id);
    }
    revalidatePath("/parametres");
    revalidatePath("/partenaires");
    return { ok: true, message: id ? "Niveau mis à jour." : "Niveau créé." };
  } catch (e) {
    return fail(e);
  }
}

export async function removePerformanceLevel(formData: FormData): Promise<void> {
  const user = await requirePermission("MANAGE_CONTRIBUTION_SETTINGS");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await deletePerformanceLevel(id, user.id);
  revalidatePath("/parametres");
  revalidatePath("/partenaires");
}

export async function changePartnerLevel(formData: FormData): Promise<void> {
  // Changing a partner's level changes their future financial contribution rate.
  // Dedicated MANAGE_CONTRIBUTION_SETTINGS permission is required.
  const user = await requirePermission("MANAGE_CONTRIBUTION_SETTINGS");
  const partnerId = String(formData.get("partnerId") ?? "").trim();
  const raw = String(formData.get("performanceLevelId") ?? "").trim();
  if (!partnerId) return;
  await assignPerformanceLevel(partnerId, raw || null, user.id);
  revalidatePath("/partenaires");
  revalidatePath(`/partenaires/${partnerId}`);
}
