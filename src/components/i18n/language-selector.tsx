"use client";

import { useState, useRef, useEffect } from "react";
import { useI18n, LOCALES, LOCALE_INFOS, type Locale } from "@/lib/i18n";
import { Globe, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface LanguageSelectorProps {
  className?: string;
  variant?: "ghost" | "outline" | "compact";
  showLabel?: boolean;
}

export function LanguageSelector({
  className,
  variant = "ghost",
  showLabel = true,
}: LanguageSelectorProps) {
  const { locale, setLocale, isRtl } = useI18n();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const current = LOCALE_INFOS[locale];

  return (
    <div className={cn("relative inline-block text-left", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          variant === "outline"
            ? "border border-border bg-card hover:bg-muted text-foreground shadow-2xs"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Changer de langue"
        title="Changer de langue / Change language / تغيير اللغة"
      >
        <span className="text-sm leading-none" role="img" aria-label={current.label}>
          {current.flag}
        </span>
        {showLabel && (
          <span className="font-semibold tracking-wide uppercase text-[11px]">
            {current.code}
          </span>
        )}
        <ChevronDown className={cn("h-3 w-3 opacity-60 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1.5 w-44 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl backdrop-blur-md animate-in fade-in-0 zoom-in-95",
            isRtl ? "left-0" : "right-0",
          )}
          role="menu"
          aria-orientation="vertical"
        >
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/50 mb-1 flex items-center gap-1.5">
            <Globe className="h-3 w-3" />
            <span>Langue / Language / اللغة</span>
          </div>
          {LOCALES.map((loc) => {
            const info = LOCALE_INFOS[loc];
            const isSelected = locale === loc;
            return (
              <button
                key={loc}
                type="button"
                onClick={() => {
                  setLocale(loc);
                  setOpen(false);
                }}
                role="menuitem"
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left",
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm" role="img" aria-hidden="true">
                    {info.flag}
                  </span>
                  <span>{info.nativeLabel}</span>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 shrink-0 stroke-[2.5]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
