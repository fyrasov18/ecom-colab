"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Package,
  Layers,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { CATEGORY_ICONS } from "@/app/(admin)/produits/categories/category-modal";
import { NativeSelect } from "@/components/ui/native-select";

export type CategoryFilterItem = {
  id: string;
  name: string;
  nameAr?: string | null;
  slug: string;
  icon?: string | null;
  productCount: number;
};

interface CategoryFilterBarProps {
  categories: CategoryFilterItem[];
  selectedCategoryId?: string | null;
  totalAssigned: number;
  activeBadge?: string | null;
  searchQuery?: string | null;
}

export function CategoryFilterBar({
  categories,
  selectedCategoryId,
  totalAssigned,
  activeBadge,
  searchQuery,
}: CategoryFilterBarProps) {
  const router = useRouter();
  const { dict, dir, locale } = useI18n();
  const t = dict.partnerPortal.catalogue;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Helper to build URLs preserving other active filters
  const getFilterUrl = useCallback(
    (catId: string | null) => {
      const sp = new URLSearchParams();
      if (catId) sp.set("category", catId);
      if (activeBadge) sp.set("badge", activeBadge);
      if (searchQuery) sp.set("q", searchQuery);
      const q = sp.toString();
      return q ? `/catalogue?${q}` : "/catalogue";
    },
    [activeBadge, searchQuery],
  );

  // Check scroll positions to enable/disable arrow buttons
  const updateScrollButtons = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    // In RTL, scrollLeft can be negative or inverted depending on browser engine
    if (dir === "rtl") {
      const maxScroll = scrollWidth - clientWidth;
      const absScroll = Math.abs(scrollLeft);
      setCanScrollLeft(absScroll < maxScroll - 4);
      setCanScrollRight(absScroll > 4);
    } else {
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
    }
  }, [dir]);

  useEffect(() => {
    updateScrollButtons();
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleResize = () => updateScrollButtons();
    window.addEventListener("resize", handleResize);

    // Mouse wheel horizontal scrolling helper for desktop users
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0 && !e.shiftKey) {
        // If user is vertically scrolling over the category bar, translate to horizontal
        if (el.scrollWidth > el.clientWidth) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
          updateScrollButtons();
        }
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("resize", handleResize);
      el.removeEventListener("wheel", handleWheel);
    };
  }, [updateScrollButtons]);

  const handleScroll = (direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const scrollAmount = 240;
    const factor = direction === "right" ? 1 : -1;
    const finalAmount = dir === "rtl" ? -factor * scrollAmount : factor * scrollAmount;

    el.scrollBy({ left: finalAmount, behavior: "smooth" });
    setTimeout(updateScrollButtons, 300);
  };

  // Find currently active category (matching by id or slug)
  const activeCategory = categories.find(
    (c) => c.id === selectedCategoryId || c.slug === selectedCategoryId,
  );
  const activeValue = activeCategory ? activeCategory.id : "";

  return (
    <div className="space-y-2.5 border-b pb-3.5">
      {/* Mobile Category Dropdown Selector (visible on mobile / small screens for fast 1-tap switching) */}
      <div className="block sm:hidden">
        <label htmlFor="mobile-category-select" className="text-xs font-medium text-muted-foreground mb-1 block">
          {locale === "ar" ? "تصفح حسب التصنيف :" : locale === "en" ? "Filter by category:" : "Filtrer par catégorie :"}
        </label>
        <NativeSelect
          id="mobile-category-select"
          value={activeValue}
          onChange={(e) => {
            const val = e.target.value;
            router.push(getFilterUrl(val || null));
          }}
          className="w-full bg-card"
        >
          <option value="">
            {dict.products.allCategories} ({totalAssigned})
          </option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name} {cat.nameAr ? `(${cat.nameAr})` : ""} — {cat.productCount}
            </option>
          ))}
        </NativeSelect>
      </div>

      {/* Horizontal Category Selector with Left / Right Scroll Controls */}
      <div className="relative group/cats">
        {/* Left Arrow Button */}
        {canScrollLeft && (
          <div
            className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 flex items-center pr-2 ${
              dir === "rtl" ? "right-0 left-auto pl-2 pr-0" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => handleScroll("left")}
              className="h-8 w-8 rounded-full bg-background/95 border border-border shadow-md flex items-center justify-center text-foreground hover:bg-muted hover:border-primary/50 transition-all hover:scale-105 active:scale-95"
              aria-label="Défiler vers la gauche"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          onScroll={updateScrollButtons}
          className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-none scroll-smooth px-1"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {/* "All Categories" Tab */}
          <Link
            href={getFilterUrl(null)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all shrink-0 ${
              !selectedCategoryId
                ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs ring-1 ring-primary"
                : "border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Package className="h-4 w-4" />
            <span>{dict.products.allCategories}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                !selectedCategoryId
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {totalAssigned}
            </span>
          </Link>

          {/* Individual Category Tabs */}
          {categories.map((category) => {
            const isSelected =
              Boolean(selectedCategoryId) &&
              (selectedCategoryId === category.id || selectedCategoryId === category.slug);

            const IconComponent =
              (category.icon && CATEGORY_ICONS[category.icon]) || Package;

            return (
              <Link
                key={category.id}
                href={getFilterUrl(isSelected ? null : category.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all shrink-0 select-none ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary font-semibold ring-2 ring-primary shadow-xs"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                } ${category.productCount === 0 ? "opacity-75" : ""}`}
              >
                <IconComponent className="h-4 w-4 shrink-0 text-primary" />
                <span className="whitespace-nowrap">{category.name}</span>
                {category.nameAr && (
                  <span dir="rtl" className="text-[11px] opacity-75 font-arabic whitespace-nowrap">
                    ({category.nameAr})
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {category.productCount}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Right Arrow Button */}
        {canScrollRight && (
          <div
            className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 flex items-center pl-2 ${
              dir === "rtl" ? "left-0 right-auto pr-2 pl-0" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => handleScroll("right")}
              className="h-8 w-8 rounded-full bg-background/95 border border-border shadow-md flex items-center justify-center text-foreground hover:bg-muted hover:border-primary/50 transition-all hover:scale-105 active:scale-95"
              aria-label="Défiler vers la droite"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
