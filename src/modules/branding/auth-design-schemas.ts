import { z } from "zod";
import { hexColorSchema, optionalUrlSchema } from "./schemas";
import {
  DEFAULT_AUTH_MARKETING_AR,
  DEFAULT_AUTH_MARKETING_EN,
  DEFAULT_AUTH_MARKETING_FR,
} from "./auth-design-defaults";

export const authMarketingContentSchema = z.object({
  loginBadge: z.string().trim().max(100).default(DEFAULT_AUTH_MARKETING_FR.loginBadge),
  loginHeadline: z.string().trim().min(2).max(200).default(DEFAULT_AUTH_MARKETING_FR.loginHeadline),
  loginSubtitle: z.string().trim().max(500).default(DEFAULT_AUTH_MARKETING_FR.loginSubtitle),
  registerBadge: z.string().trim().max(100).default(DEFAULT_AUTH_MARKETING_FR.registerBadge),
  registerHeadline: z.string().trim().min(2).max(200).default(DEFAULT_AUTH_MARKETING_FR.registerHeadline),
  registerSubtitle: z.string().trim().max(500).default(DEFAULT_AUTH_MARKETING_FR.registerSubtitle),
  feature1Title: z.string().trim().max(100).default(DEFAULT_AUTH_MARKETING_FR.feature1Title),
  feature1Desc: z.string().trim().max(300).default(DEFAULT_AUTH_MARKETING_FR.feature1Desc),
  feature2Title: z.string().trim().max(100).default(DEFAULT_AUTH_MARKETING_FR.feature2Title),
  feature2Desc: z.string().trim().max(300).default(DEFAULT_AUTH_MARKETING_FR.feature2Desc),
  feature3Title: z.string().trim().max(100).default(DEFAULT_AUTH_MARKETING_FR.feature3Title),
  feature3Desc: z.string().trim().max(300).default(DEFAULT_AUTH_MARKETING_FR.feature3Desc),
  trustStat1Value: z.string().trim().max(50).default(DEFAULT_AUTH_MARKETING_FR.trustStat1Value),
  trustStat1Label: z.string().trim().max(100).default(DEFAULT_AUTH_MARKETING_FR.trustStat1Label),
  trustStat2Value: z.string().trim().max(50).default(DEFAULT_AUTH_MARKETING_FR.trustStat2Value),
  trustStat2Label: z.string().trim().max(100).default(DEFAULT_AUTH_MARKETING_FR.trustStat2Label),
  footerText: z.string().trim().max(200).default(DEFAULT_AUTH_MARKETING_FR.footerText),
});

export const authPagesDesignSchema = z.object({
  branding: z.object({
    logoLightUrl: optionalUrlSchema.transform((val) => (val && val.length > 0 ? val : null)),
    logoDarkUrl: optionalUrlSchema.transform((val) => (val && val.length > 0 ? val : null)),
    logoMarkUrl: optionalUrlSchema.transform((val) => (val && val.length > 0 ? val : null)),
  }),
  colors: z.object({
    primaryColor: hexColorSchema,
    accentColor: hexColorSchema,
    buttonBg: hexColorSchema,
    buttonText: hexColorSchema,
    marketingBg: hexColorSchema,
  }),
  layout: z.object({
    showMarketingPanel: z.boolean().default(true),
    showFeatureCards: z.boolean().default(true),
    showTrustBadges: z.boolean().default(true),
    showPlatformMockup: z.boolean().default(true),
  }),
  content: z.object({
    fr: authMarketingContentSchema.default(DEFAULT_AUTH_MARKETING_FR),
    ar: authMarketingContentSchema.default(DEFAULT_AUTH_MARKETING_AR),
    en: authMarketingContentSchema.default(DEFAULT_AUTH_MARKETING_EN),
  }),
});

export type AuthMarketingContentInput = z.infer<typeof authMarketingContentSchema>;
export type AuthPagesDesignInput = z.infer<typeof authPagesDesignSchema>;
