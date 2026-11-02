import { z } from "zod";

export const categoryInputSchema = z.object({
  name: z
    .string({ required_error: "Le nom de la catégorie est obligatoire" })
    .trim()
    .min(2, "Le nom doit comporter au moins 2 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
  nameAr: z
    .string()
    .trim()
    .max(100, "Le nom en arabe ne peut pas dépasser 100 caractères")
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .trim()
    .max(1000, "La description ne peut pas dépasser 1000 caractères")
    .optional()
    .or(z.literal("")),
  icon: z
    .string()
    .trim()
    .max(100, "L'identifiant d'icône est trop long")
    .optional()
    .or(z.literal("")),
  imageUrl: z
    .string()
    .trim()
    .max(500, "L'URL de l'image est trop longue")
    .optional()
    .or(z.literal("")),
  displayOrder: z.coerce
    .number()
    .int("L'ordre d'affichage doit être un entier")
    .min(0, "L'ordre d'affichage doit être positif ou nul")
    .default(0),
  isActive: z.boolean().default(true),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;

export function slugifyCategory(name: string): string {
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 100);

  return normalized || "categorie";
}
