"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Eye,
  Layers,
  ZoomIn,
  ImageIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/money";
import { deriveGoogleDriveUrls } from "@/lib/google-drive";
import {
  ProductImageLightbox,
  type LightboxImage,
  type LightboxProduct,
} from "./product-image-lightbox";

export type PartnerProductItem = {
  id: string;
  name: string;
  description: string | null;
  sellingPrice: number | string;
  purchaseCost: number | string | null;
  status: string;
  isWinning: boolean;
  isRecommended: boolean;
  isNew: boolean;
  categoryRef?: {
    id: string;
    name: string;
    nameAr: string | null;
    icon?: string | null;
  } | null;
  media: {
    id: string;
    type: string;
    googleDriveUrl: string;
    title: string | null;
    sortOrder: number;
  }[];
  marketingAssets: {
    id: string;
    kind: string;
    title: string | null;
  }[];
};

interface PartnerProductCardProps {
  product: PartnerProductItem;
}

export function PartnerProductCard({ product }: PartnerProductCardProps) {
  const { dict, locale } = useI18n();
  const t = dict.partnerPortal.catalogue;
  const currencySymbol = locale === "ar" ? "د.ت" : locale === "en" ? "TND" : "DT";

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Extract non-video images
  const imageMedia = product.media.filter((m) => m.type !== "VIDEO");

  // Derive Google Drive preview URLs for all images
  const lightboxImages: LightboxImage[] = [];
  for (const m of imageMedia) {
    const derived = deriveGoogleDriveUrls(m.googleDriveUrl);
    if (derived) {
      lightboxImages.push({
        id: m.id,
        url: derived.previewUrl,
        title: m.title,
        type: m.type,
      });
    }
  }

  // Primary cover image (thumbnail first, then first image)
  const coverMedia =
    imageMedia.find((m) => m.type === "THUMBNAIL") ??
    imageMedia.find((m) => m.type === "IMAGE") ??
    imageMedia[0];

  const coverDerived = coverMedia ? deriveGoogleDriveUrls(coverMedia.googleDriveUrl) : null;
  const coverUrl = coverDerived?.previewUrl;

  const hasMultipleImages = lightboxImages.length > 1;

  // Format pricing
  const sellingPriceFormatted = formatPrice(product.sellingPrice);
  const purchaseCostNum =
    product.purchaseCost != null && Number(product.purchaseCost) > 0
      ? Number(product.purchaseCost)
      : null;
  const purchaseCostFormatted = purchaseCostNum ? formatPrice(purchaseCostNum) : null;

  const lightboxProduct: LightboxProduct = {
    id: product.id,
    name: product.name,
    sellingPrice: product.sellingPrice,
    purchaseCost: product.purchaseCost,
    categoryName: product.categoryRef?.name,
    categoryNameAr: product.categoryRef?.nameAr,
    status: product.status,
    isWinning: product.isWinning,
    isRecommended: product.isRecommended,
    isNew: product.isNew,
    marketingAssetsCount: product.marketingAssets.length,
  };

  const openLightbox = (e: React.MouseEvent, index = 0) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedImageIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      <Card className="group h-full flex flex-col justify-between transition-all duration-300 hover:shadow-lg hover:border-primary/40 rounded-2xl overflow-hidden border bg-card">
        <div>
          {/* ── 1. Image Container — Full image display with contain & neutral background ── */}
          <div className="relative h-60 sm:h-64 w-full bg-slate-50/80 dark:bg-neutral-900/50 border-b border-border/60 overflow-hidden flex items-center justify-center p-3 sm:p-4 select-none">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt={product.name}
                className="max-h-full max-w-full h-auto w-auto object-contain drop-shadow-sm transition-transform duration-300 ease-out group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground p-4">
                <ImageIcon className="h-8 w-8 stroke-[1.25] text-muted-foreground/50" />
                <span>
                  {locale === "ar" ? "لا توجد صورة" : locale === "en" ? "No image" : "Aucune image"}
                </span>
              </div>
            )}

            {/* Quick Preview Hover Trigger */}
            {lightboxImages.length > 0 && (
              <button
                type="button"
                onClick={(e) => openLightbox(e, 0)}
                className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                title={t.quickPreview}
                aria-label={t.quickPreview}
              >
                <span className="inline-flex items-center gap-1.5 rounded-full bg-background/95 dark:bg-neutral-900/95 text-foreground px-3.5 py-1.5 text-xs font-semibold shadow-md border border-border/80 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-200">
                  <ZoomIn className="h-3.5 w-3.5 text-primary" />
                  <span>{t.quickPreview}</span>
                </span>
              </button>
            )}

            {/* Top Left: Badges Overlay */}
            <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5 max-w-[85%] z-10 pointer-events-none">
              {product.status === "OUT_OF_STOCK" && (
                <Badge variant="warning" className="shadow-xs text-[11px] font-semibold">
                  {t.outOfStock}
                </Badge>
              )}
              {product.isWinning && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500 text-white font-semibold px-2 py-0.5 text-[11px] shadow-xs">
                  ⭐ {locale === "ar" ? "منتج رابح" : locale === "en" ? "Winner" : "Produit gagnant"}
                </span>
              )}
              {product.isRecommended && (
                <span className="inline-flex items-center gap-1 rounded-md bg-rose-500 text-white font-semibold px-2 py-0.5 text-[11px] shadow-xs">
                  🔥 {t.recommended}
                </span>
              )}
              {product.isNew && (
                <span className="inline-flex items-center gap-1 rounded-md bg-sky-500 text-white font-semibold px-2 py-0.5 text-[11px] shadow-xs">
                  🆕 {dict.products.isNew}
                </span>
              )}
            </div>

            {/* Top Right: Multiple Images Indicator Button */}
            {hasMultipleImages && (
              <button
                type="button"
                onClick={(e) => openLightbox(e, 0)}
                className="absolute right-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-full bg-background/90 dark:bg-neutral-900/90 text-foreground px-2 py-0.5 text-[11px] font-medium shadow-xs border border-border/60 hover:bg-background transition-colors"
                title={`${lightboxImages.length} photos disponibles`}
              >
                <Eye className="h-3 w-3 text-muted-foreground" />
                <span>{lightboxImages.length}</span>
              </button>
            )}
          </div>

          {/* ── 2. Card Content ── */}
          <CardContent className="space-y-2.5 p-4 sm:p-5">
            {/* Category tag */}
            {product.categoryRef && (
              <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="truncate">{product.categoryRef.name}</span>
                {product.categoryRef.nameAr && (
                  <span dir="rtl" className="text-[11px] text-muted-foreground font-arabic truncate">
                    ({product.categoryRef.nameAr})
                  </span>
                )}
              </div>
            )}

            {/* Product Name */}
            <Link
              href={`/catalogue/${product.id}`}
              className="flex items-start justify-between gap-2 group/title"
            >
              <h3 className="font-semibold text-base leading-snug text-foreground group-hover/title:text-primary transition-colors line-clamp-2">
                {product.name}
              </h3>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover/title:translate-x-1 group-hover/title:text-primary mt-0.5" />
            </Link>

            {/* Product description with controlled text length */}
            {product.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {product.description}
              </p>
            )}
          </CardContent>
        </div>

        {/* ── 3. Footer: Dual Pricing Display & Media Kit ── */}
        <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-3 border-t bg-muted/15 space-y-3">
          {/* Dual Pricing Grid */}
          <div className="flex items-center justify-between gap-3">
            {/* Prix de vente (Selling Price) */}
            <div className="space-y-0.5">
              <span className="text-[11px] text-muted-foreground block font-medium">
                {t.sellingPrice}
              </span>
              <div className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-baseline gap-1">
                <span>{sellingPriceFormatted}</span>
                <span className="text-xs font-semibold text-muted-foreground">{currencySymbol}</span>
              </div>
            </div>

            <div className="h-7 w-px bg-border/80" />

            {/* Coût d'achat (Purchase Cost) */}
            <div className="space-y-0.5 text-right sm:text-left">
              <span className="text-[11px] text-muted-foreground block font-medium">
                {t.purchaseCost}
              </span>
              {purchaseCostFormatted ? (
                <div className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-baseline gap-1 justify-end sm:justify-start">
                  <span>{purchaseCostFormatted}</span>
                  <span className="text-[11px] font-medium text-muted-foreground">{currencySymbol}</span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground/60 italic block">
                  {t.costNotSpecified}
                </span>
              )}
            </div>
          </div>

          {/* Bottom Bar: Action link & Media kit badge */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs">
            <Link
              href={`/catalogue/${product.id}`}
              className="text-primary font-medium hover:underline inline-flex items-center gap-1 text-xs"
            >
              <span>{t.viewProductDetails}</span>
              <ChevronRight className="h-3 w-3" />
            </Link>

            <Badge variant="outline" className="text-[11px] font-normal border-border/80 text-muted-foreground flex items-center gap-1">
              <Layers className="h-3 w-3 text-primary" />
              <span>
                {product.marketingAssets.length > 0
                  ? t.mediaKitsCount.replace("{count}", String(product.marketingAssets.length))
                  : t.noMarketingAssets}
              </span>
            </Badge>
          </div>
        </div>
      </Card>

      {/* Lightbox Modal */}
      {lightboxImages.length > 0 && (
        <ProductImageLightbox
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          images={lightboxImages}
          initialIndex={selectedImageIndex}
          product={lightboxProduct}
        />
      )}
    </>
  );
}
