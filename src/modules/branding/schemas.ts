import { z } from "zod";

export const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

export const hexColorSchema = z
  .string()
  .trim()
  .regex(hexColorRegex, "Doit être une couleur hexadécimale valide (ex: #10B981)");

export const optionalHexColorSchema = z
  .string()
  .trim()
  .regex(hexColorRegex, "Doit être une couleur hexadécimale valide (ex: #10B981)")
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

export const optionalUrlSchema = z
  .string()
  .trim()
  .max(2000, "URL trop longue (2000 caractères max)")
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

export const platformBrandingSchema = z.object({
  platformName: z
    .string()
    .trim()
    .min(2, "Le nom de la plateforme doit comporter au moins 2 caractères")
    .max(50, "Le nom de la plateforme ne peut dépasser 50 caractères"),
  platformTagline: z
    .string()
    .trim()
    .max(100, "Le slogan ne peut dépasser 100 caractères")
    .default(""),
  platformDescription: z
    .string()
    .trim()
    .max(300, "La description ne peut dépasser 300 caractères")
    .default(""),
  logoLightUrl: optionalUrlSchema,
  logoDarkUrl: optionalUrlSchema,
  logoMarkUrl: optionalUrlSchema,
  faviconUrl: optionalUrlSchema,
});

export type PlatformBrandingInput = z.infer<typeof platformBrandingSchema>;

export const dashboardDesignSchema = z.object({
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  accentColor: hexColorSchema,
  sidebarBg: hexColorSchema,
  borderRadius: z.enum(["6px", "10px", "14px", "20px"]).default("10px"),
  themeMode: z.enum(["system", "light", "dark"]).default("system"),
});

export type DashboardDesignInput = z.infer<typeof dashboardDesignSchema>;

export const partnerBrandingSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, "Le nom commercial doit comporter au moins 2 caractères")
    .max(80, "Le nom commercial ne peut dépasser 80 caractères")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  companyLogoUrl: optionalUrlSchema,
  companyLogoDarkUrl: optionalUrlSchema,
  companyMarkUrl: optionalUrlSchema,
  brandColorPrimary: optionalHexColorSchema,
  brandColorSecondary: optionalHexColorSchema,
  companyDescription: z
    .string()
    .trim()
    .max(500, "La description ne peut dépasser 500 caractères")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  supportEmail: z
    .string()
    .trim()
    .email("Adresse email invalide")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  supportPhone: z
    .string()
    .trim()
    .regex(/^[0-9+() -]{8,20}$/, "Numéro de téléphone invalide (au moins 8 chiffres)")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  websiteUrl: z
    .string()
    .trim()
    .url("URL de site web invalide (doit commencer par http:// ou https://)")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
});

export type PartnerBrandingInput = z.infer<typeof partnerBrandingSchema>;
