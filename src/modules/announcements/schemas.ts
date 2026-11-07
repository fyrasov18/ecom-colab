import { z } from "zod";

export const welcomeSettingsSchema = z.object({
  isEnabled: z.boolean().default(true),
  title: z
    .string()
    .trim()
    .min(2, "Le titre est obligatoire")
    .max(160, "Le titre est trop long")
    .default("Bienvenue chez Ecom Partner, {partnerName} ! 🎉"),
  message: z
    .string()
    .trim()
    .min(5, "Le message est obligatoire")
    .max(2000, "Le message est trop long")
    .default(
      "Votre compte partenaire a été validé avec succès. Félicitations !",
    ),
  buttonText: z.string().trim().min(1, "Le texte du bouton est requis").default("Découvrir mon espace"),
  buttonUrl: z.string().trim().min(1, "Le lien du bouton est requis").default("/catalogue"),
  badgeText: z.string().trim().max(50).default("Compte partenaire activé"),
  bannerText: z.string().trim().max(200).optional().default("🚀 Bien plus qu’une simple plateforme de dropshipping !"),
  imageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  themeColor: z.enum(["indigo", "emerald", "amber", "rose", "purple", "blue"]).default("purple"),
});

export type WelcomeSettings = z.infer<typeof welcomeSettingsSchema>;

export const levelUpSettingsSchema = z.object({
  isEnabled: z.boolean().default(true),
  title: z
    .string()
    .trim()
    .min(2, "Le titre est obligatoire")
    .max(160, "Le titre est trop long")
    .default("Félicitations {partnerName} ! Vous passez au Niveau {newLevel} !"),
  message: z
    .string()
    .trim()
    .min(5, "Le message est obligatoire")
    .max(2000, "Le message est trop long")
    .default(
      "Grâce à vos performances, votre statut partenaire progresse officiellement. Votre commission de parrainage passe désormais à {commissionRate} % ! Continuez sur cette lancée pour débloquer les paliers supérieurs.",
    ),
  buttonText: z.string().trim().min(1, "Le texte du bouton est requis").default("Voir mes nouveaux avantages"),
  buttonUrl: z.string().trim().min(1, "Le lien du bouton est requis").default("/parrainage"),
  imageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  themeColor: z.enum(["amber", "indigo", "emerald", "purple", "rose"]).default("amber"),
});

export type LevelUpSettings = z.infer<typeof levelUpSettingsSchema>;

export const announcementInputSchema = z.object({
  title: z
    .string({ required_error: "Le titre est requis" })
    .trim()
    .min(2, "Le titre doit comporter au moins 2 caractères")
    .max(160, "Le titre ne peut pas dépasser 160 caractères"),
  content: z
    .string({ required_error: "Le contenu est requis" })
    .trim()
    .min(5, "Le contenu doit comporter au moins 5 caractères")
    .max(5000, "Le contenu ne peut pas dépasser 5000 caractères"),
  type: z.enum(["PRODUCT", "PROMO", "INFO", "FEATURE", "TRAINING"]).default("INFO"),
  imageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  buttonText: z.string().trim().max(60).optional().or(z.literal("")),
  buttonUrl: z.string().trim().max(500).optional().or(z.literal("")),
  targetAudience: z
    .enum([
      "ALL",
      "ACTIVE_ONLY",
      "LEVEL_1",
      "LEVEL_2",
      "LEVEL_3",
      "LEVEL_4",
      "LEVEL_5",
    ])
    .default("ALL"),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  scheduledAt: z.string().optional().or(z.literal("")),
  isFullScreen: z.boolean().default(true),
});

export type AnnouncementInput = z.infer<typeof announcementInputSchema>;
