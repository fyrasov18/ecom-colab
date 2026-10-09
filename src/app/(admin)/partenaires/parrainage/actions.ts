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
      if (parsedLevel === 1 || parsedLevel === 2 || parsedLevel === 3) {
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
