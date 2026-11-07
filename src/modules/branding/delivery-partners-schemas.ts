import { z } from "zod";

const urlOrNull = z
  .string()
  .trim()
  .nullish()
  .transform((val) => (val && val.length > 0 ? val : null));

export const deliveryPartnerItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Le nom du transporteur est requis").max(100),
  logoUrl: urlOrNull,
  displayOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  websiteUrl: urlOrNull,
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});

export type DeliveryPartnerItem = z.infer<typeof deliveryPartnerItemSchema>;

export const deliveryPartnersConfigSchema = z.object({
  enabled: z.boolean().default(true),
  title: z.object({
    fr: z.string().trim().min(1).default("Nos partenaires de livraison"),
    ar: z.string().trim().min(1).default("شركاؤنا في التوصيل"),
    en: z.string().trim().min(1).default("Our Delivery Partners"),
  }),
  subtitle: z.object({
    fr: z.string().trim().default(
      "Un réseau de partenaires pour accompagner vos opérations de livraison."
    ),
    ar: z.string().trim().default(
      "شبكة من الشركاء لدعم ومرافقة عمليات التوصيل الخاصة بكم."
    ),
    en: z.string().trim().default(
      "A network of partners to support your delivery operations."
    ),
  }),
  partners: z.array(deliveryPartnerItemSchema).default([]),
});

export type DeliveryPartnersConfig = z.infer<typeof deliveryPartnersConfigSchema>;

export const DEFAULT_DELIVERY_PARTNERS_CONFIG: DeliveryPartnersConfig = {
  enabled: true,
  title: {
    fr: "Nos partenaires de livraison",
    ar: "شركاؤنا في التوصيل",
    en: "Our Delivery Partners",
  },
  subtitle: {
    fr: "Un réseau de partenaires pour accompagner vos opérations de livraison.",
    ar: "شبكة من الشركاء لدعم ومرافقة عمليات التوصيل الخاصة بكم.",
    en: "A network of partners to support your delivery operations.",
  },
  partners: [],
};

export const addDeliveryPartnerSchema = z.object({
  name: z.string().trim().min(1, "Le nom du transporteur est obligatoire").max(100),
  logoUrl: urlOrNull,
  displayOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  websiteUrl: urlOrNull,
});

export type AddDeliveryPartnerInput = z.infer<typeof addDeliveryPartnerSchema>;

export const updateDeliveryPartnerSchema = z.object({
  name: z.string().trim().min(1, "Le nom du transporteur est obligatoire").max(100).optional(),
  logoUrl: urlOrNull.optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  websiteUrl: urlOrNull.optional(),
});

export type UpdateDeliveryPartnerInput = z.infer<typeof updateDeliveryPartnerSchema>;

export const updateDeliveryPartnersConfigSchema = z.object({
  enabled: z.boolean().optional(),
  title: z
    .object({
      fr: z.string().trim().min(1).optional(),
      ar: z.string().trim().min(1).optional(),
      en: z.string().trim().min(1).optional(),
    })
    .optional(),
  subtitle: z
    .object({
      fr: z.string().trim().optional(),
      ar: z.string().trim().optional(),
      en: z.string().trim().optional(),
    })
    .optional(),
});

export type UpdateDeliveryPartnersConfigInput = z.infer<typeof updateDeliveryPartnersConfigSchema>;
