/**
 * Default configurations and types for Platform and Partner branding.
 */

export const BRANDING_SETTING_KEYS = {
  PLATFORM_BRANDING: "branding.platform",
  DASHBOARD_DESIGN: "branding.dashboard_design",
  AUTH_DESIGN: "branding.auth_design",
} as const;

export type PlatformBranding = {
  platformName: string;
  platformTagline: string;
  platformDescription: string;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  logoMarkUrl: string | null;
  faviconUrl: string | null;
};

export type DashboardDesign = {
  primaryColor: string; // e.g. #10B981
  secondaryColor: string; // e.g. #F1F5F9
  accentColor: string; // e.g. #A3E635
  sidebarBg: string; // e.g. #0B1220
  borderRadius: "6px" | "10px" | "14px" | "20px";
  themeMode: "system" | "light" | "dark";
};

export type PartnerBranding = {
  partnerId: string;
  companyName: string | null;
  companyLogoUrl: string | null;
  companyLogoDarkUrl: string | null;
  companyMarkUrl: string | null;
  brandColorPrimary: string | null;
  brandColorSecondary: string | null;
  companyDescription: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  websiteUrl: string | null;
};

export type ResolvedBranding = {
  name: string;
  tagline: string;
  logoLight: string | null;
  logoDark: string | null;
  logoMark: string | null;
  faviconUrl: string;
  primaryColor: string;
  accentColor: string;
  sidebarBg: string;
  borderRadius: string;
  isPartner: boolean;
  isCustom: boolean;
};

export const DEFAULT_PLATFORM_BRANDING: PlatformBranding = {
  platformName: "EcomPartner",
  platformTagline: "Together, We Grow.",
  platformDescription: "Your E-commerce Business Operating System",
  logoLightUrl: null,
  logoDarkUrl: null,
  logoMarkUrl: null,
  faviconUrl: "/brand/app-icon.svg",
};

export const DEFAULT_DASHBOARD_DESIGN: DashboardDesign = {
  primaryColor: "#10B981",
  secondaryColor: "#F1F5F9",
  accentColor: "#A3E635",
  sidebarBg: "#0B1220",
  borderRadius: "10px",
  themeMode: "system",
};

export const BORDER_RADIUS_OPTIONS = [
  { label: "Compact (6px)", value: "6px" },
  { label: "Standard (10px)", value: "10px" },
  { label: "Arrondi (14px)", value: "14px" },
  { label: "Pill (20px)", value: "20px" },
] as const;

export const SIDEBAR_PRESETS = [
  { label: "Bleu Nuit (Défaut)", value: "#0B1220" },
  { label: "Ardoise Sombre", value: "#0F172A" },
  { label: "Charbon Neutre", value: "#18181B" },
  { label: "Noir Absolu", value: "#000000" },
] as const;

export * from "./auth-design-defaults";

