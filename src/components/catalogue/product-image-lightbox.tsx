"use client";

import { useEffect, useState, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  ShoppingBag,
  Package,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/money";

export type LightboxImage = {
  id: string;
  url: string;
  title?: string | null;
  type?: string;
};

export type LightboxProduct = {
  id: string;
  name: string;
  sellingPrice: number | string;
  purchaseCost?: number | string | null;
  categoryName?: string | null;
  categoryNameAr?: string | null;
  status?: string;
  isWinning?: boolean;
  isRecommended?: boolean;
  isNew?: boolean;
  marketingAssetsCount?: number;
};

interface ProductImageLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: LightboxImage[];
  initialIndex?: number;
  product: LightboxProduct;
}

export function ProductImageLightbox({
  open,
  onOpenChange,
  images,
  initialIndex = 0,
  product,
}: ProductImageLightboxProps) {
  const { dict, dir, locale } = useI18n();
  const t = dict.partnerPortal.catalogue;
  const currencySymbol = locale === "ar" ? "د.ت" : locale === "en" ? "TND" : "DT";

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);

  // Sync index when initialIndex changes or modal opens
  useEffect(() => {
    if (open) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, images.length - 1)));
      setIsZoomed(false);
    }
  }, [open, initialIndex, images.length]);

  const hasMultiple = images.length > 1;
  const currentImage = images[currentIndex];

  const handleNext = useCallback(() => {
    setIsZoomed(false);
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const handlePrev = useCallback(() => {
    setIsZoomed(false);
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (dir === "rtl") handlePrev();
        else handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (dir === "rtl") handleNext();
        else handlePrev();
      } else if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleNext, handlePrev, dir, onOpenChange]);

  const sellingPriceFormatted = formatPrice(product.sellingPrice);
  const purchaseCostNum =
    product.purchaseCost != null && Number(product.purchaseCost) > 0
      ? Number(product.purchaseCost)
      : null;
  const purchaseCostFormatted = purchaseCostNum ? formatPrice(purchaseCostNum) : null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md transition-opacity duration-200" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col justify-between p-3 sm:p-6 text-white focus:outline-none select-none overflow-hidden"
          aria-describedby="lightbox-description"
        >
          <Dialog.Title className="sr-only">
            {product.name} - {t.quickPreview}
          </Dialog.Title>
          <Dialog.Description id="lightbox-description" className="sr-only">
            {t.quickPreview}
          </Dialog.Description>

          {/* Top Bar: Product Information, Image Count & Actions */}
          <div className="flex items-center justify-between gap-3 bg-black/40 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10 shrink-0 z-10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                <Package className="h-5 w-5 text-white/90" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm sm:text-base text-white truncate max-w-xs sm:max-w-md">
                    {product.name}
                  </h3>
                  {product.categoryName && (
                    <Badge variant="outline" className="hidden sm:inline-flex border-white/20 text-white/80 text-xs">
                      {product.categoryName}
                      {product.categoryNameAr && (
                        <span dir="rtl" className="ml-1 opacity-70">({product.categoryNameAr})</span>
                      )}
                    </Badge>
                  )}
                </div>

                {/* Subtitle / Counter */}
                <div className="flex items-center gap-2 text-xs text-white/60">
                  {hasMultiple && (
                    <span>
                      {t.imageCounter
                        .replace("{current}", String(currentIndex + 1))
                        .replace("{total}", String(images.length))}
                    </span>
                  )}
                  {currentImage?.title && (
                    <>
                      <span>•</span>
                      <span className="truncate max-w-[200px]">{currentImage.title}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Zoom toggle button */}
              <button
                type="button"
                onClick={() => setIsZoomed((prev) => !prev)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white/90"
                title={isZoomed ? t.zoomOut : t.zoomIn}
              >
                {isZoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
              </button>

              {/* Close Button */}
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 hover:text-white transition-colors text-white/80"
                  aria-label={t.closePreview}
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Center Stage: Product Image with Contain & Navigation */}
          <div className="relative flex-1 flex items-center justify-center p-2 sm:p-4 min-h-0 overflow-hidden">
            {/* Previous Button */}
            {hasMultiple && (
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-2 sm:left-4 z-20 p-2.5 sm:p-3 rounded-full bg-black/50 hover:bg-black/80 border border-white/15 text-white transition-all transform hover:scale-105 active:scale-95 shadow-lg backdrop-blur-sm"
                aria-label={t.previousImage}
              >
                <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            )}

            {/* Main Image Container */}
            <div
              className={`relative max-h-full max-w-full flex items-center justify-center transition-all duration-300 ${
                isZoomed ? "cursor-zoom-out scale-150 overflow-auto" : "cursor-zoom-in scale-100"
              }`}
              onClick={() => setIsZoomed((prev) => !prev)}
            >
              {currentImage?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentImage.url}
                  alt={currentImage.title || product.name}
                  className="max-h-[70vh] sm:max-h-[72vh] max-w-full object-contain rounded-xl drop-shadow-2xl transition-transform duration-200"
                />
              ) : (
                <div className="h-64 w-64 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 text-sm">
                  {locale === "ar" ? "لا توجد صورة" : locale === "en" ? "No image" : "Aucune image"}
                </div>
              )}
            </div>

            {/* Next Button */}
            {hasMultiple && (
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-2 sm:right-4 z-20 p-2.5 sm:p-3 rounded-full bg-black/50 hover:bg-black/80 border border-white/15 text-white transition-all transform hover:scale-105 active:scale-95 shadow-lg backdrop-blur-sm"
                aria-label={t.nextImage}
              >
                <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            )}
          </div>

          {/* Bottom Bar: Thumbnails Filmstrip, Pricing Information & CTAs */}
          <div className="bg-black/50 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-white/10 shrink-0 space-y-3 z-10">
            {/* Filmstrip thumbnails if multiple images */}
            {hasMultiple && (
              <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {images.map((img, idx) => {
                  const isSelected = idx === currentIndex;
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => {
                        setIsZoomed(false);
                        setCurrentIndex(idx);
                      }}
                      className={`relative h-12 w-12 sm:h-14 sm:w-14 rounded-lg overflow-hidden border-2 transition-all shrink-0 bg-neutral-900 ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/40 scale-105 shadow-md"
                          : "border-white/20 opacity-60 hover:opacity-100"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.title || `Miniature ${idx + 1}`}
                        className="h-full w-full object-contain p-1"
                      />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Footer details: Pricing and Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-white/10">
              {/* Dual Pricing Display */}
              <div className="flex items-center gap-5 sm:gap-8 w-full sm:w-auto justify-between sm:justify-start">
                {/* Selling Price */}
                <div>
                  <span className="text-[11px] text-white/60 uppercase tracking-wider block font-medium">
                    {t.sellingPrice}
                  </span>
                  <div className="text-base sm:text-lg font-bold text-white flex items-baseline gap-1">
                    <span>{sellingPriceFormatted}</span>
                    <span className="text-xs text-white/70 font-semibold">{currencySymbol}</span>
                  </div>
                </div>

                <div className="h-7 w-px bg-white/15" />

                {/* Purchase Cost */}
                <div>
                  <span className="text-[11px] text-white/60 uppercase tracking-wider block font-medium">
                    {t.purchaseCost}
                  </span>
                  {purchaseCostFormatted ? (
                    <div className="text-sm sm:text-base font-semibold text-emerald-400 flex items-baseline gap-1">
                      <span>{purchaseCostFormatted}</span>
                      <span className="text-xs text-emerald-300 font-medium">{currencySymbol}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-white/40 italic">
                      {t.costNotSpecified}
                    </span>
                  )}
                </div>

                {product.marketingAssetsCount !== undefined && product.marketingAssetsCount > 0 && (
                  <>
                    <div className="hidden sm:block h-7 w-px bg-white/15" />
                    <div className="hidden sm:flex items-center gap-1.5 text-xs text-sky-300 bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-lg">
                      <Layers className="h-3.5 w-3.5" />
                      <span>{t.mediaKitsCount.replace("{count}", String(product.marketingAssetsCount))}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="bg-white/10 hover:bg-white/20 border-white/20 text-white hover:text-white flex-1 sm:flex-initial"
                >
                  <Link href={`/catalogue/${product.id}`}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    {t.viewProductDetails}
                  </Link>
                </Button>

                <Button
                  asChild
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground flex-1 sm:flex-initial shadow-md"
                >
                  <Link href={`/nouvelle-commande?productId=${product.id}`}>
                    <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
                    {t.orderThisProduct}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
