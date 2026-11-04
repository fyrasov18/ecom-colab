"use client";

import { useAuthLanguage } from "./auth-language-context";
import { type AuthLang } from "./auth-i18n";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS: { id: AuthLang; label: string; ariaLabel: string }[] = [
  { id: "fr", label: "FR", ariaLabel: "Passer en Français" },
  { id: "ar", label: "عربي", ariaLabel: "التحويل إلى العربية" },
  { id: "en", label: "EN", ariaLabel: "Switch to English" },
];

export function AuthLanguageToggle({ className }: { className?: string }) {
  const { lang, setLang, mounted } = useAuthLanguage();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border/80 bg-card/95 p-1 text-xs shadow-soft backdrop-blur-md",
        className
      )}
      role="group"
      aria-label="Language selection"
    >
      <div className="flex h-6 w-6 items-center justify-center text-muted-foreground" aria-hidden="true">
        <Globe className="h-3.5 w-3.5" />
      </div>
      <div className="flex items-center gap-0.5">
        {OPTIONS.map((opt) => {
          const isActive = mounted ? lang === opt.id : opt.id === "fr";
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setLang(opt.id)}
              aria-label={opt.ariaLabel}
              aria-pressed={isActive}
              className={cn(
                "cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
