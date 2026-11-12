"use client";

import { useAuthLanguage } from "./auth-language-context";
import {
  Users,
  CheckCircle2,
  Clock,
  UserCheck,
  PackageCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function RegisterHeroVisual() {
  const { t, isRtl } = useAuthLanguage();

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={cn("w-full max-w-lg space-y-8 text-white", isRtl ? "text-right" : "text-left")}
    >
      {/* Category Pill */}
      <div className={cn("flex", isRtl ? "justify-start" : "justify-start")}>
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-950/50 px-3.5 py-1 text-xs font-medium text-blue-300 backdrop-blur-md">
          <Users className="h-3.5 w-3.5 text-blue-400" />
          <span>{t.hero.registerBadge}</span>
        </div>
      </div>

      {/* Hero Headline & Subtitle */}
      <div className="space-y-3">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white leading-tight">
          {t.hero.registerTitle}
        </h2>
        <p className="text-sm text-slate-300/90 leading-relaxed max-w-md">
          {t.hero.registerSubtitle}
        </p>
      </div>

      {/* Visual Component: Partner Onboarding & Program Steps */}
      <div className="relative rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl shadow-2xl glow-border-brand">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4 text-xs text-slate-400">
          <span className="font-semibold text-white">{t.hero.onboardingProcess}</span>
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/20">
            <Clock className="h-3 w-3" />
            {t.hero.verificationRequired}
          </span>
        </div>

        {/* 3 Step Timeline */}
        <div className="space-y-3 text-xs">
          <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-white">{t.hero.step1Title}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{t.hero.step1Desc}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-white">{t.hero.step2Title}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{t.hero.step2Desc}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <PackageCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-white">{t.hero.step3Title}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{t.hero.step3Desc}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Verified Bullet Points */}
      <div className="space-y-2.5 pt-2">
        {t.hero.registerPoints.map((point, idx) => (
          <div key={idx} className="flex items-center gap-3 text-xs text-slate-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{point}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
