"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  Truck,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Upload,
  Globe,
  Check,
  AlertCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type {
  DeliveryPartnerItem,
  DeliveryPartnersConfig,
} from "@/modules/branding/delivery-partners-schemas";
import {
  addDeliveryPartnerAction,
  deleteDeliveryPartnerAction,
  removeDeliveryPartnerLogoAction,
  reorderDeliveryPartnersAction,
  replaceDeliveryPartnerLogoAction,
  saveDeliveryPartnersSectionAction,
  toggleDeliveryPartnerActiveAction,
  updateDeliveryPartnerAction,
} from "./delivery-actions";
import { cn } from "@/lib/utils";

interface DeliveryPartnersManagerProps {
  config: DeliveryPartnersConfig;
  onChange: (config: DeliveryPartnersConfig) => void;
  canEdit: boolean;
}

export function DeliveryPartnersManager({
  config,
  onChange,
  canEdit,
}: DeliveryPartnersManagerProps) {
  const { dict } = useI18n();
  // Section settings state
  const [enabled, setEnabled] = React.useState(config.enabled);
  const [titleFr, setTitleFr] = React.useState(config.title.fr);
  const [titleAr, setTitleAr] = React.useState(config.title.ar);
  const [titleEn, setTitleEn] = React.useState(config.title.en);

  const [subtitleFr, setSubtitleFr] = React.useState(config.subtitle.fr);
  const [subtitleAr, setSubtitleAr] = React.useState(config.subtitle.ar);
  const [subtitleEn, setSubtitleEn] = React.useState(config.subtitle.en);

  const [sectionLangTab, setSectionLangTab] = React.useState<"fr" | "ar" | "en">("fr");
  const [isSavingSection, setIsSavingSection] = React.useState(false);

  // Modals state
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = React.useState(false);
  const [addName, setAddName] = React.useState("");
  const [addOrder, setAddOrder] = React.useState(config.partners.length);
  const [addIsActive, setAddIsActive] = React.useState(true);
  const [addWebsite, setAddWebsite] = React.useState("");
  const [addFile, setAddFile] = React.useState<File | null>(null);
  const [addPreviewUrl, setAddPreviewUrl] = React.useState<string | null>(null);

  const [editingPartner, setEditingPartner] = React.useState<DeliveryPartnerItem | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editOrder, setEditOrder] = React.useState(0);
  const [editIsActive, setEditIsActive] = React.useState(true);
  const [editWebsite, setEditWebsite] = React.useState("");
  const [editFile, setEditFile] = React.useState<File | null>(null);
  const [editPreviewUrl, setEditPreviewUrl] = React.useState<string | null>(null);

  // Hidden logo replace input
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [replacingPartnerId, setReplacingPartnerId] = React.useState<string | null>(null);

  // Clean object URLs on unmount
  React.useEffect(() => {
    return () => {
      if (addPreviewUrl && addPreviewUrl.startsWith("blob:")) URL.revokeObjectURL(addPreviewUrl);
      if (editPreviewUrl && editPreviewUrl.startsWith("blob:")) URL.revokeObjectURL(editPreviewUrl);
    };
  }, [addPreviewUrl, editPreviewUrl]);

  // Save top-level section settings
  async function handleSaveSection(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;

    setIsSavingSection(true);
    try {
      const fd = new FormData();
      fd.set("enabled", String(enabled));
      fd.set("title_fr", titleFr);
      fd.set("title_ar", titleAr);
      fd.set("title_en", titleEn);
      fd.set("subtitle_fr", subtitleFr);
      fd.set("subtitle_ar", subtitleAr);
      fd.set("subtitle_en", subtitleEn);

      const res = await saveDeliveryPartnersSectionAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(res.message ?? "Section enregistrée.");
      onChange({
        ...config,
        enabled,
        title: { fr: titleFr, ar: titleAr, en: titleEn },
        subtitle: { fr: subtitleFr, ar: subtitleAr, en: subtitleEn },
      });
    } catch {
      toast.error("Une erreur inattendue est survenue.");
    } finally {
      setIsSavingSection(false);
    }
  }

  // Add delivery partner
  async function handleAddPartner(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !addName.trim()) {
      toast.error("Veuillez saisir un nom de société.");
      return;
    }

    setIsSubmittingAdd(true);
    try {
      const fd = new FormData();
      fd.set("name", addName.trim());
      fd.set("displayOrder", String(addOrder));
      fd.set("isActive", String(addIsActive));
      if (addWebsite.trim()) fd.set("websiteUrl", addWebsite.trim());
      if (addFile) fd.set("logoFile", addFile);

      const res = await addDeliveryPartnerAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      const created = res.data as DeliveryPartnerItem;
      const nextList = [...config.partners, created].sort((a, b) => a.displayOrder - b.displayOrder);

      onChange({
        ...config,
        partners: nextList,
      });

      toast.success(res.message ?? "Partenaire ajouté.");
      setIsAddOpen(false);
      setAddName("");
      setAddWebsite("");
      setAddFile(null);
      setAddPreviewUrl(null);
      setAddOrder(nextList.length);
    } catch {
      toast.error("Erreur lors de l'ajout.");
    } finally {
      setIsSubmittingAdd(false);
    }
  }

  // Open edit modal
  function openEditModal(partner: DeliveryPartnerItem) {
    setEditingPartner(partner);
    setEditName(partner.name);
    setEditOrder(partner.displayOrder);
    setEditIsActive(partner.isActive);
    setEditWebsite(partner.websiteUrl || "");
    setEditFile(null);
    setEditPreviewUrl(partner.logoUrl);
  }

  // Save edit partner
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !editingPartner || !editName.trim()) return;

    setIsSubmittingEdit(true);
    try {
      const fd = new FormData();
      fd.set("id", editingPartner.id);
      fd.set("name", editName.trim());
      fd.set("displayOrder", String(editOrder));
      fd.set("isActive", String(editIsActive));
      if (editWebsite.trim()) fd.set("websiteUrl", editWebsite.trim());
      if (editFile) fd.set("logoFile", editFile);

      const res = await updateDeliveryPartnerAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      const updated = res.data as DeliveryPartnerItem;
      const nextList = config.partners
        .map((p) => (p.id === updated.id ? updated : p))
        .sort((a, b) => a.displayOrder - b.displayOrder);

      onChange({
        ...config,
        partners: nextList,
      });

      toast.success(res.message ?? "Partenaire mis à jour.");
      setEditingPartner(null);
    } catch {
      toast.error("Erreur lors de la modification.");
    } finally {
      setIsSubmittingEdit(false);
    }
  }

  // Toggle active state
  async function handleToggleActive(partner: DeliveryPartnerItem) {
    if (!canEdit) return;

    const nextState = !partner.isActive;
    // Optimistic update
    const nextList = config.partners.map((p) =>
      p.id === partner.id ? { ...p, isActive: nextState } : p
    );
    onChange({ ...config, partners: nextList });

    try {
      const res = await toggleDeliveryPartnerActiveAction(partner.id, nextState);
      if (!res.ok) {
        toast.error(res.error);
        // Rollback
        onChange(config);
        return;
      }
      toast.success(res.message);
    } catch {
      toast.error("Erreur de modification du statut.");
      onChange(config);
    }
  }

  // Reorder up / down
  async function handleMove(index: number, direction: "up" | "down") {
    if (!canEdit) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= config.partners.length) return;

    const items = [...config.partners];
    const [moved] = items.splice(index, 1);
    items.splice(targetIndex, 0, moved);

    // Re-assign displayOrder
    const reordered = items.map((p, idx) => ({ ...p, displayOrder: idx }));
    onChange({ ...config, partners: reordered });

    try {
      const orderedIds = reordered.map((p) => p.id);
      const res = await reorderDeliveryPartnersAction(orderedIds);
      if (!res.ok) {
        toast.error(res.error);
        onChange(config); // rollback
        return;
      }
      toast.success("Ordre d'affichage mis à jour.");
    } catch {
      toast.error("Erreur lors du réordonnancement.");
      onChange(config);
    }
  }

  // Replace logo trigger
  function handleTriggerLogoReplace(partnerId: string) {
    if (!canEdit) return;
    setReplacingPartnerId(partnerId);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !replacingPartnerId) return;

    const partnerId = replacingPartnerId;
    setReplacingPartnerId(null);
    e.target.value = "";

    const toastId = toast.loading("Téléversement du nouveau logo...");
    try {
      const fd = new FormData();
      fd.set("logoFile", file);

      const res = await replaceDeliveryPartnerLogoAction(partnerId, fd);
      if (!res.ok) {
        toast.error(res.error, { id: toastId });
        return;
      }

      const updated = res.data as DeliveryPartnerItem;
      const nextList = config.partners.map((p) => (p.id === updated.id ? updated : p));
      onChange({ ...config, partners: nextList });
      toast.success("Logo mis à jour avec succès.", { id: toastId });
    } catch {
      toast.error("Erreur lors de l'envoi du fichier.", { id: toastId });
    }
  }

  // Remove logo
  async function handleRemoveLogo(partner: DeliveryPartnerItem) {
    if (!canEdit) return;
    if (!confirm(`Supprimer le logo pour "${partner.name}" ? Le nom s'affichera sous forme de badge.`)) {
      return;
    }

    try {
      const res = await removeDeliveryPartnerLogoAction(partner.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      const updated = res.data as DeliveryPartnerItem;
      const nextList = config.partners.map((p) => (p.id === updated.id ? updated : p));
      onChange({ ...config, partners: nextList });
      toast.success("Logo supprimé.");
    } catch {
      toast.error("Erreur lors de la suppression du logo.");
    }
  }

  // Delete partner
  async function handleDeletePartner(partner: DeliveryPartnerItem) {
    if (!canEdit) return;
    if (!confirm(`Confirmer la suppression définitive du transporteur "${partner.name}" ?`)) {
      return;
    }

    try {
      const res = await deleteDeliveryPartnerAction(partner.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      const nextList = config.partners.filter((p) => p.id !== partner.id);
      onChange({ ...config, partners: nextList });
      toast.success("Société de livraison supprimée.");
    } catch {
      toast.error("Erreur lors de la suppression.");
    }
  }

  const sortedPartners = [...config.partners].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="space-y-6">
      {/* Hidden file input for logo replacement */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* ── CARD 1: SECTION CONFIGURATION & MULTILINGUAL COPY ── */}
      <Card className="border-border shadow-soft">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                <span>{dict.authDesign.deliveryPartnersSection}</span>
              </CardTitle>
              <CardDescription className="text-xs">
                {dict.authDesign.deliveryPartnersDesc}
              </CardDescription>
            </div>

            {/* Master Toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer rounded-lg border border-border bg-card px-3.5 py-2 hover:bg-muted/30 transition-colors">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                disabled={!canEdit}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
              <span className="text-xs font-semibold text-foreground">
                {enabled ? dict.authDesign.sectionVisible : dict.authDesign.sectionHidden}
              </span>
            </label>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Multilingual Selector Pills */}
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Langue des textes :</span>
            <button
              type="button"
              onClick={() => setSectionLangTab("fr")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer",
                sectionLangTab === "fr"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              Français (FR)
            </button>
            <button
              type="button"
              onClick={() => setSectionLangTab("ar")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer",
                sectionLangTab === "ar"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              العربية (AR)
            </button>
            <button
              type="button"
              onClick={() => setSectionLangTab("en")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer",
                sectionLangTab === "en"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              English (EN)
            </button>
          </div>

          {/* Tab Content: FR */}
          {sectionLangTab === "fr" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="titleFr" className="text-xs font-semibold">
                  Titre de la section (FR)
                </Label>
                <Input
                  id="titleFr"
                  value={titleFr}
                  onChange={(e) => setTitleFr(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Nos partenaires de livraison"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="subtitleFr" className="text-xs font-semibold">
                  Sous-titre descriptif (FR)
                </Label>
                <Input
                  id="subtitleFr"
                  value={subtitleFr}
                  onChange={(e) => setSubtitleFr(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Nous collaborons avec des solutions de livraison..."
                />
              </div>
            </div>
          )}

          {/* Tab Content: AR */}
          {sectionLangTab === "ar" && (
            <div className="grid gap-4 sm:grid-cols-2" dir="rtl">
              <div className="space-y-1.5">
                <Label htmlFor="titleAr" className="text-xs font-semibold text-right block">
                  عنوان القسم (بالعربية)
                </Label>
                <Input
                  id="titleAr"
                  dir="rtl"
                  value={titleAr}
                  onChange={(e) => setTitleAr(e.target.value)}
                  disabled={!canEdit}
                  placeholder="شركاؤنا في التوصيل"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="subtitleAr" className="text-xs font-semibold text-right block">
                  الوصف الفرعي (بالعربية)
                </Label>
                <Input
                  id="subtitleAr"
                  dir="rtl"
                  value={subtitleAr}
                  onChange={(e) => setSubtitleAr(e.target.value)}
                  disabled={!canEdit}
                  placeholder="نتعاون مع حلول توصيل لتسهيل معالجة ومتابعة طلباتكم."
                />
              </div>
            </div>
          )}

          {/* Tab Content: EN */}
          {sectionLangTab === "en" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="titleEn" className="text-xs font-semibold">
                  Section Title (EN)
                </Label>
                <Input
                  id="titleEn"
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Our Delivery Partners"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="subtitleEn" className="text-xs font-semibold">
                  Subtitle Description (EN)
                </Label>
                <Input
                  id="subtitleEn"
                  value={subtitleEn}
                  onChange={(e) => setSubtitleEn(e.target.value)}
                  disabled={!canEdit}
                  placeholder="We collaborate with delivery solutions..."
                />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              size="sm"
              onClick={handleSaveSection}
              disabled={!canEdit || isSavingSection}
              className="gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{isSavingSection ? dict.authDesign.saving : dict.authDesign.saveConfig}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── CARD 2: DELIVERY COMPANIES REGISTRY ── */}
      <Card className="border-border shadow-soft">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold">{dict.authDesign.carrierList}</CardTitle>
                <Badge variant="outline" className="text-[11px] font-mono">
                  {sortedPartners.length} transporteur{sortedPartners.length > 1 ? "s" : ""}
                </Badge>
              </div>
              <CardDescription className="text-xs mt-1">
                {dict.authDesign.carrierListDesc}
              </CardDescription>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() => {
                setAddName("");
                setAddWebsite("");
                setAddOrder(sortedPartners.length);
                setAddIsActive(true);
                setAddFile(null);
                setAddPreviewUrl(null);
                setIsAddOpen(true);
              }}
              disabled={!canEdit}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>{dict.authDesign.addCarrier}</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Information banner */}
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              {dict.authDesign.transparencyNotice}
            </div>
          </div>

          {/* Partners Table / List */}
          {sortedPartners.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
                <Truck className="h-6 w-6" />
              </div>
              <div className="text-sm font-semibold text-foreground">{dict.authDesign.noCarriers}</div>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                {dict.authDesign.noCarriersDesc}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 gap-1.5"
                onClick={() => setIsAddOpen(true)}
                disabled={!canEdit}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{dict.authDesign.addCarrier}</span>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 w-16 text-center">{dict.authDesign.order}</th>
                    <th className="py-2.5 px-4 w-36">{dict.authDesign.logo}</th>
                    <th className="py-2.5 px-4">{dict.authDesign.carrierAndWeb}</th>
                    <th className="py-2.5 px-4 w-28 text-center">{dict.authDesign.status}</th>
                    <th className="py-2.5 px-4 w-44 text-right">{dict.authDesign.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedPartners.map((partner, idx) => {
                    const hasLogo = Boolean(partner.logoUrl);

                    return (
                      <tr
                        key={partner.id}
                        className={cn(
                          "transition-colors hover:bg-muted/30",
                          !partner.isActive && "opacity-60 bg-muted/10"
                        )}
                      >
                        {/* Order & Reordering buttons */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="font-mono font-semibold text-foreground w-4 text-center">
                              {partner.displayOrder + 1}
                            </span>
                            <div className="flex flex-col">
                              <button
                                type="button"
                                title="Monter"
                                onClick={() => handleMove(idx, "up")}
                                disabled={!canEdit || idx === 0}
                                className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                title="Descendre"
                                onClick={() => handleMove(idx, "down")}
                                disabled={!canEdit || idx === sortedPartners.length - 1}
                                className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Logo Preview & Quick Logo Actions */}
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-10 w-24 items-center justify-center rounded-md border border-border/60 bg-background/90 p-1">
                              {hasLogo ? (
                                <Image
                                  src={partner.logoUrl!}
                                  alt={partner.name}
                                  width={80}
                                  height={28}
                                  className="h-6 w-auto max-w-[80px] object-contain"
                                />
                              ) : (
                                <span className="text-[10px] font-bold text-muted-foreground">
                                  {partner.name.slice(0, 3).toUpperCase()}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-col gap-1">
                              <button
                                type="button"
                                title="Remplacer le logo"
                                onClick={() => handleTriggerLogoReplace(partner.id)}
                                disabled={!canEdit}
                                className="text-[10px] font-medium text-primary hover:underline cursor-pointer flex items-center gap-0.5"
                              >
                                <Upload className="h-2.5 w-2.5" />
                                <span>{hasLogo ? "Changer" : "Ajouter"}</span>
                              </button>
                              {hasLogo && (
                                <button
                                  type="button"
                                  title="Supprimer le logo"
                                  onClick={() => handleRemoveLogo(partner)}
                                  disabled={!canEdit}
                                  className="text-[10px] font-medium text-destructive hover:underline cursor-pointer"
                                >
                                  Retirer
                                </button>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Company Name & Website */}
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                            <span>{partner.name}</span>
                          </div>
                          {partner.websiteUrl ? (
                            <a
                              href={partner.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mt-0.5"
                            >
                              <Globe className="h-3 w-3" />
                              <span className="truncate max-w-[200px]">{partner.websiteUrl}</span>
                            </a>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/60 italic">Aucun site configuré</span>
                          )}
                        </td>

                        {/* Visibility Status */}
                        <td className="py-2.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(partner)}
                            disabled={!canEdit}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                              partner.isActive
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                            )}
                          >
                            {partner.isActive ? (
                              <>
                                <Eye className="h-3 w-3" />
                                <span>Actif</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="h-3 w-3" />
                                <span>Inactif</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => openEditModal(partner)}
                              disabled={!canEdit}
                              title="Modifier la société"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeletePartner(partner)}
                              disabled={!canEdit}
                              title="Supprimer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── MODAL: ADD DELIVERY PARTNER ── */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl animate-fade-in space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">Ajouter une société de livraison</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddPartner} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="addName" className="text-xs font-semibold">
                  Nom de la société <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="addName"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Ex : Aramex, First Delivery..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="addOrder" className="text-xs font-semibold">
                    Ordre d&apos;affichage
                  </Label>
                  <Input
                    id="addOrder"
                    type="number"
                    min={0}
                    value={addOrder}
                    onChange={(e) => setAddOrder(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-1.5 flex flex-col justify-end">
                  <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addIsActive}
                      onChange={(e) => setAddIsActive(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-foreground">Actif (visible)</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="addWebsite" className="text-xs font-semibold">
                  Site web (optionnel)
                </Label>
                <Input
                  id="addWebsite"
                  type="url"
                  value={addWebsite}
                  onChange={(e) => setAddWebsite(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              {/* Logo File Upload */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Logo (PNG, WebP ou JPEG, max 2 Mo)</Label>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-28 items-center justify-center rounded-lg border border-border bg-muted/40 p-1 overflow-hidden">
                    {addPreviewUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={addPreviewUrl}
                        alt="Aperçu"
                        className="h-8 max-w-[100px] object-contain"
                      />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setAddFile(f);
                        if (addPreviewUrl && addPreviewUrl.startsWith("blob:")) {
                          URL.revokeObjectURL(addPreviewUrl);
                        }
                        setAddPreviewUrl(URL.createObjectURL(f));
                      }
                    }}
                    className="text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddOpen(false)}
                  disabled={isSubmittingAdd}
                >
                  Annuler
                </Button>
                <Button type="submit" size="sm" disabled={isSubmittingAdd || !addName.trim()}>
                  {isSubmittingAdd ? "Ajout..." : "Ajouter le transporteur"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT DELIVERY PARTNER ── */}
      {editingPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl animate-fade-in space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">Modifier la société de livraison</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPartner(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="editName" className="text-xs font-semibold">
                  Nom de la société <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="editName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="editOrder" className="text-xs font-semibold">
                    Ordre d&apos;affichage
                  </Label>
                  <Input
                    id="editOrder"
                    type="number"
                    min={0}
                    value={editOrder}
                    onChange={(e) => setEditOrder(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-1.5 flex flex-col justify-end">
                  <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-foreground">Actif (visible)</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editWebsite" className="text-xs font-semibold">
                  Site web (optionnel)
                </Label>
                <Input
                  id="editWebsite"
                  type="url"
                  value={editWebsite}
                  onChange={(e) => setEditWebsite(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              {/* Logo File Replacement */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Logo (laisser vide pour conserver le logo existant)</Label>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-28 items-center justify-center rounded-lg border border-border bg-muted/40 p-1 overflow-hidden">
                    {editPreviewUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={editPreviewUrl}
                        alt="Aperçu"
                        className="h-8 max-w-[100px] object-contain"
                      />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setEditFile(f);
                        if (editPreviewUrl && editPreviewUrl.startsWith("blob:")) {
                          URL.revokeObjectURL(editPreviewUrl);
                        }
                        setEditPreviewUrl(URL.createObjectURL(f));
                      }
                    }}
                    className="text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingPartner(null)}
                  disabled={isSubmittingEdit}
                >
                  Annuler
                </Button>
                <Button type="submit" size="sm" disabled={isSubmittingEdit || !editName.trim()}>
                  {isSubmittingEdit ? "Enregistrement..." : "Enregistrer les modifications"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
