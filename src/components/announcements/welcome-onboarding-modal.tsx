"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Package,
  Megaphone,
  Handshake,
  TrendingUp,
  Target,
  X,
} from "lucide-react";
import { CelebrationConfetti } from "./confetti";
import { cn } from "@/lib/utils";

export interface WelcomeOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAction: () => void;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  badgeText?: string;
  bannerText?: string;
  themeColor?: string;
  isClosing?: boolean;
  isPreview?: boolean;
}

const THEME_BUTTON_STYLES: Record<string, string> = {
  purple:
    "bg-[#6D28D9] hover:bg-[#5B21B6] active:bg-[#4C1D95] dark:bg-[#7C3AED] dark:hover:bg-[#6D28D9] shadow-purple-600/25 hover:shadow-purple-600/35 focus-visible:ring-purple-500",
  indigo:
    "bg-[#4F46E5] hover:bg-[#4338CA] active:bg-[#3730A3] dark:bg-[#6366F1] dark:hover:bg-[#4F46E5] shadow-indigo-600/25 hover:shadow-indigo-600/35 focus-visible:ring-indigo-500",
  emerald:
    "bg-[#10B981] hover:bg-[#059669] active:bg-[#047857] dark:bg-[#10B981] dark:hover:bg-[#059669] shadow-emerald-600/25 hover:shadow-emerald-600/35 focus-visible:ring-emerald-500",
  blue:
    "bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] dark:bg-[#3B82F6] dark:hover:bg-[#2563EB] shadow-blue-600/25 hover:shadow-blue-600/35 focus-visible:ring-blue-500",
  amber:
    "bg-[#D97706] hover:bg-[#B45309] active:bg-[#92400E] dark:bg-[#F59E0B] dark:hover:bg-[#D97706] shadow-amber-600/25 hover:shadow-amber-600/35 focus-visible:ring-amber-500",
  rose:
    "bg-[#E11D48] hover:bg-[#BE123C] active:bg-[#9F1239] dark:bg-[#F43F5E] dark:hover:bg-[#E11D48] shadow-rose-600/25 hover:shadow-rose-600/35 focus-visible:ring-rose-500",
};

const THEME_BANNER_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  purple: {
    bg: "bg-[#EDE9FE] dark:bg-purple-950/50",
    text: "text-[#6D28D9] dark:text-purple-300",
    border: "border-purple-200/80 dark:border-purple-800/60",
  },
  indigo: {
    bg: "bg-indigo-50 dark:bg-indigo-950/50",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-200/80 dark:border-indigo-800/60",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-950/50",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200/80 dark:border-emerald-800/60",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-950/50",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200/80 dark:border-blue-800/60",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-950/50",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-200/80 dark:border-amber-800/60",
  },
  rose: {
    bg: "bg-rose-50 dark:bg-rose-950/50",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200/80 dark:border-rose-800/60",
  },
};

const emptySubscribe = () => () => {};

export function WelcomeOnboardingModal({
  isOpen,
  onClose,
  onAction,
  title,
  subtitle,
  buttonText,
  badgeText,
  bannerText,
  themeColor = "purple",
  isClosing = false,
  isPreview = false,
}: WelcomeOnboardingModalProps) {
  const isClient = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!isOpen || !isClient) return null;

  // Resolve content dynamically from props with defaults matching the visual reference
  const resolvedTitle =
    title && title.trim().length > 0 ? title.trim() : "Bienvenue chez Ecom Partner ! 🎉";

  const resolvedSubtitle =
    subtitle && subtitle.trim().length > 0
      ? subtitle.trim()
      : "Votre compte partenaire a été validé avec succès. Félicitations !";

  const resolvedButtonText =
    buttonText && buttonText.trim().length > 0
      ? buttonText.trim()
      : "On est ensemble ! 🚀";

  const resolvedBannerText =
    bannerText && bannerText.trim().length > 0
      ? bannerText.trim()
      : badgeText &&
        badgeText.trim().length > 0 &&
        badgeText !== "Compte partenaire activé" &&
        badgeText !== "Compte validé"
      ? badgeText.trim()
      : "🚀 Bien plus qu’une simple plateforme de dropshipping !";

  const bannerTheme =
    (themeColor && THEME_BANNER_STYLES[themeColor]) || THEME_BANNER_STYLES.purple;

  const buttonThemeClass =
    (themeColor && THEME_BUTTON_STYLES[themeColor]) || THEME_BUTTON_STYLES.purple;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 lg:p-6 transition-opacity duration-200",
        isClosing ? "opacity-0" : "opacity-100"
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-onboarding-title"
      aria-describedby="welcome-onboarding-desc"
    >
      {/* Dynamic Celebration Confetti on Open (plays once for 3.5s) */}
      {!isPreview && <CelebrationConfetti duration={3500} />}

      {/* Backdrop with dark blur */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        className={cn(
          "relative z-10 w-full max-w-[680px] max-h-[92vh] overflow-y-auto transform rounded-3xl sm:rounded-[32px] border border-purple-100/80 dark:border-purple-900/40 bg-white dark:bg-slate-900 p-5 sm:p-8 shadow-2xl shadow-purple-950/20 transition-all duration-200",
          isClosing ? "scale-95 opacity-0" : "scale-100 opacity-100 animate-in fade-in zoom-in-95"
        )}
      >
        {/* Top Right Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 sm:right-6 sm:top-6 rounded-full p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* ── Top Festive Sprinkle & Green Checkmark ── */}
        <div className="relative flex flex-col items-center pt-1 text-center">
          {/* Festive Confetti Graphic Sprinkles (precisely matching reference image) */}
          <div className="relative mb-3 flex items-center justify-center">
            {/* 360-degree Festive Confetti Cluster */}
            <div className="pointer-events-none absolute inset-x-[-90px] inset-y-[-24px] sm:inset-x-[-110px] sm:inset-y-[-28px]" aria-hidden="true">
              {/* Top Row Sprinkles */}
              <span className="absolute top-0 left-[26%] h-2.5 w-1 rounded-full bg-amber-400 -rotate-45" />
              <span className="absolute top-1 left-[34%] h-1.5 w-1.5 rounded-full bg-sky-400" />
              <span className="absolute top-2 left-[44%] h-2 w-1 rounded-full bg-rose-400 rotate-12" />
              <span className="absolute top-1 right-[44%] h-1.5 w-1.5 rounded-full bg-purple-500" />
              <span className="absolute top-0 right-[34%] h-2.5 w-1 rounded-full bg-rose-400 rotate-45" />
              <span className="absolute top-2 right-[25%] h-1.5 w-1.5 rounded-full bg-sky-400" />

              {/* Left Side Sprinkles */}
              <span className="absolute top-6 left-[16%] sm:left-[18%] h-2 w-2 rounded-full bg-amber-400" />
              <span className="absolute top-10 left-[10%] sm:left-[12%] h-1.5 w-3 rounded-full bg-purple-500 rotate-12" />
              <span className="absolute top-16 left-[14%] sm:left-[16%] h-2.5 w-1 rounded-full bg-rose-400 -rotate-45" />
              <span className="absolute bottom-3 left-[20%] sm:left-[22%] h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="absolute bottom-1 left-[28%] sm:left-[30%] h-1.5 w-2.5 rounded-sm bg-sky-400 rotate-12" />

              {/* Right Side Sprinkles */}
              <span className="absolute top-5 right-[16%] sm:right-[18%] h-2.5 w-1 rounded-full bg-amber-400 -rotate-12" />
              <span className="absolute top-11 right-[11%] sm:right-[13%] h-2 w-2 rounded-full bg-rose-400" />
              <span className="absolute top-16 right-[15%] sm:right-[17%] h-1.5 w-3 rounded-full bg-sky-400 rotate-45" />
              <span className="absolute bottom-4 right-[20%] sm:right-[22%] h-2 w-2 rounded-full bg-amber-400" />
              <span className="absolute bottom-1 right-[28%] sm:right-[30%] h-1.5 w-1.5 rounded-full bg-purple-400" />
            </div>

            {/* Center Green Success Badge */}
            <div className="relative z-1 flex h-16 w-16 sm:h-18 sm:w-18 items-center justify-center rounded-full bg-[#10B981] text-white shadow-xl shadow-emerald-500/25 ring-8 ring-emerald-50 dark:ring-emerald-950/40">
              <Check className="h-9 w-9 sm:h-10 sm:w-10 stroke-[3.5]" />
            </div>
          </div>

          {/* Headline */}
          <h2
            id="welcome-onboarding-title"
            className="text-xl sm:text-2xl lg:text-[26px] font-black tracking-tight text-slate-900 dark:text-white"
          >
            {resolvedTitle}
          </h2>

          {/* Subtitle */}
          <p
            id="welcome-onboarding-desc"
            className="mt-1.5 max-w-md text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed"
          >
            {resolvedSubtitle}
          </p>

          {/* ── Highlighted Banner (dynamically configurable) ── */}
          <div
            className={cn(
              "mt-4 sm:mt-5 w-full rounded-2xl border py-2.5 sm:py-3 px-4 text-center transition-colors",
              bannerTheme.bg,
              bannerTheme.border
            )}
          >
            <p className={cn("text-xs sm:text-sm font-bold tracking-tight", bannerTheme.text)}>
              {resolvedBannerText}
            </p>
          </div>
        </div>

        {/* ── Section Header ── */}
        <div className="mt-4 sm:mt-5">
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 text-left">
            Avec Ecom Partner, vous bénéficiez de :
          </h3>

          {/* ── 2x2 Benefits Grid (1-col on mobile, 2-col on desktop) ── */}
          <div className="mt-2.5 sm:mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {/* Card 1: Produits sélectionnés et testés */}
            <div className="flex items-start sm:items-center gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 p-3 sm:p-3.5 transition-colors hover:border-purple-200 dark:hover:border-purple-800/60">
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Package className="h-5 w-5" />
              </div>
              <div className="text-xs sm:text-[13px] leading-snug">
                <span className="font-bold text-slate-900 dark:text-slate-100 block sm:inline">
                  Un catalogue exclusif{" "}
                </span>
                <span className="text-slate-600 dark:text-slate-300">
                  de produits sélectionnés et testés.
                </span>
              </div>
            </div>

            {/* Card 2: Kits marketing prêts à l'emploi */}
            <div className="flex items-start sm:items-center gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 p-3 sm:p-3.5 transition-colors hover:border-purple-200 dark:hover:border-purple-800/60">
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                <Megaphone className="h-5 w-5" />
              </div>
              <div className="text-xs sm:text-[13px] leading-snug">
                <span className="font-bold text-slate-900 dark:text-slate-100 block sm:inline">
                  Un kit marketing prêt{" "}
                </span>
                <span className="text-slate-600 dark:text-slate-300">
                  à l&apos;emploi avec chaque produit.
                </span>
              </div>
            </div>

            {/* Card 3: Accompagnement à chaque étape */}
            <div className="flex items-start sm:items-center gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 p-3 sm:p-3.5 transition-colors hover:border-purple-200 dark:hover:border-purple-800/60">
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <Handshake className="h-5 w-5" />
              </div>
              <div className="text-xs sm:text-[13px] leading-snug">
                <span className="font-bold text-slate-900 dark:text-slate-100 block sm:inline">
                  Un accompagnement{" "}
                </span>
                <span className="text-slate-600 dark:text-slate-300">
                  à chaque étape de votre parcours commercial.
                </span>
              </div>
            </div>

            {/* Card 4: Commissions transparentes */}
            <div className="flex items-start sm:items-center gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 p-3 sm:p-3.5 transition-colors hover:border-purple-200 dark:hover:border-purple-800/60">
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="text-xs sm:text-[13px] leading-snug">
                <span className="font-bold text-slate-900 dark:text-slate-100 block sm:inline">
                  Un système de commission{" "}
                </span>
                <span className="text-slate-600 dark:text-slate-300">
                  transparent.
                </span>
              </div>
            </div>
          </div>

          {/* ── Highlighted Mission Section ── */}
          <div className="mt-3 sm:mt-3.5 flex items-center gap-3 rounded-2xl border border-purple-200/80 dark:border-purple-800/60 bg-[#EDE9FE]/70 dark:bg-purple-950/40 p-3 sm:p-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shadow-xs">
              <Target className="h-5 w-5" />
            </div>
            <p className="text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 leading-snug">
              <strong className="font-bold text-slate-900 dark:text-white">
                Notre mission :
              </strong>{" "}
              vous fournir les produits, les outils et le soutien nécessaires pour développer votre activité en ligne.
            </p>
          </div>
        </div>

        {/* ── Prominent CTA Button (dynamically configurable text & theme) ── */}
        <div className="mt-5 sm:mt-6">
          <button
            type="button"
            onClick={onAction}
            className={cn(
              "w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 sm:py-4 px-6 text-sm sm:text-base font-bold text-white shadow-lg transition-all duration-200 hover:scale-[1.008] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2",
              buttonThemeClass
            )}
          >
            <span>{resolvedButtonText}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
