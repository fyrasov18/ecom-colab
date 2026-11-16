"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, PermissionError } from "@/lib/permissions";
import {
  createPerformanceLevel,
  updatePerformanceLevel,
  deletePerformanceLevel,
  assignPerformanceLevel,
  getPartnerLevelHistory,
  evaluateAndPromoteEligiblePartners,
  PerformanceLevelError,
} from "@/modules/finance/performance-service";
import {
  performanceLevelCriteriaSchema,
  type PerformanceLevelInput,
} from "@/modules/finance/performance-levels";

export type ActionState<T = unknown> = {
  ok: boolean;
  error?: string;
  message?: string;
  data?: T;
};

async function requireLevelManagementUser() {
  try {
    return await requirePermission("MANAGE_CONTRIBUTION_SETTINGS");
  } catch (err) {
    if (err instanceof PermissionError) {
      try {
        return await requirePermission("MANAGE_PARTNERS");
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

const levelInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Le nom du niveau est requis").max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  sharePercentage: z.coerce
    .number()
    .min(0, "Le pourcentage ne peut pas être négatif")
    .max(100, "Le pourcentage ne peut pas dépasser 100 %"),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
  isActive: z.boolean().default(true),
  minDeliveredOrders: z.coerce.number().min(0).default(0),
  minDeliveryRate: z.coerce.number().min(0).max(100).default(0),
  minConfirmationRate: z.coerce.number().min(0).max(100).default(0),
  maxReturnRate: z.coerce.number().min(0).max(100).default(100),
  minTurnover: z.coerce.number().min(0).default(0),
  color: z.string().default("blue"),
  icon: z.string().default("Award"),
  nameEn: z.string().optional().default(""),
  nameAr: z.string().optional().default(""),
  benefits: z.array(z.string()).default([]),
});

export async function savePerformanceLevelAction(
  data: z.infer<typeof levelInputSchema>,
): Promise<ActionState> {
  try {
    const user = await requireLevelManagementUser();
    const parsed = levelInputSchema.parse(data);

    const criteria = performanceLevelCriteriaSchema.parse({
      minDeliveredOrders: parsed.minDeliveredOrders,
      minDeliveryRate: parsed.minDeliveryRate,
      minConfirmationRate: parsed.minConfirmationRate,
      maxReturnRate: parsed.maxReturnRate,
      minTurnover: parsed.minTurnover,
      color: parsed.color,
      icon: parsed.icon,
      nameEn: parsed.nameEn,
      nameAr: parsed.nameAr,
      benefits: parsed.benefits,
    });

    const input: PerformanceLevelInput = {
      name: parsed.name,
      description: parsed.description,
      sharePercentage: parsed.sharePercentage,
      sortOrder: parsed.sortOrder,
      isActive: parsed.isActive,
      criteria: criteria as unknown as Record<string, unknown>,
    };

    if (parsed.id) {
      await updatePerformanceLevel(parsed.id, input, user.id);
    } else {
      await createPerformanceLevel(input, user.id);
    }

    revalidatePath("/partenaires/niveaux");
    revalidatePath("/partenaires");
    revalidatePath("/parametres");

    return {
      ok: true,
      message: parsed.id ? "Niveau mis à jour avec succès." : "Niveau créé avec succès.",
    };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    if (err instanceof PerformanceLevelError) return { ok: false, error: err.message };
    if (err instanceof z.ZodError) {
      return { ok: false, error: err.issues[0]?.message ?? "Données invalides." };
    }
    return { ok: false, error: "Une erreur est survenue lors de l'enregistrement." };
  }
}

export async function deletePerformanceLevelAction(id: string): Promise<ActionState> {
  try {
    const user = await requireLevelManagementUser();
    if (!id) return { ok: false, error: "Identifiant manquant." };

    await deletePerformanceLevel(id, user.id);

    revalidatePath("/partenaires/niveaux");
    revalidatePath("/partenaires");
    revalidatePath("/parametres");

    return { ok: true, message: "Niveau supprimé avec succès." };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    if (err instanceof PerformanceLevelError) return { ok: false, error: err.message };
    return { ok: false, error: "Impossible de supprimer ce niveau." };
  }
}

export async function manualAssignPartnerLevelAction(payload: {
  partnerId: string;
  performanceLevelId: string | null;
  reason?: string;
}): Promise<ActionState> {
  try {
    const user = await requireLevelManagementUser();
    if (!payload.partnerId) return { ok: false, error: "Partenaire manquant." };

    await assignPerformanceLevel(
      payload.partnerId,
      payload.performanceLevelId || null,
      user.id,
      { reason: payload.reason?.trim() || "Attribution manuelle par l'administrateur" },
    );

    revalidatePath("/partenaires/niveaux");
    revalidatePath("/partenaires");
    revalidatePath(`/partenaires/${payload.partnerId}`);

    return { ok: true, message: "Niveau de performance attribué avec succès." };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    if (err instanceof PerformanceLevelError) return { ok: false, error: err.message };
    return { ok: false, error: "Échec de l'attribution du niveau." };
  }
}

export async function evaluateAllPartnersAction(): Promise<
  ActionState<{ promotedCount: number; promoted: Array<{ partnerId: string; partnerName: string; newLevelName: string }> }>
> {
  try {
    const user = await requireLevelManagementUser();
    const result = await evaluateAndPromoteEligiblePartners(user.id);

    revalidatePath("/partenaires/niveaux");
    revalidatePath("/partenaires");

    return {
      ok: true,
      message:
        result.promotedCount > 0
          ? `${result.promotedCount} partenaire(s) ont été promu(s) avec succès.`
          : "Tous les partenaires sont déjà à leur niveau d'éligibilité maximal.",
      data: result,
    };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    return { ok: false, error: "Erreur lors de l'évaluation des promotions." };
  }
}

export async function getPartnerHistoryAction(partnerId: string) {
  try {
    await requireLevelManagementUser();
    const history = await getPartnerLevelHistory(partnerId);
    return { ok: true, history };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur de chargement de l'historique.",
      history: [],
    };
  }
}
