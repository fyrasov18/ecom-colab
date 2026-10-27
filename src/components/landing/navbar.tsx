"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white transition-transform duration-200 group-hover:scale-105"
            style={{
              background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
              boxShadow: "0 0 20px rgba(37,99,235,0.45)",
            }}
          >
            E
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              E-COM COLAB
              <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400 border border-blue-500/20">
                PRO
              </span>
            </span>
            <span className="text-[10px] text-slate-400 -mt-0.5">
              Plateforme Partenaire
            </span>
          </div>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          <a
            href="#features"
            className="transition-colors hover:text-white"
          >
            Fonctionnalités
          </a>
          <a
            href="#demo"
            className="transition-colors hover:text-white"
          >
            Aperçu
          </a>
          <a
            href="#pricing"
            className="transition-colors hover:text-white"
          >
            Tarifs
          </a>
          <a
            href="#faq"
            className="transition-colors hover:text-white"
          >
            FAQ
          </a>
        </nav>

        {/* Desktop actions */}
        <div className="hidden sm:flex items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white hover:bg-white/05"
          >
            <Link href="/login">Connexion</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="relative overflow-hidden font-semibold text-white shadow-lg transition-transform active:scale-95"
            style={{
              background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
              boxShadow: "0 4px 16px rgba(37, 99, 235, 0.35)",
            }}
          >
            <Link href="/register">
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-blue-200" />
              Rejoindre
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
              Fonctionnalités
            </a>
            <a
              href="#demo"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-sm hover:bg-white/05 hover:text-white"
            >
              Aperçu en direct
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-sm hover:bg-white/05 hover:text-white"
            >
              Tarifs
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-sm hover:bg-white/05 hover:text-white"
            >
              FAQ
            </a>
            <div className="mt-3 flex flex-col gap-2 pt-3 border-t border-white/[0.08]">
              <Button asChild variant="outline" className="w-full border-white/10 text-white bg-white/05">
                <Link href="/login">Connexion à l&apos;espace</Link>
              </Button>
              <Button asChild className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium">
                <Link href="/register">Créer un compte partenaire</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
