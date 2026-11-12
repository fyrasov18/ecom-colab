"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { EcomPartnerLogo } from "@/components/brand/logo";
import { useI18n } from "@/lib/i18n";
import { LanguageSelector } from "@/components/i18n/language-selector";

export function LandingNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { dict } = useI18n();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <EcomPartnerLogo variant="compact" theme="dark" />
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20 uppercase tracking-wider hidden sm:inline-flex">
            OS
          </span>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          <a
            href="#features"
            className="transition-colors hover:text-white"
          >
            {dict.landing.features}
          </a>
          <a
            href="#demo"
            className="transition-colors hover:text-white"
          >
            {dict.landing.preview}
          </a>
          <a
            href="#pricing"
            className="transition-colors hover:text-white"
          >
            {dict.landing.pricing}
          </a>
          <a
            href="#faq"
            className="transition-colors hover:text-white"
          >
            {dict.landing.faq}
          </a>
        </nav>

        {/* Desktop actions */}
        <div className="hidden sm:flex items-center gap-3">
          <LanguageSelector
            variant="outline"
            className="border-white/10 text-slate-300"
          />
          <ThemeToggle className="text-slate-300 hover:text-white hover:bg-white/10 border-white/10" />
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white hover:bg-white/05"
          >
            <Link href="/login">{dict.landing.login}</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="relative overflow-hidden font-semibold text-white shadow-lg transition-transform active:scale-95"
            style={{
              background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
              boxShadow: "0 4px 16px rgba(16, 185, 129, 0.35)",
            }}
          >
            <Link href="/register">
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-blue-200" />
              {dict.landing.join}
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-lg p-2 text-slate-400 hover:bg-white/05 hover:text-white md:hidden"
          aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="border-b border-white/[0.08] bg-slate-950/95 px-4 py-5 backdrop-blur-2xl md:hidden">
          <nav className="flex flex-col gap-3 font-medium text-slate-300">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-sm hover:bg-white/05 hover:text-white"
            >
              {dict.landing.features}
            </a>
            <a
              href="#demo"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-sm hover:bg-white/05 hover:text-white"
            >
              {dict.landing.preview}
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-sm hover:bg-white/05 hover:text-white"
            >
              {dict.landing.pricing}
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-sm hover:bg-white/05 hover:text-white"
            >
              {dict.landing.faq}
            </a>
            <div className="mt-3 flex items-center justify-between pb-2">
              <LanguageSelector variant="outline" className="border-white/10 text-slate-300" />
              <ThemeToggle className="text-slate-300 hover:text-white hover:bg-white/10 border-white/10" />
            </div>
            <div className="mt-3 flex flex-col gap-2 pt-3 border-t border-white/[0.08]">
              <Button asChild variant="outline" className="w-full border-white/10 text-white bg-white/05">
                <Link href="/login">{dict.landing.loginSpace}</Link>
              </Button>
              <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
                <Link href="/register">{dict.landing.createPartnerAccount}</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
