"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Palette,
  Image as ImageIcon,
  RotateCcw,
  Check,
  Trash2,
  Eye,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BORDER_RADIUS_OPTIONS,
  DEFAULT_DASHBOARD_DESIGN,
  DEFAULT_PLATFORM_BRANDING,
  SIDEBAR_PRESETS,
  type DashboardDesign,
  type PlatformBranding,
} from "@/modules/branding/defaults";
import {
  resetDashboardDesignAction,
  resetPlatformBrandingAction,
  saveDashboardDesignAction,
  savePlatformBrandingAction,
} from "./actions";

const PRIMARY_PRESETS = [
  { label: "Émeraude (Défaut)", hex: "#10B981" },
  { label: "Indigo Royal", hex: "#6366F1" },
  { label: "Bleu Cobalt", hex: "#2563EB" },
  { label: "Violet Élégant", hex: "#8B5CF6" },
  { label: "Rose Fushia", hex: "#F43F5E" },
  { label: "Ambre Vif", hex: "#F59E0B" },
];

const ACCENT_PRESETS = [
  { label: "Lime Électrique", hex: "#A3E635" },
  { label: "Cyan Néon", hex: "#06B6D4" },
  { label: "Orange Solaire", hex: "#FB923C" },
  { label: "Jaune Éclat", hex: "#FACC15" },
];

interface DesignFormProps {
  initialBranding: PlatformBranding;
  initialDesign: DashboardDesign;
  canEdit: boolean;
}

export function DesignForm({
  initialBranding,
  initialDesign,
  canEdit,
}: DesignFormProps) {
  const [activeTab, setActiveTab] = React.useState<"branding" | "design">("branding");

  // Branding state
  const [platformName, setPlatformName] = React.useState(initialBranding.platformName);
  const [platformTagline, setPlatformTagline] = React.useState(initialBranding.platformTagline);
  const [platformDescription, setPlatformDescription] = React.useState(initialBranding.platformDescription);
  
  const [logoLightUrl, setLogoLightUrl] = React.useState<string | null>(initialBranding.logoLightUrl);
  const [logoDarkUrl, setLogoDarkUrl] = React.useState<string | null>(initialBranding.logoDarkUrl);
  const [logoMarkUrl, setLogoMarkUrl] = React.useState<string | null>(initialBranding.logoMarkUrl);
  const [faviconUrl, setFaviconUrl] = React.useState<string | null>(initialBranding.faviconUrl);

  const [logoLightFile, setLogoLightFile] = React.useState<File | null>(null);
  const [logoDarkFile, setLogoDarkFile] = React.useState<File | null>(null);
  const [logoMarkFile, setLogoMarkFile] = React.useState<File | null>(null);
  const [faviconFile, setFaviconFile] = React.useState<File | null>(null);

  // Local object preview URLs for instant feedback
  const [previewLightUrl, setPreviewLightUrl] = React.useState<string | null>(initialBranding.logoLightUrl);
  const [previewDarkUrl, setPreviewDarkUrl] = React.useState<string | null>(initialBranding.logoDarkUrl);
  const [previewMarkUrl, setPreviewMarkUrl] = React.useState<string | null>(initialBranding.logoMarkUrl);

  // Design state
  const [primaryColor, setPrimaryColor] = React.useState(initialDesign.primaryColor);
  const [accentColor, setAccentColor] = React.useState(initialDesign.accentColor);
  const [sidebarBg, setSidebarBg] = React.useState(initialDesign.sidebarBg);
  const [borderRadius, setBorderRadius] = React.useState<"6px" | "10px" | "14px" | "20px">(
    initialDesign.borderRadius,
  );
  const [themeMode, setThemeMode] = React.useState<"system" | "light" | "dark">(initialDesign.themeMode);

  // Pending status
  const [isSavingBranding, setIsSavingBranding] = React.useState(false);
  const [isSavingDesign, setIsSavingDesign] = React.useState(false);
  const [isResetting, setIsResetting] = React.useState(false);

  // Update object URLs when files change
  const handleFileChange = (
    file: File | null,
    setFile: (f: File | null) => void,
    setPreview: (url: string | null) => void,
  ) => {
    setFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    }
  };

  // Submit platform branding
  async function handleSaveBranding(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;

    setIsSavingBranding(true);
    const formData = new FormData();
    formData.append("platformName", platformName);
    formData.append("platformTagline", platformTagline);
    formData.append("platformDescription", platformDescription);

    if (logoLightUrl) formData.append("logoLightUrl", logoLightUrl);
    if (logoDarkUrl) formData.append("logoDarkUrl", logoDarkUrl);
    if (logoMarkUrl) formData.append("logoMarkUrl", logoMarkUrl);
    if (faviconUrl) formData.append("faviconUrl", faviconUrl);

    if (logoLightFile) formData.append("logoLightFile", logoLightFile);
    if (logoDarkFile) formData.append("logoDarkFile", logoDarkFile);
    if (logoMarkFile) formData.append("logoMarkFile", logoMarkFile);
    if (faviconFile) formData.append("faviconFile", faviconFile);

    try {
      const res = await savePlatformBrandingAction(formData);
      if (res.ok) {
        toast.success(res.message || "Identité de la plateforme enregistrée !");
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erreur de connexion.");
    } finally {
      setIsSavingBranding(false);
    }
  }

  // Submit dashboard design
  async function handleSaveDesign(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;

    setIsSavingDesign(true);
    try {
      const res = await saveDashboardDesignAction({
        primaryColor,
        secondaryColor: initialDesign.secondaryColor,
        accentColor,
        sidebarBg,
        borderRadius,
        themeMode,
      });

      if (res.ok) {
        toast.success(res.message || "Palette et thème appliqués avec succès !");
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erreur de connexion.");
    } finally {
      setIsSavingDesign(false);
    }
  }

  // Reset actions
  async function handleResetBranding() {
    if (!confirm("Voulez-vous vraiment réinitialiser l'identité de marque aux valeurs d'origine ?")) {
      return;
    }
    setIsResetting(true);
    try {
      const res = await resetPlatformBrandingAction();
      if (res.ok) {
        setPlatformName(DEFAULT_PLATFORM_BRANDING.platformName);
        setPlatformTagline(DEFAULT_PLATFORM_BRANDING.platformTagline);
        setPlatformDescription(DEFAULT_PLATFORM_BRANDING.platformDescription);
        setLogoLightUrl(null);
        setLogoDarkUrl(null);
        setLogoMarkUrl(null);
        setFaviconUrl(DEFAULT_PLATFORM_BRANDING.faviconUrl);
        setPreviewLightUrl(null);
        setPreviewDarkUrl(null);
        setPreviewMarkUrl(null);
        setLogoLightFile(null);
        setLogoDarkFile(null);
        setLogoMarkFile(null);
        setFaviconFile(null);
        toast.success("Identité réinitialisée !");
      } else {
        toast.error(res.error);
      }
    } finally {
      setIsResetting(false);
    }
  }

  async function handleResetDesign() {
    if (!confirm("Voulez-vous vraiment rétablir le design et les couleurs d'origine ?")) {
      return;
    }
    setIsResetting(true);
    try {
      const res = await resetDashboardDesignAction();
      if (res.ok) {
        setPrimaryColor(DEFAULT_DASHBOARD_DESIGN.primaryColor);
        setAccentColor(DEFAULT_DASHBOARD_DESIGN.accentColor);
        setSidebarBg(DEFAULT_DASHBOARD_DESIGN.sidebarBg);
        setBorderRadius(DEFAULT_DASHBOARD_DESIGN.borderRadius);
        setThemeMode(DEFAULT_DASHBOARD_DESIGN.themeMode);
        toast.success("Design réinitialisé !");
      } else {
        toast.error(res.error);
      }
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("branding")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
            activeTab === "branding"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ImageIcon className="h-4 w-4" />
          Identité & Logos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("design")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
            activeTab === "design"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Palette className="h-4 w-4" />
          Palette & Thème
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Settings Column */}
        <div className="space-y-6 lg:col-span-7">
          {activeTab === "branding" ? (
            <form onSubmit={handleSaveBranding} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informations de la Plateforme</CardTitle>
                  <CardDescription>
                    Définissez le nom, le slogan et la présentation publique de la plateforme.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="platformName">Nom de la Plateforme *</Label>
                    <Input
                      id="platformName"
                      value={platformName}
                      onChange={(e) => setPlatformName(e.target.value)}
                      placeholder="Ex: EcomPartner"
                      required
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="platformTagline">Slogan commercial</Label>
                    <Input
                      id="platformTagline"
                      value={platformTagline}
                      onChange={(e) => setPlatformTagline(e.target.value)}
                      placeholder="Ex: Together, We Grow."
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="platformDescription">Description de la plateforme</Label>
                    <Input
                      id="platformDescription"
                      value={platformDescription}
                      onChange={(e) => setPlatformDescription(e.target.value)}
                      placeholder="Ex: Système d'exploitation e-commerce tout-en-un"
                      disabled={!canEdit}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Logo Uploads Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Logos & Fichiers Visuels</CardTitle>
                  <CardDescription>
                    Formats autorisés : PNG, WebP, JPEG (Max 2 Mo par logo, 512 Ko pour le favicon).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Logo pour fond sombre (Sidebar & Dark Mode) */}
                  <div className="rounded-lg border border-border p-4 bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Logo pour Fond Sombre (Sidebar / Dark Mode)</p>
                        <p className="text-xs text-muted-foreground">Recommandé : image transparente blanche ou claire (250 × 60 px)</p>
                      </div>
                      {previewDarkUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setLogoDarkUrl(null);
                            setPreviewDarkUrl(null);
                            setLogoDarkFile(null);
                          }}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Supprimer
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-36 items-center justify-center rounded-md bg-slate-900 border border-slate-800 p-2">
                        {previewDarkUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={previewDarkUrl} alt="Aperçu logo sombre" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">Défaut Vectoriel</span>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <Input
                          type="file"
                          accept="image/png,image/webp,image/jpeg"
                          onChange={(e) =>
                            handleFileChange(e.target.files?.[0] || null, setLogoDarkFile, setPreviewDarkUrl)
                          }
                          disabled={!canEdit}
                          className="text-xs"
                        />
                        <Input
                          placeholder="Ou entrez une URL directe (https://...)"
                          value={logoDarkUrl || ""}
                          onChange={(e) => {
                            setLogoDarkUrl(e.target.value);
                            setPreviewDarkUrl(e.target.value || null);
                          }}
                          disabled={!canEdit}
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Logo pour fond clair (Login / Export) */}
                  <div className="rounded-lg border border-border p-4 bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Logo pour Fond Clair (Page de connexion)</p>
                        <p className="text-xs text-muted-foreground">Recommandé : image transparente sombre (250 × 60 px)</p>
                      </div>
                      {previewLightUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setLogoLightUrl(null);
                            setPreviewLightUrl(null);
                            setLogoLightFile(null);
                          }}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Supprimer
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-36 items-center justify-center rounded-md bg-white border border-slate-200 p-2">
                        {previewLightUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={previewLightUrl} alt="Aperçu logo clair" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="text-[10px] text-slate-600 font-mono">Défaut Vectoriel</span>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <Input
                          type="file"
                          accept="image/png,image/webp,image/jpeg"
                          onChange={(e) =>
                            handleFileChange(e.target.files?.[0] || null, setLogoLightFile, setPreviewLightUrl)
                          }
                          disabled={!canEdit}
                          className="text-xs"
                        />
                        <Input
                          placeholder="Ou entrez une URL directe (https://...)"
                          value={logoLightUrl || ""}
                          onChange={(e) => {
                            setLogoLightUrl(e.target.value);
                            setPreviewLightUrl(e.target.value || null);
                          }}
                          disabled={!canEdit}
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Symbole / Icône (Mark) */}
                  <div className="rounded-lg border border-border p-4 bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Symbole Réduit / Favicon Carré (Mark)</p>
                        <p className="text-xs text-muted-foreground">Utilisé pour le menu replié et les applications mobiles (carré 64 × 64 px)</p>
                      </div>
                      {previewMarkUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setLogoMarkUrl(null);
                            setPreviewMarkUrl(null);
                            setLogoMarkFile(null);
                          }}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Supprimer
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-md bg-slate-900 border border-slate-800 p-2">
                        {previewMarkUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={previewMarkUrl} alt="Aperçu icône" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="text-[9px] text-slate-400 font-mono">Mark</span>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <Input
                          type="file"
                          accept="image/png,image/webp,image/jpeg"
                          onChange={(e) =>
                            handleFileChange(e.target.files?.[0] || null, setLogoMarkFile, setPreviewMarkUrl)
                          }
                          disabled={!canEdit}
                          className="text-xs"
                        />
                        <Input
                          placeholder="Ou entrez une URL directe"
                          value={logoMarkUrl || ""}
                          onChange={(e) => {
                            setLogoMarkUrl(e.target.value);
                            setPreviewMarkUrl(e.target.value || null);
                          }}
                          disabled={!canEdit}
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Actions footer */}
              {canEdit && (
                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetBranding}
                    disabled={isResetting || isSavingBranding}
                    className="text-destructive hover:bg-destructive/10 border-destructive/30"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Réinitialiser l&apos;identité
                  </Button>
                  <Button type="submit" disabled={isSavingBranding}>
                    <Check className="h-4 w-4 mr-2" />
                    {isSavingBranding ? "Enregistrement..." : "Enregistrer les modifications"}
                  </Button>
                </div>
              )}
            </form>
          ) : (
            <form onSubmit={handleSaveDesign} className="space-y-6">
              {/* Color Configuration Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Couleurs de la Marque & Interface</CardTitle>
                  <CardDescription>
                    Personnalisez la couleur principale, l&apos;accentuation et la couleur du menu latéral.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Primary Brand Color */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="primaryColor" className="font-semibold text-sm">
                        Couleur Principale (Boutons, Liens actifs, Badges)
                      </Label>
                      <span className="font-mono text-xs uppercase bg-muted px-2 py-0.5 rounded">
                        {primaryColor}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        id="primaryColor"
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        disabled={!canEdit}
                        className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent p-1"
                      />
                      <Input
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        placeholder="#10B981"
                        maxLength={7}
                        disabled={!canEdit}
                        className="font-mono text-sm uppercase max-w-[140px]"
                      />
                    </div>
                    {/* Presets */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {PRIMARY_PRESETS.map((preset) => (
                        <button
                          key={preset.hex}
                          type="button"
                          onClick={() => setPrimaryColor(preset.hex)}
                          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            primaryColor.toLowerCase() === preset.hex.toLowerCase()
                              ? "border-primary bg-primary/10 font-medium text-primary ring-1 ring-primary"
                              : "border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: preset.hex }}
                          />
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Accent Color */}
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="accentColor" className="font-semibold text-sm">
                        Couleur d&apos;Accentuation (Points forts, Highlights)
                      </Label>
                      <span className="font-mono text-xs uppercase bg-muted px-2 py-0.5 rounded">
                        {accentColor}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        id="accentColor"
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        disabled={!canEdit}
                        className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent p-1"
                      />
                      <Input
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        placeholder="#A3E635"
                        maxLength={7}
                        disabled={!canEdit}
                        className="font-mono text-sm uppercase max-w-[140px]"
                      />
                    </div>
                    {/* Presets */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {ACCENT_PRESETS.map((preset) => (
                        <button
                          key={preset.hex}
                          type="button"
                          onClick={() => setAccentColor(preset.hex)}
                          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            accentColor.toLowerCase() === preset.hex.toLowerCase()
                              ? "border-primary bg-primary/10 font-medium text-primary ring-1 ring-primary"
                              : "border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: preset.hex }}
                          />
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sidebar Background */}
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="sidebarBg" className="font-semibold text-sm">
                        Couleur de la Barre Latérale (Menu de navigation)
                      </Label>
                      <span className="font-mono text-xs uppercase bg-muted px-2 py-0.5 rounded">
                        {sidebarBg}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        id="sidebarBg"
                        type="color"
                        value={sidebarBg}
                        onChange={(e) => setSidebarBg(e.target.value)}
                        disabled={!canEdit}
                        className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent p-1"
                      />
                      <Input
                        value={sidebarBg}
                        onChange={(e) => setSidebarBg(e.target.value)}
                        placeholder="#0B1220"
                        maxLength={7}
                        disabled={!canEdit}
                        className="font-mono text-sm uppercase max-w-[140px]"
                      />
                    </div>
                    {/* Presets */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {SIDEBAR_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setSidebarBg(preset.value)}
                          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            sidebarBg.toLowerCase() === preset.value.toLowerCase()
                              ? "border-primary bg-primary/10 font-medium text-primary ring-1 ring-primary"
                              : "border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full border border-slate-700"
                            style={{ backgroundColor: preset.value }}
                          />
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Geometry Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Style & Géométrie des Éléments</CardTitle>
                  <CardDescription>
                    Définissez la courbure des bordures des cartes, boutons et champs de saisie.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {BORDER_RADIUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setBorderRadius(opt.value)}
                        className={`flex flex-col items-center justify-center p-3 text-center border transition-all ${
                          borderRadius === opt.value
                            ? "border-primary bg-primary/5 font-semibold text-primary ring-2 ring-primary/20"
                            : "border-border hover:bg-muted/50 text-muted-foreground"
                        }`}
                        style={{ borderRadius: opt.value }}
                      >
                        <div
                          className="h-8 w-12 border-2 border-primary/40 bg-card mb-2"
                          style={{ borderRadius: opt.value }}
                        />
                        <span className="text-xs">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Actions footer */}
              {canEdit && (
                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetDesign}
                    disabled={isResetting || isSavingDesign}
                    className="text-destructive hover:bg-destructive/10 border-destructive/30"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Rétablir le design d&apos;origine
                  </Button>
                  <Button type="submit" disabled={isSavingDesign}>
                    <Check className="h-4 w-4 mr-2" />
                    {isSavingDesign ? "Application..." : "Appliquer le design"}
                  </Button>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Live Interactive Sandbox Preview Column */}
        <div className="space-y-4 lg:col-span-5">
          <div className="sticky top-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">Aperçu en Direct</h3>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500 border border-emerald-500/20">
                Temps Réel
              </span>
            </div>

            {/* Sandbox Container */}
            <div
              className="overflow-hidden border border-border shadow-soft bg-background transition-all"
              style={{ borderRadius }}
            >
              {/* Mock Dashboard Layout */}
              <div className="flex min-h-[360px] text-xs">
                {/* Mock Sidebar */}
                <div
                  className="w-36 flex flex-col justify-between p-3 text-white border-r border-white/10 shrink-0"
                  style={{ backgroundColor: sidebarBg }}
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                      {previewMarkUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={previewMarkUrl} alt="Logo" className="h-6 w-6 object-contain rounded" />
                      ) : (
                        <div
                          className="h-6 w-6 rounded flex items-center justify-center font-bold text-[10px] text-slate-900"
                          style={{ backgroundColor: primaryColor }}
                        >
                          EP
                        </div>
                      )}
                      <span className="font-bold truncate text-[11px]">{platformName}</span>
                    </div>

                    <div className="space-y-1">
                      <div
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded font-medium text-white"
                        style={{ backgroundColor: `${primaryColor}33`, color: primaryColor }}
                      >
                        <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                        <span>Tableau de bord</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded text-white/60">
                        <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                        <span>Commandes</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded text-white/60">
                        <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                        <span>Partenaires</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 text-[9px] text-white/40 truncate">
                    {platformTagline || "Together, We Grow."}
                  </div>
                </div>

                {/* Mock Main View */}
                <div className="flex-1 p-3 space-y-3 bg-muted/10">
                  {/* Mock Header */}
                  <div
                    className="flex items-center justify-between border border-border bg-card p-2 shadow-xs"
                    style={{ borderRadius }}
                  >
                    <span className="font-semibold text-[11px]">Tableau de Bord</span>
                    <div
                      className="px-2 py-0.5 text-[9px] font-semibold text-white"
                      style={{ backgroundColor: primaryColor, borderRadius }}
                    >
                      En direct
                    </div>
                  </div>

                  {/* Mock Stat Card */}
                  <div
                    className="border border-border bg-card p-3 shadow-xs space-y-1"
                    style={{ borderRadius }}
                  >
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">
                      Revenu Mensuel
                    </span>
                    <div className="flex items-baseline justify-between">
                      <span className="text-base font-bold text-foreground">12,450 TND</span>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${accentColor}25`, color: primaryColor }}
                      >
                        +14.2%
                      </span>
                    </div>
                  </div>

                  {/* Mock Action Button */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      className="flex-1 py-1.5 px-2 text-center text-white font-medium shadow-xs transition-opacity hover:opacity-90"
                      style={{ backgroundColor: primaryColor, borderRadius }}
                    >
                      Nouvelle Commande
                    </button>
                    <button
                      type="button"
                      className="py-1.5 px-2 text-center border border-border bg-card text-foreground font-medium shadow-xs"
                      style={{ borderRadius }}
                    >
                      Filtres
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* WCAG & Color Analysis Card */}
            <div className="rounded-lg border border-border p-3 bg-card space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Info className="h-3.5 w-3.5 text-primary" />
                <span>Validation Accessibilité & Harmonie</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Les couleurs sélectionnées sont injectées automatiquement dans les variables CSS Tailwind v4
                (<code className="text-primary font-mono">--primary</code>, <code className="text-primary font-mono">--sidebar</code>, <code className="text-primary font-mono">--radius</code>).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
