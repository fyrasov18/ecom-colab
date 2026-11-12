"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { partnerStatusSchema } from "@/modules/partners/schemas";
import {
  addSocialAccount,
  assignProductToPartner,
  assignProductWithTarget,
  deactivateAssignment,
  deletePartner,
  removeSocialAccount,
  setPartnerStatus,
  type AssignmentTargetType,
} from "@/modules/partners/service";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

export async function deletePartnerAction(formData: FormData): Promise<void> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const partnerId = str(formData.get("partnerId"));
  if (!partnerId) return;
  await deletePartner(partnerId, user.id);
  revalidatePath("/partenaires");
  revalidatePath("/dashboard");
}

export async function changePartnerStatus(formData: FormData): Promise<void> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const partnerId = str(formData.get("partnerId"));
  const parsed = partnerStatusSchema.safeParse(str(formData.get("status")));
  if (!parsed.success) return;
  await setPartnerStatus(partnerId, parsed.data, user.id);
  revalidatePath("/partenaires");
  revalidatePath(`/partenaires/${partnerId}`);
}

export async function addPartnerSocial(formData: FormData): Promise<void> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const partnerId = str(formData.get("partnerId"));
  await addSocialAccount(
    partnerId,
    {
      platform: str(formData.get("platform")) as never,
      label: str(formData.get("label")),
      url: str(formData.get("url")),
    },
    user.id,
  );
  revalidatePath(`/partenaires/${partnerId}`);
}

export async function removePartnerSocial(formData: FormData): Promise<void> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const id = str(formData.get("id"));
  await removeSocialAccount(id, user.id);
  revalidatePath("/partenaires");
}

export type ActionState = { ok: boolean; error?: string; message?: string };

/** Assign a product to partner(s) (by individual, level, all, or without level). */
export async function assignProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const targetTypeRaw = (str(formData.get("targetType")) as AssignmentTargetType) || "INDIVIDUAL";
  const partnerId = str(formData.get("partnerId"));
  const productId = str(formData.get("productId"));
  const performanceLevelId = str(formData.get("performanceLevelId"));
  const commissionTypeRaw = str(formData.get("commissionType"));
  const commissionValueRaw = str(formData.get("commissionValue"));
  const hasCommissionOverride = commissionTypeRaw !== "" || commissionValueRaw !== "";

  const canManageContribution = await hasPermission(user, "MANAGE_CONTRIBUTION_SETTINGS");
  if (hasCommissionOverride && !canManageContribution) {
    return {
      ok: false,
      error: "Action non autorisée : permission MANAGE_CONTRIBUTION_SETTINGS requise pour configurer une commission.",
    };
  }

  try {
    if (targetTypeRaw === "INDIVIDUAL") {
      await assignProductToPartner(
        {
          partnerId,
          productId,
          commissionType: commissionTypeRaw === "" ? null : (commissionTypeRaw as never),
          commissionValue: commissionValueRaw === "" ? null : Number(commissionValueRaw),
        },
        user.id,
        { allowCommission: canManageContribution },
      );
      if (partnerId) {
        revalidatePath(`/partenaires/${partnerId}`);
      }
      revalidatePath(`/produits/${productId}`);
      revalidatePath("/partenaires");
      revalidatePath("/catalogue");
      revalidatePath("/dashboard");
      return { ok: true, message: "Produit assigné." };
    }

    const result = await assignProductWithTarget(
      {
        productId,
        targetType: targetTypeRaw,
        partnerId: partnerId || null,
        performanceLevelId: performanceLevelId || null,
        commissionType: commissionTypeRaw === "" ? null : (commissionTypeRaw as never),
        commissionValue: commissionValueRaw === "" ? null : Number(commissionValueRaw),
      },
      user.id,
      { allowCommission: canManageContribution },
    );

    revalidatePath(`/produits/${productId}`);
    revalidatePath("/partenaires");
    revalidatePath("/catalogue");
    revalidatePath("/dashboard");

    if (result.totalEligible === 0) {
      return { ok: true, message: "Aucun partenaire éligible trouvé pour ce ciblage." };
    }
    if (result.assignedCount === 0 && result.alreadyAssignedCount > 0) {
      return { ok: true, message: "Tous les partenaires ciblés ont déjà ce produit assigné." };
    }

    const count = result.assignedCount;
    return {
      ok: true,
      message: count === 1 ? "1 partenaire assigné avec succès." : `${count} partenaires assignés avec succès.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur." };
  }
}

export async function removeAssignment(formData: FormData): Promise<void> {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const partnerId = str(formData.get("partnerId"));
  const productId = str(formData.get("productId"));
  await deactivateAssignment(partnerId, productId, user.id);
  revalidatePath(`/partenaires/${partnerId}`);
  revalidatePath("/partenaires");
  revalidatePath("/catalogue");
}
