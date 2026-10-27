import { z } from "zod";

/**
 * Registration (public partner sign-up).
 * Labels are French; enum values stay ASCII — the mapping lives here only.
 * All security-relevant checks are enforced server-side in the service.
 */
export const EXPERIENCE_VALUES = ["DEBUTANT", "INTERMEDIAIRE", "EXPERT"] as const;
export type ExperienceValue = (typeof EXPERIENCE_VALUES)[number];

export const EXPERIENCE_LABELS: Record<ExperienceValue, string> = {
  DEBUTANT: "Débutant",
  INTERMEDIAIRE: "Intermédiaire",
  EXPERT: "Expert",
};

export const registrationSchema = z
  .object({
    fullName: z.string().trim().min(2, "Nom complet requis").max(120),
    email: z.string().trim().toLowerCase().email("Adresse e-mail invalide").max(255),
    phone: z
      .string()
      .trim()
      .min(8, "Numéro tunisien invalide (8 chiffres)")
      .max(20)
      .regex(
        /^(?:\+216[\s.\-()]*)?[24579][\s.\-()]*\d[\s.\-()]*\d[\s.\-()]*\d[\s.\-()]*\d[\s.\-()]*\d[\s.\-()]*\d[\s.\-()]*\d$/,
        "Numéro tunisien invalide (8 chiffres)",
      ),
    password: z.string().min(8, "8 caractères minimum").max(128),
    confirmPassword: z.string().min(1, "Confirmation requise"),
    invitationCode: z
      .string()
      .trim()
      .min(1, "Code d'invitation requis")
      .max(64)
      .regex(
        /^[a-zA-Z0-9_\-]+$/,
        "Code d'invitation invalide (caractères alphanumériques uniquement)",
      ),
    experience: z.enum(EXPERIENCE_VALUES, {
      errorMap: () => ({ message: "Expérience invalide" }),
    }),
    termsAccepted: z.literal(true, {
      errorMap: () => ({ message: "Vous devez accepter les conditions" }),
    }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;
