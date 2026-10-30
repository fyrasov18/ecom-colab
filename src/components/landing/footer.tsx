"use client";

import Link from "next/link";
import { ArrowUp, Heart, Shield, Lock } from "lucide-react";

export function LandingFooter() {
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <footer className="relative bg-slate-950 text-slate-400 border-t border-white/[0.08] overflow-hidden">
      {/* Ambient bottom light */}
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 -z-0 h-40 w-full max-w-5xl opacity-20"
        style={{
          background: "radial-gradient(ellipse at bottom, rgba(37, 99, 235, 0.5) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 z-10">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          {/* Brand info column (2 spans) */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{
                  background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
                  boxShadow: "0 0 16px rgba(37,99,235,0.4)",
                }}
              >
                E
              </div>
              <span className="text-base font-bold tracking-tight text-white">
                E-COM COLAB
              </span>
            </Link>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Plateforme collaborative d&apos;e-commerce et d&apos;affiliation en Tunisie.
              Nous réunissons les marques et les meilleurs vendeurs en ligne pour générer
              de la croissance rentable et pérenne.
            </p>
          </div>

          {/* Nav links columns */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
              Espace Partenaire
            </h4>
            <ul className="mt-4 space-y-2.5 text-xs">
              <li>
                <Link href="/register" className="hover:text-white transition-colors">
                  Créer un compte
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Connexion à l&apos;espace
                </Link>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  Catalogue &amp; Produits
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-white transition-colors">
                  Grille des commissions
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
              Fournisseurs
            </h4>
            <ul className="mt-4 space-y-2.5 text-xs">
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  Catalogue &amp; Produits
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-white transition-colors">
                  Modèle de collaboration
                </a>
              </li>
              <li>
                <a href="#cta" className="hover:text-white transition-colors">
                  Rejoindre la plateforme
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
              Sécurité &amp; Légal
            </h4>
            <ul className="mt-4 space-y-2.5 text-xs">
              <li className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-slate-400" />
                <span>Protection des données</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-slate-400" />
                <span>Transactions chiffrées</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p className="flex items-center gap-1">
            &copy; {new Date().getFullYear()} E-COM COLAB. Fait avec{" "}
            <Heart className="h-3 w-3 text-red-400 inline fill-red-400" /> pour le commerce tunisien.
          </p>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={scrollToTop}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
            >
              Haut de page <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
