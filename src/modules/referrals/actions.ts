"use server";

import { requireSession } from "@/lib/rbac";
import { getOrCreateReferralCode, ReferralAuthorizationError } from "./service";

export type PartnerReferralLinkActionResult =
  | { ok: true; code: string; url: string }
  | { ok: false; error: string };

/**
 * Server action: generates or fetches the authenticated partner's referral link.
 * Strictly derives partnerId from session.user.partnerId via requireSession(["PARTNER"]).
 * Completely immune to IDOR (no client-supplied partnerId parameter accepted).
 */
export async function getPartnerReferralLinkAction(): Promise<PartnerReferralLinkActionResult> {
  try {
    const user = await requireSession(["PARTNER"]);
    if (!user.partnerId) {
      return { ok: false, error: "Identifiant partenaire introuvable dans la session." };
    }

    const result = await getOrCreateReferralCode(user.partnerId);
    return { ok: true, code: result.code, url: result.url };
  } catch (error) {
    if (error instanceof ReferralAuthorizationError) {
      return { ok: false, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Erreur lors de la génération du lien de parrainage.";
    return { ok: false, error: message };
  }
}
