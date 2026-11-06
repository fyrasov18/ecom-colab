"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  variant?: "ghost" | "outline";
}

const subscribeTheme = (callback: () => void) => {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  window.addEventListener("storage", callback);
  return () => {
    observer.disconnect();
    window.removeEventListener("storage", callback);
  };
};

const getThemeSnapshot = () => document.documentElement.classList.contains("dark");
const getServerThemeSnapshot = () => false;

const emptySubscribe = () => () => {};
const getMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

export function ThemeToggle({ className, variant = "ghost" }: ThemeToggleProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    getMountedSnapshot,
    getServerMountedSnapshot,
  );
  const isDark = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  const toggleTheme = () => {
    const nextDark = !document.documentElement.classList.contains("dark");

    if (nextDark) {
      document.documentElement.classList.add("dark");
      try {
        localStorage.setItem("theme", "dark");
      } catch {
        // Ignore localStorage quota/security errors
      }
    } else {
      document.documentElement.classList.remove("dark");
      try {
        localStorage.setItem("theme", "light");
      } catch {
        // Ignore localStorage quota/security errors
      }
    }
  };

  // Render neutral placeholder skeleton before mount to prevent hydration mismatch
  if (!mounted) {
    return (
      <div
        className={cn(
          "h-8 w-8 rounded-md",
          variant === "outline" ? "border border-border bg-card" : "bg-transparent",
          className,
        )}
        aria-hidden="true"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
        variant === "outline" && "border border-border bg-card shadow-soft",
        className,
      )}
      aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
      title={isDark ? "Mode clair" : "Mode sombre"}
    >
      {isDark ? (
        <Sun className="h-4 w-4 transition-transform duration-200 rotate-0 hover:rotate-45 text-amber-400" />
      ) : (
        <Moon className="h-4 w-4 transition-transform duration-200 rotate-0 hover:-rotate-12 text-slate-700 dark:text-slate-300" />
      )}
      <span className="sr-only">
        {isDark ? "Passer en mode clair" : "Passer en mode sombre"}
      </span>
    </button>
  );
}
