"use client";

import React from "react";
import { useAuthLanguage } from "./auth-language-context";
import {
  Boxes,
  Truck,
  Wallet,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_AUTH_MARKETING_FR,
  DEFAULT_AUTH_PAGES_DESIGN,
  type AuthMarketingContent,
  type AuthPagesDesign,
} from "@/modules/branding/defaults";

interface AuthMarketingShowcaseProps {
  pageType: "login" | "register";
  authDesign?: AuthPagesDesign;
  forcedLang?: "fr" | "ar" | "en";
}

export function AuthMarketingShowcase({
  pageType,
  authDesign = DEFAULT_AUTH_PAGES_DESIGN,
  forcedLang,
}: AuthMarketingShowcaseProps) {
  const { lang: contextLang, isRtl: contextIsRtl } = useAuthLanguage();
  const currentLang = forcedLang || contextLang || "fr";
  const isRtl = forcedLang ? forcedLang === "ar" : contextIsRtl;

  const content: AuthMarketingContent =
    authDesign.content[currentLang] ||
    authDesign.content.fr ||
    DEFAULT_AUTH_MARKETING_FR;

  const badgeText = pageType === "login" ? content.loginBadge : content.registerBadge;
  const headline = pageType === "login" ? content.loginHeadline : content.registerHeadline;
  const subtitle = pageType === "login" ? content.loginSubtitle : content.registerSubtitle;

  const primaryColor = authDesign.colors.primaryColor || "#10B981";
  const accentColor = authDesign.colors.accentColor || "#A3E635";

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={cn(
        "w-full max-w-xl space-y-7 text-white select-none",
        isRtl ? "text-right" : "text-left"
      )}
    >
      {/* Category Pill / Badge */}
      <div className={cn("flex", isRtl ? "justify-start" : "justify-start")}>
        <div
          className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold backdrop-blur-md transition-all shadow-sm"
          style={{
            borderColor: `${primaryColor}40`,
            backgroundColor: `${primaryColor}15`,
            color: accentColor,
          }}
        >
          <Sparkles className="h-3.5 w-3.5" style={{ color: accentColor }} />
          <span>{badgeText}</span>
        </div>
      </div>

      {/* Hero Headline & Subtitle */}
      <div className="space-y-3">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white leading-[1.2]">
          {headline}
        </h2>
        <p className="text-sm text-slate-300/90 leading-relaxed max-w-lg">
          {subtitle}
        </p>
      </div>

      {/* Platform Mockup Card */}
      {authDesign.layout.showPlatformMockup && (
        <div
          className="relative rounded-2xl border border-white/10 bg-slate-900/70 p-5 backdrop-blur-xl shadow-2xl transition-all"
          style={{
            boxShadow: `0 20px 40px -15px ${primaryColor}20`,
          }}
        >
          {/* Top Mock Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: primaryColor }}
                />
                <span
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{ backgroundColor: primaryColor }}
                />
              </span>
              <span className="font-mono text-[11px] text-slate-300">app.ecompartner.tn</span>
            </div>
            <div
              className="flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-white/10"
              style={{ color: primaryColor }}
            >
              <Activity className="h-3 w-3" />
              <span>COD Live Sync</span>
            </div>
          </div>

          {/* Key Metrics / Trust Stats */}
          {authDesign.layout.showTrustBadges && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
                <p className="text-2xl font-black tracking-tight" style={{ color: accentColor }}>
                  {content.trustStat1Value}
                </p>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                  {content.trustStat1Label}
                </p>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
                <p className="text-2xl font-black tracking-tight" style={{ color: primaryColor }}>
                  {content.trustStat2Value}
                </p>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                  {content.trustStat2Label}
                </p>
              </div>
            </div>
          )}

          {/* 3 Operational Feature Pillars */}
          {authDesign.layout.showFeatureCards && (
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.05]">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                  style={{
                    backgroundColor: `${primaryColor}15`,
                    borderColor: `${primaryColor}30`,
                    color: primaryColor,
                  }}
                >
                  <Boxes className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{content.feature1Title}</p>
                  <p className="text-[11px] text-slate-400 line-clamp-1">{content.feature1Desc}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.05]">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                  style={{
                    backgroundColor: "#3B82F615",
                    borderColor: "#3B82F630",
                    color: "#60A5FA",
                  }}
                >
                  <Truck className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{content.feature2Title}</p>
                  <p className="text-[11px] text-slate-400 line-clamp-1">{content.feature2Desc}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.05]">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                  style={{
                    backgroundColor: "#14B8A615",
                    borderColor: "#14B8A630",
                    color: "#2DD4BF",
                  }}
                >
                  <Wallet className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{content.feature3Title}</p>
                  <p className="text-[11px] text-slate-400 line-clamp-1">{content.feature3Desc}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trust Signoff Pills */}
      {authDesign.layout.showTrustBadges && (
        <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-300">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: primaryColor }} />
            <span>Paiements hebdomadaires garantis</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />
            <span>Confirmation d&apos;appels qualifiée</span>
          </div>
        </div>
      )}
    </div>
  );
}
