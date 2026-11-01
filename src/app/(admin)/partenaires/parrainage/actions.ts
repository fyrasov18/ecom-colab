"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import {
  approveReferralCommission,
  rejectReferralCommission,
  payReferralCommission,
  ReferralCommissionError,
} from "@/modules/finance/referral-commissions";
import {
  confirmPartnerPromotion,
  rejectPartnerPromotion,
  reEvaluatePartnerPromotion,
  updateReferralSettings,
  ReferralLevel,
} from "@/modules/referrals/levels";

export type AdminCommissionActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  data?: unknown;
};

function extractPayload(
  arg1: unknown,
  arg2?: unknown,
): FormData | Record<string, unknown> {
  if (arg2 !== undefined && arg2 !== null && typeof arg2 === "object") {
    return arg2 as FormData | Record<string, unknown>;
  }
  if (arg1 !== undefined && arg1 !== null && typeof arg1 === "object") {
    return arg1 as FormData | Record<string, unknown>;
  }
  return {};
}

function getField(payload: FormData | Record<string, unknown>, key: string): string {
  if (payload instanceof FormData) {
    const v = payload.get(key);
    return v !== null ? String(v).trim() : "";
  }
  const v = payload[key];
  return v !== undefined && v !== null ? String(v).trim() : "";
}

/**
 * Admin server action: Approves an eligible referral commission for payment.
 * Strictly enforces SUPER_ADMIN or ADMIN role.
 */
export async function approveCommissionAction(
  arg1: unknown,
  arg2?: unknown,
): Promise<AdminCommissionActionState> {
  try {
    const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
    const payload = extractPayload(arg1, arg2);
    const commissionId = getField(payload, "commissionId");

    if (!commissionId) {
      return { ok: false, error: "Identifiant de commission manquant." };
    }

    const updated = await approveReferralCommission(commissionId, user.id);
    revalidatePath("/partenaires/parrainage");
    return {
      ok: true,
      message: "Commission approuvée pour paiement avec succès.",
      data: updated,
    };
  } catch (error) {
    const message =
      error instanceof ReferralCommissionError || error instanceof Error
        ? error.message
        : "Erreur lors de l'approbation de la commission.";
    return { ok: false, error: message };
  }
}

/**
 * Admin server action: Rejects a referral commission.
 * Requires a mandatory non-empty reason.
 * Strictly enforces SUPER_ADMIN or ADMIN role.
 */
export async function rejectCommissionAction(
  arg1: unknown,
  arg2?: unknown,
): Promise<AdminCommissionActionState> {
  try {
    const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
    const payload = extractPayload(arg1, arg2);
    const commissionId = getField(payload, "commissionId");
    const reason = getField(payload, "reason") || getField(payload, "rejectionReason");

    if (!commissionId) {
      return { ok: false, error: "Identifiant de commission manquant." };
    }

    if (!reason || reason.trim().length === 0) {
      return {
        ok: false,
        error: "Le motif de rejet est obligatoire pour rejeter une commission.",
      };
    }

    const updated = await rejectReferralCommission(commissionId, user.id, reason.trim());
    revalidatePath("/partenaires/parrainage");
    return {
      ok: true,
      message: "Commission rejetée.",
      data: updated,
    };
  } catch (error) {
    const message =
      error instanceof ReferralCommissionError || error instanceof Error
        ? error.message
        : "Erreur lors du rejet de la commission.";
    return { ok: false, error: message };
  }
}

/**
 * Admin server action: Records payment for an approved referral commission.
 * Strictly requires transactionReference.
 * Strictly enforces SUPER_ADMIN or ADMIN role.
 */
export async function payCommissionAction(
  arg1: unknown,
  arg2?: unknown,
): Promise<AdminCommissionActionState> {
  try {
    const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
    const payload = extractPayload(arg1, arg2);
    const commissionId = getField(payload, "commissionId");
    const transactionReference =
      getField(payload, "transactionReference") || getField(payload, "reference");

    if (!commissionId) {
      return { ok: false, error: "Identifiant de commission manquant." };
    }

    if (!transactionReference || transactionReference.trim().length === 0) {
      return {
        ok: false,
        error: "La référence de transaction est obligatoire pour enregistrer le paiement.",
      };
    }

    const updated = await payReferralCommission(
      commissionId,
      user.id,
      transactionReference.trim(),
    );
    revalidatePath("/partenaires/parrainage");
    return {
      ok: true,
      message: "Paiement enregistré avec succès.",
      data: updated,
    };
  } catch (error) {
    const message =
      error instanceof ReferralCommissionError || error instanceof Error
        ? error.message
        : "Erreur lors de l'enregistrement du paiement.";
    return { ok: false, error: message };
  }
}

/**
 * Admin server action: Confirms promotion of a partner to a higher referral level.
 * Strictly enforces SUPER_ADMIN or ADMIN role.
 */
export async function confirmPromotionAction(
  arg1: unknown,
  arg2?: unknown,
): Promise<AdminCommissionActionState> {
  try {
    const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
    const payload = extractPayload(arg1, arg2);
    const partnerId = getField(payload, "partnerId");
    const targetLevelRaw = getField(payload, "targetLevel");

    if (!partnerId) {
      return { ok: false, error: "Identifiant du partenaire manquant." };
    }

    let targetLevel: ReferralLevel | undefined = undefined;
    if (targetLevelRaw) {
      const parsedLevel = parseInt(targetLevelRaw, 10);
      if (parsedLevel >= 1 && parsedLevel <= 5) {
        targetLevel = parsedLevel as ReferralLevel;
      }
    }

    const result = await confirmPartnerPromotion(partnerId, targetLevel, user.id);
    revalidatePath("/partenaires/parrainage");
    return {
      ok: true,
      message: `Promotion confirmée avec succès (Niveau ${result.level}).`,
      data: result,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur lors de la confirmation de promotion.";
    return { ok: false, error: message };
  }
}

/**
 * Admin server action: Rejects promotion of a partner with a reason.
 * Strictly enforces SUPER_ADMIN or ADMIN role.
 */
export async function rejectPromotionAction(
  arg1: unknown,
  arg2?: unknown,
): Promise<AdminCommissionActionState> {
  try {
    const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
    const payload = extractPayload(arg1, arg2);
    const partnerId = getField(payload, "partnerId");
    const reason = getField(payload, "reason");

    if (!partnerId) {
      return { ok: false, error: "Identifiant du partenaire manquant." };
    }

    if (!reason || reason.trim().length === 0) {
      return { ok: false, error: "Le motif du refus est obligatoire." };
    }

    const result = await rejectPartnerPromotion(partnerId, user.id, reason.trim());
    revalidatePath("/partenaires/parrainage");
    return {
      ok: true,
      message: `Demande de promotion rejetée. Le partenaire reste au Niveau ${result.level}.`,
      data: result,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur lors du rejet de la promotion.";
    return { ok: false, error: message };
  }
}

/**
 * Admin server action: Saves dynamic referral threshold and order qualification settings.
 * Strictly enforces SUPER_ADMIN role.
 */
export async function saveReferralSettingsAction(
  _prev: AdminCommissionActionState,
  formData: FormData,
): Promise<AdminCommissionActionState> {
  try {
    const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
    const l2 = parseInt(String(formData.get("level2Threshold") ?? ""), 10);
    const l3 = parseInt(String(formData.get("level3Threshold") ?? ""), 10);
    const l4 = parseInt(String(formData.get("level4Threshold") ?? ""), 10);
    const l5 = parseInt(String(formData.get("level5Threshold") ?? ""), 10);
    const reqOrders = parseInt(String(formData.get("requiredOrdersToQualify") ?? ""), 10);

    await updateReferralSettings(
      {
        level2Threshold: isNaN(l2) ? undefined : l2,
        level3Threshold: isNaN(l3) ? undefined : l3,
        level4Threshold: isNaN(l4) ? undefined : l4,
        level5Threshold: isNaN(l5) ? undefined : l5,
        requiredOrdersToQualify: isNaN(reqOrders) ? undefined : reqOrders,
      },
      user.id,
    );

    revalidatePath("/partenaires/parrainage");
    return { ok: true, message: "Paramètres de parrainage enregistrés avec succès." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur d'enregistrement des paramètres." };
  }
}


/**
 * Admin server action: Re-evaluates partner promotion eligibility.
 * Strictly enforces SUPER_ADMIN or ADMIN role.
 */
export async function reEvaluatePromotionAction(
  arg1: unknown,
  arg2?: unknown,
): Promise<AdminCommissionActionState> {
  try {
    const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
    const payload = extractPayload(arg1, arg2);
    const partnerId = getField(payload, "partnerId");

    if (!partnerId) {
      return { ok: false, error: "Identifiant du partenaire manquant." };
    }

    const result = await reEvaluatePartnerPromotion(partnerId, user.id);
    revalidatePath("/partenaires/parrainage");
    return {
      ok: true,
      message: `Réévaluation terminée. Statut: ${result.promotionPendingConfirmation ? "En attente de confirmation" : "À jour"}.`,
      data: result,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur lors de la réévaluation.";
    return { ok: false, error: message };
  }
}
