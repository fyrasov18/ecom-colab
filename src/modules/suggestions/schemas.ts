import { z } from "zod";

export const suggestionSubmissionSchema = z.object({
  name: z
    .string({ required_error: "Le nom du produit est obligatoire." })
    .trim()
    .min(2, "Le nom du produit doit comporter au moins 2 caractères.")
    .max(180, "Le nom du produit ne peut pas dépasser 180 caractères."),

  estimatedSellingPrice: z.coerce
    .number({
      required_error: "Le prix de vente estimé est obligatoire.",
      invalid_type_error: "Le prix de vente estimé doit être un nombre valide.",
    })
    .positive("Le prix de vente estimé doit être strictement supérieur à 0.")
    .max(99999, "Le prix estimé est trop élevé."),

  imageUrl: z
    .string({ required_error: "L'image du produit est obligatoire." })
    .trim()
    .min(1, "L'image du produit est obligatoire."),

  images: z.array(z.string().trim()).optional().default([]),

  description: z.string().trim().max(5000, "La description ne peut pas dépasser 5000 caractères.").optional().nullable(),

  estimatedPurchasePrice: z.coerce
    .number()
    .positive("Le prix d'achat fournisseur estimé doit être supérieur à 0.")
    .max(99999, "Le prix estimé est trop élevé.")
    .optional()
    .nullable(),

  supplierName: z.string().trim().max(160, "Le nom du fournisseur ne peut pas dépasser 160 caractères.").optional().nullable(),

  supplierContact: z.string().trim().max(200, "Le contact du fournisseur ne peut pas dépasser 200 caractères.").optional().nullable(),

  supplierUrl: z
    .string()
    .trim()
    .max(500, "L'URL ne peut pas dépasser 500 caractères.")
    .optional()
    .nullable()
    .refine((val) => !val || val === "" || /^https?:\/\//i.test(val), {
      message: "L'URL du fournisseur doit commencer par http:// ou https://",
    }),

  characteristics: z.string().trim().max(4000, "Les caractéristiques ne peuvent pas dépasser 4000 caractères.").optional().nullable(),

  targetAudience: z.string().trim().max(2000, "Le public cible ne peut pas dépasser 2000 caractères.").optional().nullable(),

  partnerReason: z.string().trim().max(3000, "La justification commerciale ne peut pas dépasser 3000 caractères.").optional().nullable(),

  additionalNotes: z.string().trim().max(3000, "Les notes supplémentaires ne peuvent pas dépasser 3000 caractères.").optional().nullable(),
});

export type SuggestionSubmissionInput = z.input<typeof suggestionSubmissionSchema>;
export type SuggestionSubmissionData = z.infer<typeof suggestionSubmissionSchema>;

export const suggestionStatusUpdateSchema = z.object({
  status: z.enum(["PENDING", "UNDER_REVIEW", "ACCEPTED", "REJECTED"]),
  partnerFeedback: z.string().trim().max(3000).optional().nullable(),
  internalNotes: z.string().trim().max(5000).optional().nullable(),
});

export type SuggestionStatusUpdateInput = z.input<typeof suggestionStatusUpdateSchema>;

export const linkProductSuggestionSchema = z.object({
  suggestionId: z.string().min(1, "L'identifiant de la suggestion est requis."),
  productId: z.string().min(1, "L'identifiant du produit est requis."),
  internalNotes: z.string().trim().max(5000).optional().nullable(),
});

export const createProductFromSuggestionSchema = z.object({
  suggestionId: z.string().min(1, "L'identifiant de la suggestion est requis."),
  name: z.string().trim().min(2, "Le nom du produit est requis.").max(180),
  description: z.string().trim().max(5000).optional().nullable(),
  purchaseCost: z.coerce.number().min(0, "Le coût d'achat doit être positif ou nul."),
  packagingCost: z.coerce.number().min(0, "Le coût d'emballage doit être positif ou nul.").default(1),
  deliveryCost: z.coerce.number().min(0, "Le coût de livraison doit être positif ou nul.").default(7),
  sellingPrice: z.coerce.number().positive("Le prix de vente doit être strictement supérieur à 0."),
  stockQuantity: z.coerce.number().int().min(0, "Le stock initial doit être positif ou nul.").default(10),
  lowStockThreshold: z.coerce.number().int().min(1).default(5),
  categoryId: z.string().optional().nullable(),
  isWinning: z.boolean().default(false),
  isNew: z.boolean().default(true),
  isRecommended: z.boolean().default(false),
  autoAssignToPartner: z.boolean().default(true),
  internalNotes: z.string().trim().max(5000).optional().nullable(),
});
