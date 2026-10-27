"use server";

import { headers } from "next/headers";
import { checkRateLimit, clientIpFrom, rateLimitMessage } from "@/lib/rate-limit";
import { registerPartner } from "@/modules/registration/service";

export type RegisterState = {
  ok: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
};

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

/** Public sign-up action — all validation re-runs server-side. */
export async function registerAction(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const ip = clientIpFrom(await headers());
  const limit = await checkRateLimit("REGISTER", ip);
  if (!limit.allowed) {
    return { ok: false, error: rateLimitMessage(limit) };
  }

  const result = await registerPartner({
    fullName: str(formData.get("fullName")),
    email: str(formData.get("email")),
    phone: str(formData.get("phone")),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    invitationCode: str(formData.get("invitationCode")),
    experience: str(formData.get("experience")),
    // Checkbox: only the exact "on"/"true" submission counts — never trusted blindly.
    termsAccepted: formData.get("termsAccepted") === "on" || formData.get("termsAccepted") === "true",
  });

  if (!result.ok) return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
  return {
    ok: true,
    message: "Compte créé. En attente de validation par l'administrateur.",
  };
}
