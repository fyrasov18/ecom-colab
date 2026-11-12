"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Upload,
  Link as LinkIcon,
  Sparkles,
  DollarSign,
  Building2,
  Phone,
  FileText,
  Target,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { submitSuggestionAction } from "@/app/(partner)/suggestions-produits/actions";
import { useI18n } from "@/lib/i18n";

export function SuggestionForm() {
  const router = useRouter();
  const { t, isRtl } = useI18n();
  const [isPending, startTransition] = useTransition();

  // Form field states
  const [name, setName] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  // Optional fields
  const [description, setDescription] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [supplierUrl, setSupplierUrl] = useState("");
  const [characteristics, setCharacteristics] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [partnerReason, setPartnerReason] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  const [formError, setFormError] = useState<string | null>(null);

  // Handle image file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error("Le fichier dépasse la taille maximale autorisée de 25 Mo.");
        return;
      }
      setImageFile(file);
      setPreviewSrc(URL.createObjectURL(file));
      setFormError(null);
    }
  };

  const handleUrlChange = (val: string) => {
    setImageUrl(val);
    if (!imageFile) {
      setPreviewSrc(val.trim() || null);
    }
  };

  // Calculate margin preview
  const numSelling = parseFloat(sellingPrice) || 0;
  const numPurchase = parseFloat(purchasePrice) || 0;
  const grossMargin = numSelling > 0 && numPurchase > 0 ? numSelling - numPurchase : null;
  const marginPercent =
    grossMargin !== null && numSelling > 0 ? ((grossMargin / numSelling) * 100).toFixed(1) : null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Le nom du produit est obligatoire.");
      return;
    }

    if (!numSelling || numSelling <= 0) {
      setFormError("Le prix de vente estimé doit être strictement supérieur à 0.");
      return;
    }

    if (!imageFile && !imageUrl.trim()) {
      setFormError("Une image du produit est obligatoire (fichier ou URL).");
      return;
    }

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("estimatedSellingPrice", sellingPrice);
    if (imageFile) {
      formData.append("imageFile", imageFile);
    }
    if (imageUrl.trim()) {
      formData.append("imageUrl", imageUrl.trim());
    }
    if (description.trim()) formData.append("description", description.trim());
    if (purchasePrice) formData.append("estimatedPurchasePrice", purchasePrice);
    if (supplierName.trim()) formData.append("supplierName", supplierName.trim());
    if (supplierContact.trim()) formData.append("supplierContact", supplierContact.trim());
    if (supplierUrl.trim()) formData.append("supplierUrl", supplierUrl.trim());
    if (characteristics.trim()) formData.append("characteristics", characteristics.trim());
    if (targetAudience.trim()) formData.append("targetAudience", targetAudience.trim());
    if (partnerReason.trim()) formData.append("partnerReason", partnerReason.trim());
    if (additionalNotes.trim()) formData.append("additionalNotes", additionalNotes.trim());

    startTransition(async () => {
      try {
        const res = await submitSuggestionAction(null, formData);
        if (res.ok) {
          toast.success(res.message || "Suggestion envoyée avec succès !");
          router.push("/suggestions-produits");
        } else {
          setFormError(res.error || "Une erreur est survenue.");
          toast.error(res.error || "Erreur lors de la soumission.");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inattendue.";
        setFormError(msg);
        toast.error(msg);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      {/* Top Bar with Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/suggestions-produits"
          className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`} />
          <span>{t("productSuggestions.backToList")}</span>
        </Link>
      </div>

      {formError && (
        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Erreur de validation</p>
            <p className="mt-0.5 text-xs opacity-90">{formError}</p>
          </div>
        </div>
      )}

      {/* SECTION 1: PRODUIT & PRIX (Obligatoire) */}
      <div className="p-6 rounded-2xl border bg-card shadow-sm space-y-6">
        <div className="border-b pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              {t("productSuggestions.detailsTitle")}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Les informations de base indispensables pour que notre équipe puisse étudier votre suggestion.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Nom du produit */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1">
              <span>{t("productSuggestions.productName")}</span>
              <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("productSuggestions.productNamePlaceholder")}
              className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Prix de vente estimé */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1">
              <span>{t("productSuggestions.estimatedSellingPrice")}</span>
              <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.1"
                required
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder={t("productSuggestions.estimatedSellingPricePlaceholder")}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                DT
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Prix auquel vous pensez pouvoir vendre ce produit en Tunisie.
            </p>
          </div>

          {/* Prix d'achat fournisseur estimé */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t("productSuggestions.estimatedPurchasePrice")}
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder={t("productSuggestions.estimatedPurchasePricePlaceholder")}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                DT
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Coût unitaire d&apos;acquisition approximatif chez le fournisseur.
            </p>
          </div>
        </div>

        {/* Live Gross Margin Preview */}
        {grossMargin !== null && (
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Estimation de la marge brute</p>
                <p className="text-[11px] text-muted-foreground">
                  Différence entre prix de vente estimé et coût fournisseur
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-bold text-primary">+{grossMargin.toFixed(2)} DT</div>
              {marginPercent && (
                <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  {marginPercent}% de rentabilité brute
                </div>
              )}
            </div>
          </div>
        )}

        {/* Image du produit (Upload ou URL) */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1">
            <span>{t("productSuggestions.productImage")}</span>
            <span className="text-destructive">*</span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* File Upload Zone */}
            <label className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 cursor-pointer transition-colors text-center">
              <Upload className="w-8 h-8 text-primary/80 mb-2" />
              <span className="text-xs font-semibold text-foreground">
                {t("productSuggestions.dragAndDrop")}
              </span>
              <span className="text-[11px] text-muted-foreground mt-1">
                PNG, JPG, WebP jusqu&apos;à 25 Mo
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {/* URL Fallback & Preview */}
            <div className="space-y-3 flex flex-col justify-between">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                  {t("productSuggestions.orUrl")}
                </label>
                <div className="relative">
                  <LinkIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder={t("productSuggestions.imageUrlPlaceholder")}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {previewSrc ? (
                <div className="relative aspect-video rounded-xl border bg-muted/50 overflow-hidden flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewSrc} alt="Preview" className="w-full h-full object-cover" />
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-medium">
                    Aperçu
                  </span>
                </div>
              ) : (
                <div className="aspect-video rounded-xl border border-dashed bg-muted/20 flex flex-col items-center justify-center text-muted-foreground">
                  <ImageIcon className="w-6 h-6 opacity-40 mb-1" />
                  <span className="text-[11px]">Aucun aperçu disponible</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: FOURNISSEUR & APPROVISIONNEMENT (Facultatif) */}
      <div className="p-6 rounded-2xl border bg-card shadow-sm space-y-6">
        <div className="border-b pb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              Coordonnées du fournisseur (facultatif)
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Si vous avez déjà repéré le grossiste ou l&apos;importateur, partagez ses détails pour accélérer le sourcing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t("productSuggestions.supplierName")}
            </label>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder={t("productSuggestions.supplierNamePlaceholder")}
              className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t("productSuggestions.supplierContact")}
            </label>
            <input
              type="text"
              value={supplierContact}
              onChange={(e) => setSupplierContact(e.target.value)}
              placeholder={t("productSuggestions.supplierContactPlaceholder")}
              className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t("productSuggestions.supplierUrl")}
            </label>
            <input
              type="url"
              value={supplierUrl}
              onChange={(e) => setSupplierUrl(e.target.value)}
              placeholder={t("productSuggestions.supplierUrlPlaceholder")}
              className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: ARGUMENTAIRE & MARCHÉ (Facultatif mais recommandé) */}
      <div className="p-6 rounded-2xl border bg-card shadow-sm space-y-6">
        <div className="border-b pb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              Argumentaire & Public Cible (facultatif)
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Aidez-nous à comprendre pourquoi ce produit a un potentiel exceptionnel sur le marché tunisien.
          </p>
        </div>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t("productSuggestions.partnerReason")}
            </label>
            <textarea
              rows={3}
              value={partnerReason}
              onChange={(e) => setPartnerReason(e.target.value)}
              placeholder={t("productSuggestions.partnerReasonPlaceholder")}
              className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {t("productSuggestions.characteristics")}
              </label>
              <textarea
                rows={3}
                value={characteristics}
                onChange={(e) => setCharacteristics(e.target.value)}
                placeholder={t("productSuggestions.characteristicsPlaceholder")}
                className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {t("productSuggestions.targetAudience")}
              </label>
              <textarea
                rows={3}
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder={t("productSuggestions.targetAudiencePlaceholder")}
                className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Description générale du produit
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description détaillée du produit, fonctionnalités, coloris..."
              className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t("productSuggestions.additionalNotes")}
            </label>
            <textarea
              rows={2}
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder={t("productSuggestions.additionalNotesPlaceholder")}
              className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
            />
          </div>
        </div>
      </div>

      {/* Bottom Submit Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <Link
          href="/suggestions-produits"
          className="px-5 py-2.5 rounded-xl border font-medium text-sm hover:bg-muted transition-colors"
        >
          Annuler
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow hover:bg-primary/95 transition-all disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t("productSuggestions.submitting")}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>{t("productSuggestions.submit")}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
