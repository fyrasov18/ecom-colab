"use client";

import Link from "next/link";
import {
  ArrowRight,
  TrendingUp,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function HeroSection() {
  const { dict } = useI18n();

  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32 bg-slate-950 text-white">
      {/* Background radial spotlights & grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 bg-grid-agency opacity-60"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -z-0 h-[650px] w-full max-w-7xl rounded-full opacity-35"
        style={{
          background:
            "radial-gradient(circle 500px at 50% 15%, rgba(16, 185, 129, 0.4) 0%, rgba(5, 150, 105, 0.2) 50%, transparent 80%)",
          filter: "blur(70px)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 z-10">
        {/* Top Announcement Pill */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-1.5 text-xs font-medium text-emerald-300 shadow-sm backdrop-blur-md transition-transform hover:scale-105">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white">{dict.landing.newBadge}</span>
            <span>{dict.landing.newBadgeDesc}</span>
            <ArrowRight className="h-3 w-3 text-emerald-400" />
          </div>
        </div>

        {/* Hero Title & Subtitle */}
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            {dict.landing.tagline}{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-lime-300 bg-clip-text text-transparent">
              {dict.landing.taglineGradient}
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-300/90 leading-relaxed max-w-2xl mx-auto">
            {dict.landing.heroDesc}
          </p>

          {/* Action CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto h-12 px-8 text-base font-semibold text-white shadow-xl transition-all duration-200 hover:shadow-blue-500/25 active:scale-95"
              style={{
                background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                boxShadow: "0 6px 24px rgba(16, 185, 129, 0.45)",
              }}
            >
              <Link href="/register">
                <Zap className="mr-2 h-4 w-4 text-emerald-200" />
                {dict.landing.joinPlatform}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full sm:w-auto h-12 px-7 text-base font-medium border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:border-white/30 backdrop-blur-md"
            >
              <a href="#features">{dict.landing.discoverProcess}</a>
            </Button>
          </div>

          {/* Key trust signals (verified against actual capabilities) */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              {dict.landing.noStock}
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              {dict.landing.weeklyPayouts}
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              {dict.landing.verifiedCatalog}
            </span>
          </div>
        </div>

        {/* Live Interactive Dashboard Mockup Card */}
        <div id="demo" className="mt-14 sm:mt-20">
          <div className="relative mx-auto max-w-5xl rounded-2xl border border-white/10 bg-slate-900/60 p-2 sm:p-4 backdrop-blur-2xl shadow-2xl glow-border-brand animate-float-subtle">
            {/* Mockup Top Window Bar */}
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-500/80 inline-block" />
                <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
                <span className="ml-2 hidden sm:inline font-mono text-[11px] text-slate-500">
                  https://app.ecompartner.tn/tableau-de-bord
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  {dict.landing.realtimeActive}
                </span>
              </div>
            </div>

            {/* Dashboard Content Mockup */}
            <div className="p-4 sm:p-6 space-y-6">
              {/* Mini KPIs — illustrative figures only, not real metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{dict.landing.availableBalance}</span>
                    <Wallet className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="mt-2 text-xl sm:text-2xl font-bold text-white">
                    --.-- <span className="text-xs font-normal text-slate-400">DT</span>
                  </div>
                  <p className="mt-1 text-[11px] text-emerald-400 font-medium">
                    {dict.landing.dependsOnActivity}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{dict.landing.deliveryRate}</span>
                    <TrendingUp className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="mt-2 text-xl sm:text-2xl font-bold text-white">
                    --.--%
                  </div>
                  <p className="mt-1 text-[11px] text-blue-400 font-medium">
                    {dict.landing.basedOnOrders}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{dict.landing.inTransit}</span>
                    <Clock className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="mt-2 text-xl sm:text-2xl font-bold text-white">
                    --
                  </div>
                  <p className="mt-1 text-[11px] text-amber-400 font-medium">
                    {dict.landing.trackRealtime}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{dict.landing.referralEarnings}</span>
                    <Sparkles className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="mt-2 text-xl sm:text-2xl font-bold text-white">
                    --.-- <span className="text-xs font-normal text-slate-400">DT</span>
                  </div>
                  <p className="mt-1 text-[11px] text-purple-400 font-medium">
                    {dict.landing.upTo4Levels}
                  </p>
                </div>
              </div>

              {/* Mini Feed Table — illustrative example */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between mb-3 text-xs font-semibold text-slate-300">
                  <span>{dict.landing.orderTrackingExample}</span>
                  <span className="text-blue-400">{dict.landing.simulation}</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 border border-white/05">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-400">#CMD-0001</span>
                      <span className="text-white font-medium">{dict.landing.sampleProduct}</span>
                      <span className="text-slate-400 hidden sm:inline">Tunisie</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                        {dict.statuses.order.IN_DELIVERY}
                      </span>
                      <span className="font-bold text-white">--.-- DT</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
