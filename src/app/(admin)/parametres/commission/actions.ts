"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requirePermission, PermissionError } from "@/lib/permissions";
import { SETTING_KEYS } from "@/modules/settings/defaults";
import { updateSetting, SettingValidationError } from "@/modules/settings/service";

export type CommissionSettingsState = {
  ok: boolean;
  message?: string;
  error?: string;
};

export async function saveCommissionSettings(
  _prev: CommissionSettingsState,
  formData: FormData,
): Promise<CommissionSettingsState> {
  let user;
  try {
    user = await requirePermission("MANAGE_CONTRIBUTION_SETTINGS");
  } catch (err) {
    if (err instanceof PermissionError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: "Action non autorisée : permission MANAGE_CONTRIBUTION_SETTINGS requise." };
  }

  const globalCommissionType = String(formData.get("globalCommissionType") ?? "");
  const globalCommissionValue = Number(formData.get("globalCommissionValue"));
  const returnRule = String(formData.get("returnCostRule") ?? "");
  const rawReason = String(formData.get("reason") ?? "");
  const trimmedReason = rawReason.trim();

  const updates = [
    {
      key: SETTING_KEYS.GLOBAL_COMMISSION,
      value: {
        commissionType: globalCommissionType,
        commissionValue: globalCommissionValue,
      },
    },
    { key: SETTING_KEYS.RETURN_COST_RULE, value: returnRule },
  ];

  try {
    let anyChanged = false;
    for (const u of updates) {
      const changed = await updateSetting({
        key: u.key,
        value: u.value,
        actorId: user.id,
        reason: trimmedReason,
      });
      if (changed) anyChanged = true;
    }

    if (!anyChanged) {
      return {
        ok: true,
        message: "Aucune modification détectée (valeurs inchangées).",
      };
    }
  } catch (e) {
    if (e instanceof SettingValidationError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof ZodError) {
      return {
        ok: false,
        error: `Valeur invalide : ${e.issues.map((i) => i.message).join(", ")}`,
      };
    }
    return {
      ok: false,
      error:
        e instanceof Error
          ? `Erreur lors de la sauvegarde : ${e.message}`
          : "Erreur lors de la sauvegarde.",
    };
  }

  revalidatePath("/parametres/commission");
  revalidatePath("/parametres");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: "Règles de commission enregistrées avec succès.",
  };
}
