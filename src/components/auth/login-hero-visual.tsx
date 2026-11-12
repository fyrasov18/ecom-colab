"use client";

import { useAuthLanguage } from "./auth-language-context";
import {
  ShieldCheck,
  Boxes,
  Truck,
  Wallet,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function LoginHeroVisual() {
  const { t, isRtl } = useAuthLanguage();

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={cn("w-full max-w-lg space-y-8 text-white", isRtl ? "text-right" : "text-left")}
    >
      {/* Category Pill */}
      <div className={cn("flex", isRtl ? "justify-start" : "justify-start")}>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/50 px-3.5 py-1 text-xs font-medium text-emerald-300 backdrop-blur-md">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>{t.hero.loginBadge}</span>
        </div>
      </div>

      {/* Hero Headline & Subtitle */}
      <div className="space-y-3">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white leading-tight">
          {t.hero.loginTitle}
        </h2>
        <p className="text-sm text-slate-300/90 leading-relaxed max-w-md">
          {t.hero.loginSubtitle}
        </p>
      </div>

      {/* Visual Component: Platform Capabilities Card */}
      <div className="relative rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl shadow-2xl glow-border-brand">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80 inline-block" />
            <span className="font-mono text-[11px] text-slate-300">app.ecompartner.tn</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
            <Lock className="h-3 w-3" />
            <span>{t.hero.authenticatedAccess}</span>
          </div>
        </div>

        {/* 3 Verified Operational Pillars */}
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Boxes className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-white">{t.hero.catalogTitle}</p>
                <p className="text-[11px] text-slate-400">{t.hero.catalogDesc}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Truck className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-white">{t.hero.ordersTitle}</p>
                <p className="text-[11px] text-slate-400">{t.hero.ordersDesc}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-white">{t.hero.walletTitle}</p>
                <p className="text-[11px] text-slate-400">{t.hero.walletDesc}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Verified Bullet Points */}
      <div className="space-y-2.5 pt-2">
        {t.hero.loginPoints.map((point, idx) => (
          <div key={idx} className="flex items-center gap-3 text-xs text-slate-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{point}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
