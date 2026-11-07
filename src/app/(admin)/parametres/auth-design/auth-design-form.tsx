"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Palette,
  Image as ImageIcon,
  RotateCcw,
  Check,
  Eye,
  Sparkles,
  Smartphone,
  Monitor,
  Languages,
  Layout,
  ArrowRight,
  Boxes,
  Truck,
  CheckCircle2,
  Lock,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_AUTH_MARKETING_AR,
  DEFAULT_AUTH_MARKETING_EN,
  DEFAULT_AUTH_MARKETING_FR,
  DEFAULT_AUTH_PAGES_DESIGN,
  type AuthMarketingContent,
  type AuthPagesDesign,
  type PlatformBranding,
} from "@/modules/branding/defaults";
import { saveAuthPagesDesignAction, resetAuthPagesDesignAction } from "./actions";
import { DeliveryPartnersManager } from "./delivery-partners-manager";
import { DeliveryPartnersShowcase } from "@/components/auth/delivery-partners-showcase";
import {
  DEFAULT_DELIVERY_PARTNERS_CONFIG,
  type DeliveryPartnersConfig,
} from "@/modules/branding/delivery-partners-schemas";
import { cn } from "@/lib/utils";

const PRIMARY_PRESETS = [
  { label: "Émeraude (Défaut)", hex: "#10B981" },
  { label: "Bleu Cobalt", hex: "#2563EB" },
  { label: "Indigo Royal", hex: "#6366F1" },
  { label: "Violet Élégant", hex: "#8B5CF6" },
  { label: "Rose Fushia", hex: "#F43F5E" },
  { label: "Ambre Vif", hex: "#F59E0B" },
];

const ACCENT_PRESETS = [
  { label: "Lime Électrique (Défaut)", hex: "#A3E635" },
  { label: "Cyan Néon", hex: "#06B6D4" },
  { label: "Orange Solaire", hex: "#FB923C" },
  { label: "Jaune Éclat", hex: "#FACC15" },
];

const MARKETING_BG_PRESETS = [
  { label: "Slate Noir (Défaut)", hex: "#0B0F19" },
  { label: "Bleu Nuit Profond", hex: "#0B1220" },
  { label: "Ardoise Sombre", hex: "#0F172A" },
  { label: "Charbon Neutre", hex: "#18181B" },
  { label: "Noir Absolu", hex: "#000000" },
];

interface AuthDesignFormProps {
  initialDesign: AuthPagesDesign;
  platformBranding?: PlatformBranding;
  initialDeliveryPartnersConfig?: DeliveryPartnersConfig | null;
  canEdit: boolean;
}

export function AuthDesignForm({
  initialDesign,
  platformBranding,
  initialDeliveryPartnersConfig,
  canEdit,
}: AuthDesignFormProps) {
  const [activeTab, setActiveTab] = React.useState<"preview" | "colors" | "content" | "layout" | "delivery">("preview");

  const [deliveryConfig, setDeliveryConfig] = React.useState<DeliveryPartnersConfig>(
    initialDeliveryPartnersConfig || DEFAULT_DELIVERY_PARTNERS_CONFIG
  );

  // Preview interactive controls
  const [previewView, setPreviewView] = React.useState<"login" | "register">("login");
  const [previewDevice, setPreviewDevice] = React.useState<"desktop" | "mobile">("desktop");
  const [previewLang, setPreviewLang] = React.useState<"fr" | "ar" | "en">("fr");

  // Content edit language tab
  const [contentEditLang, setContentEditLang] = React.useState<"fr" | "ar" | "en">("fr");

  // Branding state
  const [logoLightUrl, setLogoLightUrl] = React.useState<string | null>(initialDesign.branding.logoLightUrl);
  const [logoDarkUrl, setLogoDarkUrl] = React.useState<string | null>(initialDesign.branding.logoDarkUrl);
  const [logoMarkUrl, setLogoMarkUrl] = React.useState<string | null>(initialDesign.branding.logoMarkUrl);
  const [logoLightFile, setLogoLightFile] = React.useState<File | null>(null);
  const [logoDarkFile, setLogoDarkFile] = React.useState<File | null>(null);
  const [logoMarkFile, setLogoMarkFile] = React.useState<File | null>(null);

  // Local object preview URLs for instant feedback
  const [previewLightLogo, setPreviewLightLogo] = React.useState<string | null>(initialDesign.branding.logoLightUrl);
  const [previewDarkLogo, setPreviewDarkLogo] = React.useState<string | null>(initialDesign.branding.logoDarkUrl);

  // Colors state
  const [primaryColor, setPrimaryColor] = React.useState(initialDesign.colors.primaryColor);
  const [accentColor, setAccentColor] = React.useState(initialDesign.colors.accentColor);
  const [marketingBg, setMarketingBg] = React.useState(initialDesign.colors.marketingBg);
  const [buttonBg, setButtonBg] = React.useState(initialDesign.colors.buttonBg);
  const [buttonText, setButtonText] = React.useState(initialDesign.colors.buttonText);

  // Layout state
  const [showMarketingPanel, setShowMarketingPanel] = React.useState(initialDesign.layout.showMarketingPanel);
  const [showFeatureCards, setShowFeatureCards] = React.useState(initialDesign.layout.showFeatureCards);
  const [showTrustBadges, setShowTrustBadges] = React.useState(initialDesign.layout.showTrustBadges);
  const [showPlatformMockup, setShowPlatformMockup] = React.useState(initialDesign.layout.showPlatformMockup);

  // Multilingual marketing content state
  const [content, setContent] = React.useState({
    fr: { ...DEFAULT_AUTH_MARKETING_FR, ...initialDesign.content.fr },
    ar: { ...DEFAULT_AUTH_MARKETING_AR, ...initialDesign.content.ar },
    en: { ...DEFAULT_AUTH_MARKETING_EN, ...initialDesign.content.en },
  });

  const [isSaving, setIsSaving] = React.useState(false);
  const [isResetting, setIsResetting] = React.useState(false);

  // Helper to update specific field in current edit language
  const updateContentField = (key: keyof AuthMarketingContent, val: string) => {
    setContent((prev) => ({
      ...prev,
      [contentEditLang]: {
        ...prev[contentEditLang],
        [key]: val,
      },
    }));
  };

  const handleFileChange = (
    file: File | null,
    setFile: (f: File | null) => void,
    setPreview: (url: string | null) => void,
  ) => {
    setFile(file);
    if (file) {
      const objUrl = URL.createObjectURL(file);
      setPreview(objUrl);
    }
  };

  const activeContent = content[previewLang];
  const isRtl = previewLang === "ar";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) {
      toast.error("Vous n'avez pas la permission de modifier le design.");
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      if (logoLightUrl) formData.set("logoLightUrl", logoLightUrl);
      if (logoDarkUrl) formData.set("logoDarkUrl", logoDarkUrl);
      if (logoMarkUrl) formData.set("logoMarkUrl", logoMarkUrl);

      if (logoLightFile) formData.set("logoLightFile", logoLightFile);
      if (logoDarkFile) formData.set("logoDarkFile", logoDarkFile);
      if (logoMarkFile) formData.set("logoMarkFile", logoMarkFile);

      formData.set("primaryColor", primaryColor);
      formData.set("accentColor", accentColor);
      formData.set("marketingBg", marketingBg);
      formData.set("buttonBg", buttonBg);
      formData.set("buttonText", buttonText);

      formData.set("showMarketingPanel", String(showMarketingPanel));
      formData.set("showFeatureCards", String(showFeatureCards));
      formData.set("showTrustBadges", String(showTrustBadges));
      formData.set("showPlatformMockup", String(showPlatformMockup));

      formData.set("contentJson", JSON.stringify(content));

      const res = await saveAuthPagesDesignAction(formData);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(res.message ?? "Configuration enregistrée avec succès.");
    } catch {
      toast.error("Une erreur inattendue est survenue.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReset() {
    if (!canEdit) return;
    if (!confirm("Voulez-vous vraiment réinitialiser le design des pages d'authentification aux paramètres d'origine ?")) {
      return;
    }

    setIsResetting(true);
    try {
      const res = await resetAuthPagesDesignAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      // Reset local state
      setLogoLightUrl(null);
      setLogoDarkUrl(null);
      setLogoMarkUrl(null);
      setPreviewLightLogo(null);
      setPreviewDarkLogo(null);
      setPrimaryColor(DEFAULT_AUTH_PAGES_DESIGN.colors.primaryColor);
      setAccentColor(DEFAULT_AUTH_PAGES_DESIGN.colors.accentColor);
      setMarketingBg(DEFAULT_AUTH_PAGES_DESIGN.colors.marketingBg);
      setButtonBg(DEFAULT_AUTH_PAGES_DESIGN.colors.buttonBg);
      setButtonText(DEFAULT_AUTH_PAGES_DESIGN.colors.buttonText);
      setShowMarketingPanel(DEFAULT_AUTH_PAGES_DESIGN.layout.showMarketingPanel);
      setShowFeatureCards(DEFAULT_AUTH_PAGES_DESIGN.layout.showFeatureCards);
      setShowTrustBadges(DEFAULT_AUTH_PAGES_DESIGN.layout.showTrustBadges);
      setShowPlatformMockup(DEFAULT_AUTH_PAGES_DESIGN.layout.showPlatformMockup);
      setContent({
        fr: DEFAULT_AUTH_MARKETING_FR,
        ar: DEFAULT_AUTH_MARKETING_AR,
        en: DEFAULT_AUTH_MARKETING_EN,
      });

      toast.success(res.message ?? "Design réinitialisé.");
    } catch {
      toast.error("Erreur lors de la réinitialisation.");
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Navigation tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all cursor-pointer",
              activeTab === "preview"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Eye className="h-4 w-4" />
            <span>Aperçu Interactif</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("colors")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all cursor-pointer",
              activeTab === "colors"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Palette className="h-4 w-4" />
            <span>Palette & Logos</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("content")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all cursor-pointer",
              activeTab === "content"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Languages className="h-4 w-4" />
            <span>Contenu Marketing (FR / AR / EN)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("layout")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all cursor-pointer",
              activeTab === "layout"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Layout className="h-4 w-4" />
            <span>Disposition & Modules</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("delivery")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all cursor-pointer",
              activeTab === "delivery"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Truck className="h-4 w-4" />
            <span>Partenaires de Livraison</span>
          </button>
        </div>

        {/* Global Save / Reset Actions */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!canEdit || isResetting || isSaving}
            className="cursor-pointer gap-1.5 text-muted-foreground hover:text-destructive"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Réinitialiser</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!canEdit || isSaving || isResetting}
            className="cursor-pointer gap-1.5"
            style={{
              backgroundColor: primaryColor,
              color: "#FFFFFF",
            }}
          >
            <Check className="h-4 w-4" />
            <span>{isSaving ? "Enregistrement…" : "Enregistrer les modifications"}</span>
          </Button>
        </div>
      </div>

      {/* ── TAB 1: INTERACTIVE PREVIEW ────────────────────────────────────── */}
      {activeTab === "preview" && (
        <Card className="border-border shadow-soft overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border pb-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold">Simulateur en direct des pages d&apos;authentification</CardTitle>
                <CardDescription className="text-xs">
                  Modifiez les options dans les onglets et visualisez le rendu instantané sur Desktop et Mobile.
                </CardDescription>
              </div>

              {/* Viewport & Page controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* View toggle: Login / Register */}
                <div className="inline-flex rounded-lg border border-border bg-card p-1">
                  <button
                    type="button"
                    onClick={() => setPreviewView("login")}
                    className={cn(
                      "px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer",
                      previewView === "login"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Connexion (/login)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewView("register")}
                    className={cn(
                      "px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer",
                      previewView === "register"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Inscription (/register)
                  </button>
                </div>

                {/* Device toggle */}
                <div className="inline-flex rounded-lg border border-border bg-card p-1">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("desktop")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer",
                      previewDevice === "desktop"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    <span>Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mobile")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer",
                      previewDevice === "mobile"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    <span>Mobile (390px)</span>
                  </button>
                </div>

                {/* Language toggle */}
                <div className="inline-flex rounded-lg border border-border bg-card p-1">
                  <button
                    type="button"
                    onClick={() => setPreviewLang("fr")}
                    className={cn(
                      "px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer",
                      previewLang === "fr"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    FR
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewLang("ar")}
                    className={cn(
                      "px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer",
                      previewLang === "ar"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    العربية
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewLang("en")}
                    className={cn(
                      "px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer",
                      previewLang === "en"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    EN
                  </button>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 bg-slate-950/20 flex justify-center items-center min-h-[560px]">
            {/* Simulation Canvas Frame */}
            <div
              className={cn(
                "rounded-2xl border border-border/80 bg-background overflow-hidden shadow-2xl transition-all duration-300",
                previewDevice === "desktop"
                  ? "w-full max-w-5xl"
                  : "w-[390px] min-h-[640px]"
              )}
            >
              {/* Browser mockup top chrome */}
              <div className="flex items-center justify-between border-b border-border bg-muted/60 px-4 py-2.5 text-xs text-muted-foreground select-none">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500/80 inline-block" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80 inline-block" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80 inline-block" />
                </div>
                <div className="font-mono text-[11px] bg-background/80 px-3 py-0.5 rounded-md border border-border/60">
                  https://app.ecompartner.tn/{previewView}
                </div>
                <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">
                  SSL Sécurisé
                </span>
              </div>

              {/* Inner Split Screen / Mobile View Container */}
              <div
                className={cn(
                  "grid min-h-[520px]",
                  previewDevice === "desktop" && showMarketingPanel
                    ? "grid-cols-2"
                    : "grid-cols-1"
                )}
              >
                {/* Simulated Marketing Pane (Hidden on mobile or if toggled off) */}
                {previewDevice === "desktop" && showMarketingPanel && (
                  <div
                    className="relative flex flex-col justify-between p-8 text-white overflow-hidden border-r border-white/10"
                    style={{ backgroundColor: marketingBg }}
                    dir={isRtl ? "rtl" : "ltr"}
                  >
                    {/* Ambient Glows */}
                    <div
                      className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full opacity-20"
                      style={{
                        background: `radial-gradient(circle, ${primaryColor} 0%, transparent 70%)`,
                        filter: "blur(50px)",
                      }}
                    />
                    <div
                      className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full opacity-15"
                      style={{
                        background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`,
                        filter: "blur(50px)",
                      }}
                    />

                    {/* Logo simulation */}
                    <div className="relative z-10 flex items-center gap-2">
                      {previewDarkLogo ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={previewDarkLogo}
                          alt="Logo"
                          className="h-8 max-w-[160px] object-contain"
                        />
                      ) : (
                        <div className="font-black text-lg tracking-tight text-white flex items-center gap-1.5">
                          <span
                            className="inline-block h-3.5 w-3.5 rounded-md"
                            style={{ backgroundColor: primaryColor }}
                          />
                          <span>{platformBranding?.platformName || "EcomPartner"}</span>
                        </div>
                      )}
                    </div>

                    {/* Hero copy */}
                    <div className="relative z-10 my-auto py-6 space-y-4">
                      {/* Badge */}
                      <div className="flex">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold border backdrop-blur-md"
                          style={{
                            borderColor: `${primaryColor}40`,
                            backgroundColor: `${primaryColor}15`,
                            color: accentColor,
                          }}
                        >
                          <Sparkles className="h-3 w-3" />
                          <span>
                            {previewView === "login"
                              ? activeContent.loginBadge
                              : activeContent.registerBadge}
                          </span>
                        </span>
                      </div>

                      {/* Headline */}
                      <h3 className="text-xl sm:text-2xl font-black text-white leading-snug">
                        {previewView === "login"
                          ? activeContent.loginHeadline
                          : activeContent.registerHeadline}
                      </h3>

                      {/* Subtitle */}
                      <p className="text-xs text-slate-300/80 leading-relaxed max-w-sm">
                        {previewView === "login"
                          ? activeContent.loginSubtitle
                          : activeContent.registerSubtitle}
                      </p>

                      {/* Mockup Card */}
                      {showPlatformMockup && (
                        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3.5 backdrop-blur-md space-y-2.5">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-white/10 pb-2">
                            <span className="font-mono text-slate-300">app.ecompartner.tn</span>
                            <span
                              className="font-semibold flex items-center gap-1"
                              style={{ color: primaryColor }}
                            >
                              <Activity className="h-2.5 w-2.5" />
                              COD Live Sync
                            </span>
                          </div>

                          {showTrustBadges && (
                            <div className="grid grid-cols-2 gap-2 text-center py-1">
                              <div className="rounded-lg bg-white/[0.03] p-2 border border-white/5">
                                <span className="font-black text-sm" style={{ color: accentColor }}>
                                  {activeContent.trustStat1Value}
                                </span>
                                <p className="text-[9px] text-slate-400">{activeContent.trustStat1Label}</p>
                              </div>
                              <div className="rounded-lg bg-white/[0.03] p-2 border border-white/5">
                                <span className="font-black text-sm" style={{ color: primaryColor }}>
                                  {activeContent.trustStat2Value}
                                </span>
                                <p className="text-[9px] text-slate-400">{activeContent.trustStat2Label}</p>
                              </div>
                            </div>
                          )}

                          {showFeatureCards && (
                            <div className="space-y-1.5 text-[11px]">
                              <div className="flex items-center gap-2 rounded-lg bg-white/[0.02] p-2 border border-white/5">
                                <Boxes className="h-3.5 w-3.5" style={{ color: primaryColor }} />
                                <span className="text-white font-medium truncate">{activeContent.feature1Title}</span>
                              </div>
                              <div className="flex items-center gap-2 rounded-lg bg-white/[0.02] p-2 border border-white/5">
                                <Truck className="h-3.5 w-3.5 text-blue-400" />
                                <span className="text-white font-medium truncate">{activeContent.feature2Title}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Footer signoff */}
                    <div className="relative z-10 text-[10px] text-slate-400 border-t border-white/10 pt-3">
                      <span>{activeContent.footerText}</span>
                    </div>
                  </div>
                )}

                {/* Simulated Form Side */}
                <div
                  className="flex flex-col justify-center p-6 sm:p-8 bg-card"
                  dir={isRtl ? "rtl" : "ltr"}
                >
                  <div className="w-full max-w-sm mx-auto space-y-4">
                    {/* Brand header */}
                    <div>
                      {previewLightLogo && (
                        <div className="mb-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={previewLightLogo}
                            alt="Logo Light"
                            className="h-7 max-w-[140px] object-contain"
                          />
                        </div>
                      )}
                      <h4 className="text-xl font-bold tracking-tight text-foreground">
                        {previewView === "login"
                          ? (isRtl ? "تسجيل الدخول" : previewLang === "en" ? "Sign In" : "Connexion")
                          : (isRtl ? "إنشاء حساب شريك" : previewLang === "en" ? "Create Partner Account" : "Créer un compte partenaire")}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {previewView === "login"
                          ? (isRtl ? "أدخل بياناتك للمتابعة" : previewLang === "en" ? "Enter your credentials to continue" : "Saisissez vos identifiants pour continuer")
                          : (isRtl ? "انضم إلى شبكة المسوقين والشركاء" : previewLang === "en" ? "Join the partner network today" : "Rejoignez le réseau partenaire")}
                      </p>
                    </div>

                    {/* Sample fields */}
                    <div className="space-y-3">
                      {previewView === "register" && (
                        <div className="space-y-1">
                          <Label className="text-xs">{isRtl ? "الاسم الكامل" : previewLang === "en" ? "Full Name" : "Nom complet"}</Label>
                          <Input disabled placeholder={isRtl ? "محمد علي" : "Sami Bouazizi"} className="h-9 text-xs" />
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs">{isRtl ? "البريد الإلكتروني" : previewLang === "en" ? "Email Address" : "Adresse e-mail"}</Label>
                        <Input disabled placeholder="contact@ecompartner.tn" className="h-9 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{isRtl ? "كلمة المرور" : previewLang === "en" ? "Password" : "Mot de passe"}</Label>
                        <Input disabled type="password" value="secret123" className="h-9 text-xs" />
                      </div>
                    </div>

                    {/* Primary Button with Live Colors */}
                    <button
                      type="button"
                      className="w-full h-10 rounded-lg text-xs font-semibold shadow-soft flex items-center justify-center gap-2 cursor-pointer transition-opacity hover:opacity-95"
                      style={{
                        backgroundColor: buttonBg,
                        color: buttonText,
                      }}
                    >
                      <span>
                        {previewView === "login"
                          ? (isRtl ? "تسجيل الدخول" : previewLang === "en" ? "Sign In" : "Se connecter")
                          : (isRtl ? "إنشاء الحساب" : previewLang === "en" ? "Register" : "Créer mon compte")}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Live Delivery Partners Showcase in Simulator ── */}
              <DeliveryPartnersShowcase
                config={deliveryConfig}
                isSimulatorPreview={true}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── TAB 2: PALETTE & LOGOS ────────────────────────────────────────── */}
      {activeTab === "colors" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Colors Card */}
          <Card className="border-border shadow-soft">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                <span>Palette de Couleurs</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Ajustez les couleurs de la page d&apos;authentification et du panneau de mise en valeur.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Primary Brand Color */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="primaryColor" className="text-xs font-semibold">
                    Couleur Primaire (Boutons, Highlights)
                  </Label>
                  <span className="font-mono text-xs text-muted-foreground">{primaryColor}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="primaryColor"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => {
                      setPrimaryColor(e.target.value);
                      setButtonBg(e.target.value);
                    }}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => {
                      setPrimaryColor(e.target.value);
                      setButtonBg(e.target.value);
                    }}
                    className="font-mono text-xs h-10 max-w-[120px]"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {PRIMARY_PRESETS.map((p) => (
                    <button
                      key={p.hex}
                      type="button"
                      onClick={() => {
                        setPrimaryColor(p.hex);
                        setButtonBg(p.hex);
                      }}
                      className={cn(
                        "h-6 rounded-md px-2 text-[11px] font-medium transition-all flex items-center gap-1.5 border cursor-pointer",
                        primaryColor === p.hex
                          ? "border-primary bg-primary/10 text-foreground font-semibold"
                          : "border-border/60 hover:border-border text-muted-foreground"
                      )}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.hex }} />
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent Color */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="accentColor" className="text-xs font-semibold">
                    Couleur d&apos;Accentuation (Pills, Badges, Metrics)
                  </Label>
                  <span className="font-mono text-xs text-muted-foreground">{accentColor}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="accentColor"
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                  />
                  <Input
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="font-mono text-xs h-10 max-w-[120px]"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {ACCENT_PRESETS.map((p) => (
                    <button
                      key={p.hex}
                      type="button"
                      onClick={() => setAccentColor(p.hex)}
                      className={cn(
                        "h-6 rounded-md px-2 text-[11px] font-medium transition-all flex items-center gap-1.5 border cursor-pointer",
                        accentColor === p.hex
                          ? "border-primary bg-primary/10 text-foreground font-semibold"
                          : "border-border/60 hover:border-border text-muted-foreground"
                      )}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.hex }} />
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Marketing Background Color */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="marketingBg" className="text-xs font-semibold">
                    Arrière-plan du Panneau Marketing
                  </Label>
                  <span className="font-mono text-xs text-muted-foreground">{marketingBg}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="marketingBg"
                    type="color"
                    value={marketingBg}
                    onChange={(e) => setMarketingBg(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                  />
                  <Input
                    value={marketingBg}
                    onChange={(e) => setMarketingBg(e.target.value)}
                    className="font-mono text-xs h-10 max-w-[120px]"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {MARKETING_BG_PRESETS.map((p) => (
                    <button
                      key={p.hex}
                      type="button"
                      onClick={() => setMarketingBg(p.hex)}
                      className={cn(
                        "h-6 rounded-md px-2 text-[11px] font-medium transition-all flex items-center gap-1.5 border cursor-pointer",
                        marketingBg === p.hex
                          ? "border-primary bg-primary/10 text-foreground font-semibold"
                          : "border-border/60 hover:border-border text-muted-foreground"
                      )}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.hex }} />
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Button text color */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Fond Bouton CTA</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={buttonBg}
                      onChange={(e) => setButtonBg(e.target.value)}
                      className="h-8 w-9 cursor-pointer rounded border border-border p-0.5"
                    />
                    <Input
                      value={buttonBg}
                      onChange={(e) => setButtonBg(e.target.value)}
                      className="font-mono text-xs h-8"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Texte Bouton CTA</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={buttonText}
                      onChange={(e) => setButtonText(e.target.value)}
                      className="h-8 w-9 cursor-pointer rounded border border-border p-0.5"
                    />
                    <Input
                      value={buttonText}
                      onChange={(e) => setButtonText(e.target.value)}
                      className="font-mono text-xs h-8"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logos Card */}
          <Card className="border-border shadow-soft">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" />
                <span>Logos Personnalisés Authentification</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Logos spécifiques affichés sur le volet marketing et le formulaire d&apos;authentification.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Dark logo */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">
                  Logo pour Fond Sombre (Panneau Marketing)
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    placeholder="https://... ou téléversez un fichier"
                    value={logoDarkUrl || ""}
                    onChange={(e) => {
                      setLogoDarkUrl(e.target.value || null);
                      setPreviewDarkLogo(e.target.value || null);
                    }}
                    className="text-xs"
                  />
                  <label className="shrink-0">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        handleFileChange(file, setLogoDarkFile, setPreviewDarkLogo);
                      }}
                    />
                    <span className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-muted px-3 text-xs font-medium cursor-pointer hover:bg-accent">
                      Téléverser
                    </span>
                  </label>
                </div>
              </div>

              {/* Light logo */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">
                  Logo pour Fond Clair (Côté Formulaire / Mobile)
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    placeholder="https://... ou téléversez un fichier"
                    value={logoLightUrl || ""}
                    onChange={(e) => {
                      setLogoLightUrl(e.target.value || null);
                      setPreviewLightLogo(e.target.value || null);
                    }}
                    className="text-xs"
                  />
                  <label className="shrink-0">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        handleFileChange(file, setLogoLightFile, setPreviewLightLogo);
                      }}
                    />
                    <span className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-muted px-3 text-xs font-medium cursor-pointer hover:bg-accent">
                      Téléverser
                    </span>
                  </label>
                </div>
              </div>

              {/* Logo Mark */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">
                  Icône / Symbole de Marque (Optionnel)
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    placeholder="https://... ou téléversez un fichier"
                    value={logoMarkUrl || ""}
                    onChange={(e) => setLogoMarkUrl(e.target.value || null)}
                    className="text-xs"
                  />
                  <label className="shrink-0">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setLogoMarkFile(file);
                      }}
                    />
                    <span className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-muted px-3 text-xs font-medium cursor-pointer hover:bg-accent">
                      Téléverser
                    </span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TAB 3: MARKETING CONTENT (FR / AR / EN) ───────────────────────── */}
      {activeTab === "content" && (
        <Card className="border-border shadow-soft">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Languages className="h-4 w-4 text-primary" />
                  <span>Textes et Messages Marketing Multilingues</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Personnalisez les titres, sous-titres, badges, fonctionnalités et chiffres affichés selon la langue.
                </CardDescription>
              </div>

              {/* Language Selector Subtabs */}
              <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setContentEditLang("fr")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer",
                    contentEditLang === "fr"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Français (FR)
                </button>
                <button
                  type="button"
                  onClick={() => setContentEditLang("ar")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer",
                    contentEditLang === "ar"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  العربية (AR)
                </button>
                <button
                  type="button"
                  onClick={() => setContentEditLang("en")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer",
                    contentEditLang === "en"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  English (EN)
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Login section */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h5 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                <span>Textes de la page de Connexion ({contentEditLang.toUpperCase()})</span>
              </h5>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Badge Connexion</Label>
                  <Input
                    value={content[contentEditLang].loginBadge}
                    onChange={(e) => updateContentField("loginBadge", e.target.value)}
                    dir={contentEditLang === "ar" ? "rtl" : "ltr"}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Titre Principal (Headline)</Label>
                  <Input
                    value={content[contentEditLang].loginHeadline}
                    onChange={(e) => updateContentField("loginHeadline", e.target.value)}
                    dir={contentEditLang === "ar" ? "rtl" : "ltr"}
                    className="text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Sous-titre explicatif</Label>
                  <Input
                    value={content[contentEditLang].loginSubtitle}
                    onChange={(e) => updateContentField("loginSubtitle", e.target.value)}
                    dir={contentEditLang === "ar" ? "rtl" : "ltr"}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Register section */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h5 className="font-bold text-sm text-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>Textes de la page d&apos;Inscription ({contentEditLang.toUpperCase()})</span>
              </h5>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Badge Inscription</Label>
                  <Input
                    value={content[contentEditLang].registerBadge}
                    onChange={(e) => updateContentField("registerBadge", e.target.value)}
                    dir={contentEditLang === "ar" ? "rtl" : "ltr"}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Titre Principal Inscription</Label>
                  <Input
                    value={content[contentEditLang].registerHeadline}
                    onChange={(e) => updateContentField("registerHeadline", e.target.value)}
                    dir={contentEditLang === "ar" ? "rtl" : "ltr"}
                    className="text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Sous-titre Inscription</Label>
                  <Input
                    value={content[contentEditLang].registerSubtitle}
                    onChange={(e) => updateContentField("registerSubtitle", e.target.value)}
                    dir={contentEditLang === "ar" ? "rtl" : "ltr"}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>

            {/* 3 Pillars / Features */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h5 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Boxes className="h-4 w-4 text-blue-500" />
                <span>Les 3 Piliers Opérationnels</span>
              </h5>
              <div className="grid gap-4 md:grid-cols-3">
                {/* Feature 1 */}
                <div className="rounded-lg border border-border/70 p-3 space-y-2 bg-muted/20">
                  <Label className="text-xs font-bold text-primary">Pilier 1 : Sourcing / Catalogue</Label>
                  <Input
                    placeholder="Titre pilier 1"
                    value={content[contentEditLang].feature1Title}
                    onChange={(e) => updateContentField("feature1Title", e.target.value)}
                    dir={contentEditLang === "ar" ? "rtl" : "ltr"}
                    className="text-xs"
                  />
                  <Input
                    placeholder="Description courte"
                    value={content[contentEditLang].feature1Desc}
                    onChange={(e) => updateContentField("feature1Desc", e.target.value)}
                    dir={contentEditLang === "ar" ? "rtl" : "ltr"}
                    className="text-xs text-muted-foreground"
                  />
                </div>
                {/* Feature 2 */}
                <div className="rounded-lg border border-border/70 p-3 space-y-2 bg-muted/20">
                  <Label className="text-xs font-bold text-blue-500">Pilier 2 : Confirmation & Expédition</Label>
                  <Input
                    placeholder="Titre pilier 2"
                    value={content[contentEditLang].feature2Title}
                    onChange={(e) => updateContentField("feature2Title", e.target.value)}
                    dir={contentEditLang === "ar" ? "rtl" : "ltr"}
                    className="text-xs"
                  />
                  <Input
                    placeholder="Description courte"
                    value={content[contentEditLang].feature2Desc}
                    onChange={(e) => updateContentField("feature2Desc", e.target.value)}
                    dir={contentEditLang === "ar" ? "rtl" : "ltr"}
                    className="text-xs text-muted-foreground"
                  />
                </div>
                {/* Feature 3 */}
                <div className="rounded-lg border border-border/70 p-3 space-y-2 bg-muted/20">
                  <Label className="text-xs font-bold text-teal-500">Pilier 3 : Paiements Rapides</Label>
                  <Input
                    placeholder="Titre pilier 3"
                    value={content[contentEditLang].feature3Title}
                    onChange={(e) => updateContentField("feature3Title", e.target.value)}
                    dir={contentEditLang === "ar" ? "rtl" : "ltr"}
                    className="text-xs"
                  />
                  <Input
                    placeholder="Description courte"
                    value={content[contentEditLang].feature3Desc}
                    onChange={(e) => updateContentField("feature3Desc", e.target.value)}
                    dir={contentEditLang === "ar" ? "rtl" : "ltr"}
                    className="text-xs text-muted-foreground"
                  />
                </div>
              </div>
            </div>

            {/* Trust Stats & Footer */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h5 className="font-bold text-sm text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Statistiques Clés & Signature de Pied de Page</span>
              </h5>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Chiffre Clé 1 (ex: +15 000)</Label>
                  <Input
                    value={content[contentEditLang].trustStat1Value}
                    onChange={(e) => updateContentField("trustStat1Value", e.target.value)}
                    dir={contentEditLang === "ar" ? "rtl" : "ltr"}
                    className="text-xs font-bold"
                  />
                  <Input
                    placeholder="Libellé statistique 1"
                    value={content[contentEditLang].trustStat1Label}
                    onChange={(e) => updateContentField("trustStat1Label", e.target.value)}
                    dir={contentEditLang === "ar" ? "rtl" : "ltr"}
                    className="text-xs mt-1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Chiffre Clé 2 (ex: 94.2%)</Label>
                  <Input
                    value={content[contentEditLang].trustStat2Value}
                    onChange={(e) => updateContentField("trustStat2Value", e.target.value)}
                    dir={contentEditLang === "ar" ? "rtl" : "ltr"}
                    className="text-xs font-bold"
                  />
                  <Input
                    placeholder="Libellé statistique 2"
                    value={content[contentEditLang].trustStat2Label}
                    onChange={(e) => updateContentField("trustStat2Label", e.target.value)}
                    dir={contentEditLang === "ar" ? "rtl" : "ltr"}
                    className="text-xs mt-1"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Texte de Pied de Page (Footer Signoff)</Label>
                  <Input
                    value={content[contentEditLang].footerText}
                    onChange={(e) => updateContentField("footerText", e.target.value)}
                    dir={contentEditLang === "ar" ? "rtl" : "ltr"}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── TAB 4: LAYOUT & MODULES ───────────────────────────────────────── */}
      {activeTab === "layout" && (
        <Card className="border-border shadow-soft">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Layout className="h-4 w-4 text-primary" />
              <span>Disposition et Éléments Visuels</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Activez ou masquez les composants de présentation pour adapter l&apos;expérience utilisateur.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border p-4 bg-muted/20">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">Panneau Marketing Latéral (Desktop)</p>
                <p className="text-xs text-muted-foreground">
                  Affiche la division d&apos;écran avec le volet de présentation de la marque sur ordinateurs de bureau.
                </p>
              </div>
              <input
                type="checkbox"
                checked={showMarketingPanel}
                onChange={(e) => setShowMarketingPanel(e.target.checked)}
                className="h-5 w-5 accent-primary cursor-pointer rounded"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-4 bg-muted/20">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">Carte Mockup Plateforme</p>
                <p className="text-xs text-muted-foreground">
                  Affiche l&apos;encadré stylisé reproduisant l&apos;interface connectée avec synchronisation COD en direct.
                </p>
              </div>
              <input
                type="checkbox"
                checked={showPlatformMockup}
                onChange={(e) => setShowPlatformMockup(e.target.checked)}
                className="h-5 w-5 accent-primary cursor-pointer rounded"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-4 bg-muted/20">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">Piliers Opérationnels</p>
                <p className="text-xs text-muted-foreground">
                  Affiche les cartes explicatives sur le sourcing, la confirmation 24/48h et les règlements.
                </p>
              </div>
              <input
                type="checkbox"
                checked={showFeatureCards}
                onChange={(e) => setShowFeatureCards(e.target.checked)}
                className="h-5 w-5 accent-primary cursor-pointer rounded"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-4 bg-muted/20">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">Statistiques et Badges de Confiance</p>
                <p className="text-xs text-muted-foreground">
                  Affiche les indicateurs de livraisons réussies et de taux de confirmation pour rassurer les visiteurs.
                </p>
              </div>
              <input
                type="checkbox"
                checked={showTrustBadges}
                onChange={(e) => setShowTrustBadges(e.target.checked)}
                className="h-5 w-5 accent-primary cursor-pointer rounded"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── TAB 5: DELIVERY PARTNERS ──────────────────────────────────────── */}
      {activeTab === "delivery" && (
        <DeliveryPartnersManager
          config={deliveryConfig}
          onChange={setDeliveryConfig}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
