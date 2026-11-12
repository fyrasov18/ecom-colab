"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  Building2,
  Check,
  Globe,
  Mail,
  Phone,
  Trash2,
  Eye,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PartnerBranding } from "@/modules/branding/defaults";
import { savePartnerCompanyBrandingAction } from "./actions";

const BRAND_COLOR_PRESETS = [
  { label: "Émeraude", hex: "#10B981" },
  { label: "Bleu Océan", hex: "#0284C7" },
  { label: "Indigo", hex: "#6366F1" },
  { label: "Ambre Vif", hex: "#F59E0B" },
  { label: "Rose", hex: "#F43F5E" },
  { label: "Ardoise", hex: "#475569" },
];

interface CompanyFormProps {
  initialBranding: PartnerBranding | null;
}

export function CompanyForm({ initialBranding }: CompanyFormProps) {
  const { dict } = useI18n();
  const c = dict.partnerPortal.myCompany;
  const [companyName, setCompanyName] = React.useState(initialBranding?.companyName || "");
  const [companyDescription, setCompanyDescription] = React.useState(initialBranding?.companyDescription || "");
  const [brandColorPrimary, setBrandColorPrimary] = React.useState(initialBranding?.brandColorPrimary || "#10B981");
  const [supportEmail, setSupportEmail] = React.useState(initialBranding?.supportEmail || "");
  const [supportPhone, setSupportPhone] = React.useState(initialBranding?.supportPhone || "");
  const [websiteUrl, setWebsiteUrl] = React.useState(initialBranding?.websiteUrl || "");

  const [companyLogoUrl, setCompanyLogoUrl] = React.useState<string | null>(initialBranding?.companyLogoUrl || null);
  const [companyMarkUrl, setCompanyMarkUrl] = React.useState<string | null>(initialBranding?.companyMarkUrl || null);

  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [markFile, setMarkFile] = React.useState<File | null>(null);

  const [previewLogoUrl, setPreviewLogoUrl] = React.useState<string | null>(initialBranding?.companyLogoUrl || null);
  const [previewMarkUrl, setPreviewMarkUrl] = React.useState<string | null>(initialBranding?.companyMarkUrl || null);

  const [clearLogo, setClearLogo] = React.useState(false);
  const [clearMark, setClearMark] = React.useState(false);

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setLogoFile(file);
    if (file) {
      setClearLogo(false);
      setPreviewLogoUrl(URL.createObjectURL(file));
    }
  };

  const handleMarkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setMarkFile(file);
    if (file) {
      setClearMark(false);
      setPreviewMarkUrl(URL.createObjectURL(file));
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setCompanyLogoUrl(null);
    setPreviewLogoUrl(null);
    setClearLogo(true);
  };

  const handleRemoveMark = () => {
    setMarkFile(null);
    setCompanyMarkUrl(null);
    setPreviewMarkUrl(null);
    setClearMark(true);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("companyName", companyName);
    formData.append("companyDescription", companyDescription);
    formData.append("brandColorPrimary", brandColorPrimary);
    formData.append("supportEmail", supportEmail);
    formData.append("supportPhone", supportPhone);
    formData.append("websiteUrl", websiteUrl);

    if (companyLogoUrl) formData.append("companyLogoUrl", companyLogoUrl);
    if (companyMarkUrl) formData.append("companyMarkUrl", companyMarkUrl);
    if (clearLogo) formData.append("clearLogo", "true");
    if (clearMark) formData.append("clearMark", "true");

    if (logoFile) formData.append("companyLogoFile", logoFile);
    if (markFile) formData.append("companyMarkFile", markFile);

    try {
      const res = await savePartnerCompanyBrandingAction(formData);
      if (res.ok) {
        toast.success(res.message || "Identité de votre entreprise enregistrée !");
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      {/* Settings Column */}
      <div className="space-y-6 lg:col-span-7">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identity Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{c.commercialInfo}</CardTitle>
              <CardDescription>
                {c.commercialInfoDesc}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="companyName">{c.brandName} *</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={c.brandNamePlaceholder}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="companyDescription">{c.companyDescription}</Label>
                <Input
                  id="companyDescription"
                  value={companyDescription}
                  onChange={(e) => setCompanyDescription(e.target.value)}
                  placeholder="Ex: Mode & Accessoires"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="websiteUrl">{c.websiteUrl}</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="websiteUrl"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://mon-site.com"
                    className="pl-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{c.customerService}</CardTitle>
              <CardDescription>
                {c.customerServiceDesc}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="supportEmail">{c.supportEmail}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="supportEmail"
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    placeholder="support@horizon-boutique.com"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="supportPhone">{c.supportPhone}</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="supportPhone"
                    type="tel"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    placeholder="+216 20 123 456"
                    className="pl-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logo & Colors Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{c.brandColors}</CardTitle>
              <CardDescription>
                {c.brandColorsDesc}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Primary Color */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="brandColorPrimary" className="font-semibold text-sm">
                    Couleur Principale de la Boutique
                  </Label>
                  <span className="font-mono text-xs uppercase bg-muted px-2 py-0.5 rounded">
                    {brandColorPrimary}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="brandColorPrimary"
                    type="color"
                    value={brandColorPrimary}
                    onChange={(e) => setBrandColorPrimary(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent p-1"
                  />
                  <Input
                    value={brandColorPrimary}
                    onChange={(e) => setBrandColorPrimary(e.target.value)}
                    placeholder="#10B981"
                    maxLength={7}
                    className="font-mono text-sm uppercase max-w-[140px]"
                  />
                </div>
                {/* Presets */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {BRAND_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setBrandColorPrimary(preset.hex)}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        brandColorPrimary.toLowerCase() === preset.hex.toLowerCase()
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

              {/* Main Logo Upload */}
              <div className="rounded-lg border border-border p-4 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Logo Principal de l&apos;Entreprise</p>
                    <p className="text-xs text-muted-foreground">Formats : PNG, WebP, JPEG (Max 2 Mo, dimensions reco. 250 × 60 px)</p>
                  </div>
                  {previewLogoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveLogo}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Supprimer
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-36 items-center justify-center rounded-md bg-white border border-slate-200 p-2">
                    {previewLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewLogoUrl} alt="Logo Entreprise" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-[10px] text-slate-400 font-mono">Aucun logo</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      type="file"
                      accept="image/png,image/webp,image/jpeg"
                      onChange={handleLogoFileChange}
                      className="text-xs"
                    />
                    <Input
                      placeholder="Ou URL directe (https://...)"
                      value={companyLogoUrl || ""}
                      onChange={(e) => {
                        setCompanyLogoUrl(e.target.value);
                        setPreviewLogoUrl(e.target.value || null);
                        setClearLogo(false);
                      }}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Symbol / Mark Upload */}
              <div className="rounded-lg border border-border p-4 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Icône / Symbole Réduit (Mark)</p>
                    <p className="text-xs text-muted-foreground">Format carré pour l&apos;avatar et l&apos;affichage réduit (64 × 64 px)</p>
                  </div>
                  {previewMarkUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveMark}
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
                      <img src={previewMarkUrl} alt="Icône Entreprise" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <Building2 className="h-6 w-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      type="file"
                      accept="image/png,image/webp,image/jpeg"
                      onChange={handleMarkFileChange}
                      className="text-xs"
                    />
                    <Input
                      placeholder="Ou URL directe de l'icône"
                      value={companyMarkUrl || ""}
                      onChange={(e) => {
                        setCompanyMarkUrl(e.target.value);
                        setPreviewMarkUrl(e.target.value || null);
                        setClearMark(false);
                      }}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSubmitting}>
              <Check className="h-4 w-4 mr-2" />
              {isSubmitting ? dict.common.saving : c.saveChanges}
            </Button>
          </div>
        </form>
      </div>

      {/* Live Preview Column */}
      <div className="space-y-4 lg:col-span-5">
        <div className="sticky top-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm text-foreground">{c.previewTitle}</h3>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500 border border-emerald-500/20">
              {c.partnerIsolation}
            </span>
          </div>

          {/* Preview Partner Card */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-soft space-y-4">
            <div className="flex items-center gap-3.5 border-b border-border pb-4">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted p-1 shrink-0 overflow-hidden"
              >
                {previewMarkUrl || previewLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewMarkUrl || previewLogoUrl!}
                    alt="Logo preview"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-base text-foreground truncate">
                  {companyName || c.brandNamePlaceholder}
                </h4>
                <p className="text-xs text-muted-foreground truncate">
                  {companyDescription || c.companyDescription}
                </p>
              </div>
              <div
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: brandColorPrimary }}
                title={`Couleur : ${brandColorPrimary}`}
              />
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5 text-primary" />
                <span className="truncate">{supportEmail || "support@example.com"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5 text-primary" />
                <span>{supportPhone || "+216 -- --- ---"}</span>
              </div>
              {websiteUrl && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  <span className="truncate">{websiteUrl}</span>
                </div>
              )}
            </div>

            {/* Mock Action */}
            <div className="pt-2">
              <div
                className="flex items-center justify-center gap-2 rounded-lg py-2 px-3 text-xs font-semibold text-white shadow-xs"
                style={{ backgroundColor: brandColorPrimary }}
              >
                <span>{c.partnerIsolation}</span>
              </div>
            </div>
          </div>

          {/* Isolation Info Alert */}
          <div className="rounded-lg border border-border p-3 bg-muted/30 space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Info className="h-3.5 w-3.5 text-primary" />
              <span>{c.privacyGuarantee}</span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              {c.privacyNotice}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
