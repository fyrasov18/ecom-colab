"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ImageIcon,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export type GalleryImage = {
  id: string;
  url: string;
  title?: string | null;
  type?: string;
};

interface AnimatedProductGalleryProps {
  images: GalleryImage[];
  productName: string;
  onOpenLightbox: (index: number) => void;
  badges?: React.ReactNode;
  className?: string;
}

export function AnimatedProductGallery({
  images,
  productName,
  onOpenLightbox,
  badges,
  className,
}: AnimatedProductGalleryProps) {
  const { dict, locale, isRtl } = useI18n();
  const t = dict.partnerPortal.catalogue;

  const [activeIndex, setActiveIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef<number>(0);

  const hasMultiple = images.length > 1;
  const currentImage = images[activeIndex] ?? images[0];

  // Preload adjacent images (next and previous) to prevent white flash
  useEffect(() => {
    if (images.length <= 1) return;

    const nextIndex = (activeIndex + 1) % images.length;
    const prevIndex = (activeIndex - 1 + images.length) % images.length;

    [nextIndex, prevIndex].forEach((idx) => {
      const imgObj = images[idx];
      if (imgObj?.url && !failedImageUrls.has(imgObj.url)) {
        const preloadImg = new Image();
        preloadImg.src = imgObj.url;
      }
    });
  }, [activeIndex, images, failedImageUrls]);

  // Navigate Next
  const handleNext = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (images.length <= 1) return;

      setSlideDirection(isRtl ? "left" : "right");
      setIsTransitioning(true);
      setActiveIndex((prev) => (prev + 1) % images.length);
    },
    [images.length, isRtl],
  );

  // Navigate Previous
  const handlePrev = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (images.length <= 1) return;

      setSlideDirection(isRtl ? "right" : "left");
      setIsTransitioning(true);
      setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
    },
    [images.length, isRtl],
  );

  // Direct dot click
  const handleDotClick = (e: React.MouseEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (targetIndex === activeIndex) return;

    setSlideDirection(targetIndex > activeIndex ? "right" : "left");
    setIsTransitioning(true);
    setActiveIndex(targetIndex);
  };

  // Reset transition flag
  useEffect(() => {
    if (!isTransitioning) return;
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 320);
    return () => clearTimeout(timer);
  }, [isTransitioning, activeIndex]);

  // Touch swipe handling for mobile / tablet
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchDeltaXRef.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current !== null) {
      touchDeltaXRef.current = e.touches[0].clientX - touchStartXRef.current;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const delta = touchDeltaXRef.current;
    const threshold = 35; // minimum px for swipe

    if (Math.abs(delta) > threshold) {
      e.stopPropagation();
      if (isRtl) {
        if (delta > 0) handleNext();
        else handlePrev();
      } else {
        if (delta < 0) handleNext();
        else handlePrev();
      }
    }

    touchStartXRef.current = null;
    touchDeltaXRef.current = 0;
  };

  const handleImageError = (url: string) => {
    setFailedImageUrls((prev) => new Set(prev).add(url));
  };

  const isCurrentFailed = currentImage?.url ? failedImageUrls.has(currentImage.url) : true;

  return (
    <div
      ref={containerRef}
      className={cn(
        "group/gallery relative h-60 sm:h-64 w-full bg-slate-50/80 dark:bg-neutral-900/50 border-b border-border/60 overflow-hidden flex items-center justify-center p-3 sm:p-4 select-none cursor-pointer",
        className,
      )}
      onClick={() => onOpenLightbox(activeIndex)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      aria-roledescription="carousel"
      aria-label={productName}
    >
      {/* ── 1. Animated Image Presentation ── */}
      {currentImage && !isCurrentFailed ? (
        <div
          key={`${currentImage.id}-${activeIndex}`}
          className={cn(
            "relative h-full w-full flex items-center justify-center overflow-hidden",
            "animate-in fade-in-40 duration-300 ease-out motion-reduce:animate-none",
            slideDirection === "right" && "slide-in-from-right-3",
            slideDirection === "left" && "slide-in-from-left-3",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentImage.url}
            alt={currentImage.title || `${productName} - ${activeIndex + 1}`}
            className="max-h-full max-w-full h-auto w-auto object-contain drop-shadow-sm transition-transform duration-300 ease-out group-hover:scale-105"
            loading="lazy"
            onError={() => handleImageError(currentImage.url)}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground p-4">
          <ImageIcon className="h-8 w-8 stroke-[1.25] text-muted-foreground/50" />
          <span>
            {locale === "ar" ? "لا توجد صورة" : locale === "en" ? "No image" : "Aucune image"}
          </span>
        </div>
      )}

      {/* ── 2. Quick Zoom/Preview Trigger Overlay ── */}
      {images.length > 0 && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/25 dark:bg-black/35 backdrop-blur-[1.5px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10"
          aria-hidden="true"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background/95 dark:bg-neutral-900/95 text-foreground px-3.5 py-1.5 text-xs font-semibold shadow-md border border-border/80 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-200">
            <ZoomIn className="h-3.5 w-3.5 text-primary" />
            <span>{t.quickPreview}</span>
          </span>
        </div>
      )}

      {/* ── 3. Previous & Next Navigation Arrows (Desktop / Touch) ── */}
      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            className={cn(
              "absolute left-2.5 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full",
              "bg-background/85 dark:bg-neutral-900/85 backdrop-blur-md shadow-md border border-border/70 text-foreground",
              "opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer",
              "hover:bg-background hover:scale-110 active:scale-95 focus:opacity-100",
              // Keep subtly visible on mobile/touch screens
              "sm:opacity-0 max-sm:opacity-80 max-sm:h-7 max-sm:w-7",
            )}
            aria-label={locale === "ar" ? "الصورة السابقة" : locale === "en" ? "Previous image" : "Image précédente"}
            title={locale === "ar" ? "السابق" : locale === "en" ? "Previous" : "Précédent"}
          >
            {isRtl ? (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={handleNext}
            className={cn(
              "absolute right-2.5 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full",
              "bg-background/85 dark:bg-neutral-900/85 backdrop-blur-md shadow-md border border-border/70 text-foreground",
              "opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer",
              "hover:bg-background hover:scale-110 active:scale-95 focus:opacity-100",
              // Keep subtly visible on mobile/touch screens
              "sm:opacity-0 max-sm:opacity-80 max-sm:h-7 max-sm:w-7",
            )}
            aria-label={locale === "ar" ? "الصورة التالية" : locale === "en" ? "Next image" : "Image suivante"}
            title={locale === "ar" ? "التالي" : locale === "en" ? "Next" : "Suivant"}
          >
            {isRtl ? (
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </>
      )}

      {/* ── 4. Image Indicators (Dots) ── */}
      {hasMultiple && (
        <div
          className="absolute bottom-2.5 inset-x-0 flex items-center justify-center z-20 pointer-events-auto"
          role="tablist"
          aria-label="Sélection d'image"
        >
          <div className="flex items-center gap-1.5 rounded-full bg-black/40 dark:bg-black/60 backdrop-blur-md px-2.5 py-1 shadow-sm border border-white/10">
            {images.map((img, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <button
                  key={img.id || idx}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={(e) => handleDotClick(e, idx)}
                  className={cn(
                    "rounded-full transition-all duration-300 ease-out cursor-pointer",
                    isSelected
                      ? "h-1.5 w-4 bg-white dark:bg-primary shadow-xs"
                      : "h-1.5 w-1.5 bg-white/50 hover:bg-white/80",
                  )}
                  aria-label={`${productName} - photo ${idx + 1}`}
                  title={`${idx + 1} / ${images.length}`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── 5. Badges Overlay (Top-Left) ── */}
      {badges && (
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5 max-w-[80%] z-20 pointer-events-none">
          {badges}
        </div>
      )}

      {/* ── 6. Image Counter Badge (Top-Right) ── */}
      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenLightbox(activeIndex);
          }}
          className="absolute right-2.5 top-2.5 z-20 inline-flex items-center gap-1 rounded-full bg-background/90 dark:bg-neutral-900/90 text-foreground px-2 py-0.5 text-[11px] font-medium shadow-xs border border-border/60 hover:bg-background transition-colors cursor-pointer"
          title={`${images.length} photos disponibles`}
        >
          <Eye className="h-3 w-3 text-muted-foreground" />
          <span>{activeIndex + 1}/{images.length}</span>
        </button>
      )}
    </div>
  );
}
