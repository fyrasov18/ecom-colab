"use client";

import Link from "next/link";
import { Check, HelpCircle, Wallet, Users2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PricingSection() {
  return (
    <section id="pricing" className="relative py-20 bg-slate-950 text-white border-t border-white/[0.08]">
      {/* Background ambient glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/4 -translate-x-1/2 -z-0 h-96 w-96 rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, rgba(147, 51, 234, 0.4) 0%, transparent 70%)",
          filter: "blur(70px)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 z-10">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center mb-12">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 mb-4">
            <Zap className="h-3.5 w-3.5" />
            Modèle de collaboration
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Une rémunération sur vos ventes,{" "}
            <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
              sans abonnement
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400">
            L&apos;inscription partenaire est gratuite. Vous percevez une commission
            sur chaque vente générée via votre activité sur la plateforme.
            Aucun frais mensuel, aucun engagement annuel.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
          {/* Card 1: Inscription */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 backdrop-blur-xl flex flex-col justify-between transition-all duration-300 hover:border-white/20">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 mb-6">
                <Zap className="h-6 w-6" />
              </div>
              <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                1. Inscription
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                Gratuite et sans engagement
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Créez votre compte partenaire. Votre demande est ensuite
                soumise à validation administrative avant activation.
              </p>

              <ul className="space-y-3 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  Aucun frais d&apos;inscription
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  Aucun abonnement mensuel
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  Validation par l&apos;équipe admin
                </li>
              </ul>
            </div>

            <Button
              asChild
              size="lg"
              className="mt-auto w-full h-12 text-base font-semibold shadow-xl"
              style={{
                background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
                boxShadow: "0 6px 24px rgba(37,99,235,0.45)",
              }}
            >
              <Link href="/register">
                Créer mon compte
              </Link>
            </Button>
          </div>

          {/* Card 2: Rémunération */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 backdrop-blur-xl flex flex-col justify-between transition-all duration-300 hover:border-white/20">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 mb-6">
                <Wallet className="h-6 w-6" />
              </div>
              <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                2. Rémunération
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                Commission sur vos ventes
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Vous gagnez un pourcentage sur chaque commande livrée via votre
                activité partenaire. Les commissions sont suivies dans votre
                portefeuille et disponibles pour retrait.
              </p>

              <ul className="space-y-3 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  Commission calculée sur chaque vente
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  Suivi dans votre portefeuille partenaire
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  Retrait sur demande
                </li>
              </ul>
            </div>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="mt-auto w-full h-12 text-base font-medium border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:border-white/30"
            >
              <a href="#how-it-works">
                Voir le processus
              </a>
            </Button>
          </div>

          {/* Card 3: Parrainage */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 backdrop-blur-xl flex flex-col justify-between transition-all duration-300 hover:border-white/20">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 mb-6">
                <Users2 className="h-6 w-6" />
              </div>
              <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                3. Parrainage
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                Gagnez en parrainant
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Invitez d&apos;autres partenaires à rejoindre la plateforme et
                percevez des commissions sur leur activité, sur plusieurs
                niveaux.
              </p>

              <ul className="space-y-3 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  Code d&apos;invitation unique par partenaire
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  Commissions sur plusieurs niveaux
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  Attribution vérifiée et traçable
                </li>
              </ul>
            </div>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="mt-auto w-full h-12 text-base font-medium border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:border-white/30"
            >
              <a href="#features">
                Découvrir les fonctionnalités
              </a>
            </Button>
          </div>
        </div>

        {/* Mini FAQ Section */}
        <div id="faq" className="mt-20 max-w-4xl mx-auto pt-12 border-t border-white/[0.08]">
          <h3 className="text-xl font-bold text-center text-white mb-8 flex items-center justify-center gap-2">
            <HelpCircle className="h-5 w-5 text-blue-400" /> Questions Fréquentes
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="font-semibold text-white">Combien coûte l&apos;inscription ?</h4>
              <p className="mt-2 text-slate-400 leading-relaxed">
                L&apos;inscription partenaire est gratuite. Aucun frais mensuel ni
                abonnement n&apos;est requis.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="font-semibold text-white">Comment suis-je rémunéré ?</h4>
              <p className="mt-2 text-slate-400 leading-relaxed">
                Vous percevez une commission sur chaque commande livrée via
                votre activité partenaire. Les commissions sont suivies dans
                votre portefeuille et disponibles pour retrait.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="font-semibold text-white">Dois-je gérer le stock ou la livraison ?</h4>
              <p className="mt-2 text-slate-400 leading-relaxed">
                Non. Vous vous concentrez sur la promotion des produits.
                L&apos;expédition et la logistique sont gérées par les partenaires
                logistiques de la plateforme.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="font-semibold text-white">Comment fonctionne le parrainage ?</h4>
              <p className="mt-2 text-slate-400 leading-relaxed">
                Chaque partenaire dispose d&apos;un code d&apos;invitation unique.
                Lorsqu&apos;un nouveau membre s&apos;inscrit via votre code, vous
                percevez des commissions sur son activité, sur plusieurs
                niveaux.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
