import { z } from "zod";

export const partnerStatusSchema = z.enum(["ACTIVE", "SUSPENDED", "CLOSED"]);

export const socialAccountSchema = z.object({
  platform: z.enum(["FACEBOOK", "INSTAGRAM", "TIKTOK", "OTHER"]),
  label: z.string().trim().min(1, "Libellé requis").max(80),
  url: z
    .string()
    .trim()
    .url("URL invalide")
    .max(500)
    .refine((u) => u.startsWith("https://") || u.startsWith("http://"), {
      message: "URL http(s) requise",
    }),
});

export const assignProductSchema = z.object({
  partnerId: z.string().min(1),
  productId: z.string().min(1),
  commissionType: z.enum(["PERCENTAGE", "FIXED"]).nullable(),
  commissionValue: z.number().min(0).max(1_000_000).nullable(),
});

export const partnerNotesSchema = z.object({
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
});
