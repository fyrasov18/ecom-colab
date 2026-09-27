"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { SETTING_KEYS } from "@/modules/settings/defaults";
import { updateSetting } from "@/modules/settings/service";

export type SettingsState = {
  ok: boolean;
  message?: string;
  error?: string;
};

export async function saveFinanceSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireSession(["SUPER_ADMIN"]);

  const settlementHours = Number(formData.get("settlementPeriodHours"));
  const minWithdrawal = Number(formData.get("minWithdrawalAmount"));
  const returnRule = String(formData.get("returnCostRule") ?? "");

  try {
    await updateSetting({
      key: SETTING_KEYS.SETTLEMENT_PERIOD_HOURS,
      value: settlementHours,
      actorId: user.id,
    });
    await updateSetting({
      key: SETTING_KEYS.MIN_WITHDRAWAL_AMOUNT,
      value: minWithdrawal,
      actorId: user.id,
    });
    await updateSetting({
      key: SETTING_KEYS.RETURN_COST_RULE,
      value: returnRule,
      actorId: user.id,
    });
  } catch (e) {
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
      "Paramètres enregistrés. Les commandes déjà livrées conservent leur date de settlement d'origine.",
  };
}
