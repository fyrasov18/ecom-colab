"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requirePermission, PermissionError } from "@/lib/permissions";
import { SETTING_KEYS } from "@/modules/settings/defaults";
import { updateSetting, SettingValidationError } from "@/modules/settings/service";

export type SettingsState = {
  ok: boolean;
  message?: string;
  error?: string;
};

export async function saveFinanceSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  let user;
  try {
    user = await requirePermission("MANAGE_CONTRIBUTION_SETTINGS");
  } catch (err) {
    if (err instanceof PermissionError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: "Action non autorisée : permission MANAGE_CONTRIBUTION_SETTINGS requise." };
  }

  const settlementHours = Number(formData.get("settlementPeriodHours"));
  const minWithdrawal = Number(formData.get("minWithdrawalAmount"));
  const minOrderContribution = Number(formData.get("minOrderContribution"));
  const returnRule = String(formData.get("returnCostRule") ?? "");
  const globalCommissionType = String(formData.get("globalCommissionType") ?? "");
  const globalCommissionValue = Number(formData.get("globalCommissionValue"));
  const rawReason = String(formData.get("reason") ?? "");
  const trimmedReason = rawReason.trim();

  const updates = [
    { key: SETTING_KEYS.SETTLEMENT_PERIOD_HOURS, value: settlementHours },
    { key: SETTING_KEYS.MIN_WITHDRAWAL_AMOUNT, value: minWithdrawal },
    { key: SETTING_KEYS.MIN_ORDER_CONTRIBUTION, value: minOrderContribution },
    { key: SETTING_KEYS.RETURN_COST_RULE, value: returnRule },
    {
      key: SETTING_KEYS.GLOBAL_COMMISSION,
      value: {
        commissionType: globalCommissionType,
        commissionValue: globalCommissionValue,
      },
    },
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

  revalidatePath("/parametres");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message:
      "Paramètres enregistrés avec succès. Les commandes déjà livrées conservent leur date de settlement d'origine.",
  };
}
