"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PricingSection() {
  const [annualBilling, setAnnualBilling] = useState(true);

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
          <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-400 mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Transparence Absolue
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Des formules conçues pour{" "}
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-300 bg-clip-text text-transparent">
              votre rentabilité
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400">
            Commencez sans aucun frais fixe ou accélérez votre croissance avec nos outils premium.
          </p>

          {/* Billing Switch */}
          <div className="mt-8 inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] p-1 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setAnnualBilling(false)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                !annualBilling
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setAnnualBilling(true)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                annualBilling
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Annuel
              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-bold text-emerald-400">
                -20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
          {/* Card 1: Starter */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 backdrop-blur-xl flex flex-col justify-between transition-all duration-300 hover:border-white/20">
            <div>
              <div className="text-sm font-semibold text-slate-400">Partenaire Starter</div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-white">0 DT</span>
                <span className="text-xs text-slate-400">/ toujours</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Idéal pour lancer son activité d&apos;affiliation et générer ses premières commissions sans risque.
              </p>

              <div className="my-6 border-t border-white/[0.08]" />

              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  Accès complet au catalogue standard
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  Commissions standard par livraison
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  Tableau de bord de suivi des commandes
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  Paiement hebdomadaire par virement
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  Support standard par ticket
                </li>
              </ul>
            </div>

            <Button
              asChild
              variant="outline"
              className="mt-8 w-full border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.08]"
            >
              <Link href="/register">Commencer gratuitement</Link>
            </Button>
          </div>

          {/* Card 2: Featured Pro Plan */}
          <div className="relative rounded-2xl border border-blue-500/40 bg-slate-900/80 p-6 sm:p-8 backdrop-blur-2xl flex flex-col justify-between shadow-2xl glow-border-brand transition-transform hover:-translate-y-1">
            {/* Featured Badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-1 text-[11px] font-bold text-white shadow-lg">
              LE PLUS POPULAIRE
            </div>

            <div>
              <div className="text-sm font-semibold text-blue-400 flex items-center justify-between">
                <span>Partenaire PRO</span>
                <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-300 border border-blue-500/20">
                  Booster de Gains
                </span>
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-white">
                  {annualBilling ? "39 DT" : "49 DT"}
                </span>
                <span className="text-xs text-slate-400">/ mois</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Pour les affiliés et media buyers confirmés visant des volumes élevés et des commissions maximales.
              </p>

              <div className="my-6 border-t border-white/[0.08]" />

              <ul className="space-y-3 text-xs text-slate-200">
                <li className="flex items-center gap-2 font-medium text-white">
                  <Check className="h-4 w-4 text-blue-400 shrink-0" />
                  Tout le plan Starter inclus
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-400 shrink-0" />
                  <span className="font-semibold text-blue-300">+15% de bonus</span> sur chaque commission
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-400 shrink-0" />
                  Accès exclusif aux stocks &amp; nouveautés VIP
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-400 shrink-0" />
                  Parrainage débloqué sur 4 niveaux complets
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-400 shrink-0" />
                  Créatifs &amp; vidéos publicitaires haute conversion
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-400 shrink-0" />
                  Support prioritaire WhatsApp &amp; account manager
                </li>
              </ul>
            </div>

            <Button
              asChild
              className="mt-8 w-full font-semibold text-white shadow-lg transition-transform active:scale-95"
              style={{
                background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
                boxShadow: "0 4px 18px rgba(37,99,235,0.45)",
              }}
            >
              <Link href="/register">Passer au niveau PRO</Link>
            </Button>
          </div>

          {/* Card 3: Supplier / Enterprise */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 backdrop-blur-xl flex flex-col justify-between transition-all duration-300 hover:border-white/20">
            <div>
              <div className="text-sm font-semibold text-slate-400">Fournisseur &amp; Marque</div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-white">Sur Mesure</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Vous avez des produits et du stock ? Déléguez entièrement votre acquisition à notre réseau d&apos;affiliés.
              </p>

              <div className="my-6 border-t border-white/[0.08]" />

              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-400 shrink-0" />
                  Publication de vos produits au catalogue
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-400 shrink-0" />
                  Réseau de +1,200 affiliés actifs
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-400 shrink-0" />
                  Synchronisation stocks et commandes via API
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-400 shrink-0" />
                  Règlement des ventes automatisé
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-400 shrink-0" />
                  Contrat cadre et SLA livraison dédié
                </li>
              </ul>
            </div>

            <Button
              asChild
              variant="outline"
              className="mt-8 w-full border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.08]"
            >
              <a href="mailto:contact@ecomcolab.tn">Contacter notre équipe</a>
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
              <h4 className="font-semibold text-white">Comment et quand suis-je payé ?</h4>
              <p className="mt-2 text-slate-400 leading-relaxed">
                Les commissions sont automatiquement ajoutées à votre solde dès que le livreur encaisse la commande.
                Les virements sont déclenchés chaque semaine dès que le seuil minimum de 30 DT est atteint.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="font-semibold text-white">Dois-je gérer le stock ou la livraison ?</h4>
              <p className="mt-2 text-slate-400 leading-relaxed">
                Absolument pas ! Vous vous concentrez uniquement sur la promotion des produits.
                Nos entrepôts partenaires et livreurs certifiés s&apos;occupent de l&apos;emballage et de l&apos;acheminement.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="font-semibold text-white">Comment fonctionne le parrainage ?</h4>
              <p className="mt-2 text-slate-400 leading-relaxed">
                Chaque partenaire dispose d&apos;un code d&apos;invitation unique. Lorsqu&apos;un nouveau membre s&apos;inscrit via votre code,
                vous percevez un pourcentage garanti sur toutes ses commandes livrées, jusqu&apos;à 4 niveaux.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="font-semibold text-white">Quelles sont les zones de livraison couvertes ?</h4>
              <p className="mt-2 text-slate-400 leading-relaxed">
                Nous couvrons l&apos;intégralité des 24 gouvernorats de la Tunisie avec des délais moyens de 24h à 48h
                et un taux de confirmation de plus de 94%.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
