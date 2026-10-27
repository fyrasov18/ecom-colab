"use client";

import {
  Truck,
  Wallet,
  Users2,
  PackageCheck,
  ShieldCheck,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";

export function FeaturesBento() {
  return (
    <section id="features" className="relative py-20 bg-slate-950 text-white border-t border-white/[0.08]">
      {/* Background ambient light */}
      <div
        className="pointer-events-none absolute right-0 top-1/3 -z-0 h-96 w-96 rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 z-10">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center mb-16">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Écosystème B2B Intégré
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Tout ce dont vous avez besoin pour{" "}
            <span className="bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
              scaler vos revenus
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400">
            Une infrastructure complète conçue pour éliminer les complexités logistiques,
            financières et techniques du commerce électronique.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Bento Card 1: Wide Card */}
          <div className="md:col-span-2 group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 backdrop-blur-xl transition-all duration-300 hover:border-blue-500/30 hover:bg-slate-900/70">
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Truck className="h-6 w-6" />
              </div>
              <span className="flex items-center text-xs font-medium text-blue-400">
                Temps réel <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </span>
            </div>

            <div className="mt-6">
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                Dispatching &amp; Suivi Logistique Automatisé
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed max-w-xl">
                Connexion directe avec les transporteurs sur l&apos;ensemble du territoire tunisien.
                Mise à jour automatique des statuts, gestion proactive des retours et notifications Telegram instantanées.
              </p>
            </div>

            {/* Interactive Timeline Mockup inside Card */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-white/[0.08]">
              <div className="rounded-lg bg-white/[0.03] p-3 border border-white/05">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> 1. Prise en charge
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Confirmation sous 2h ouvrées</p>
              </div>

              <div className="rounded-lg bg-white/[0.03] p-3 border border-white/05">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
                  <Truck className="h-3.5 w-3.5" /> 2. Expédition express
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Livraison en 24h à 48h max</p>
              </div>

              <div className="rounded-lg bg-white/[0.03] p-3 border border-white/05">
                <div className="flex items-center gap-2 text-xs font-semibold text-purple-400">
                  <Wallet className="h-3.5 w-3.5" /> 3. Encaissement
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Commission créditée aussitôt</p>
              </div>
            </div>
          </div>

          {/* Bento Card 2: Wallet */}
          <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 backdrop-blur-xl transition-all duration-300 hover:border-emerald-500/30 hover:bg-slate-900/70">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Wallet className="h-6 w-6" />
            </div>

            <h3 className="mt-6 text-xl font-bold text-white">
              Portefeuille &amp; Retraits Sécurisés
            </h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Consultez votre solde en temps réel, suivez les commissions en attente et déclenchez vos virements bancaires chaque semaine sans surprise.
            </p>

            <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center">
              <span className="text-xs text-emerald-300 font-semibold">
                ✓ 0% de frais de retrait cachés
              </span>
            </div>
          </div>

          {/* Bento Card 3: Multi-tier Referrals */}
          <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 backdrop-blur-xl transition-all duration-300 hover:border-purple-500/30 hover:bg-slate-900/70">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Users2 className="h-6 w-6" />
            </div>

            <h3 className="mt-6 text-xl font-bold text-white">
              Programme de Parrainage Multi-Niveaux
            </h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Multipliez vos sources de revenus en bâtissant votre propre équipe d&apos;affiliés.
              Bénéficiez de commissions sur 4 niveaux avec attribution vérifiée et protection anti-fraude.
            </p>

            <div className="mt-6 flex items-center justify-between text-xs text-slate-400 font-mono border-t border-white/05 pt-4">
              <span>Tier 1 : 5%</span>
              <span>Tier 2 : 3%</span>
              <span>Tier 3 : 1.5%</span>
            </div>
          </div>

          {/* Bento Card 4: Wide Catalogue */}
          <div className="md:col-span-2 group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 backdrop-blur-xl transition-all duration-300 hover:border-blue-500/30 hover:bg-slate-900/70">
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <PackageCheck className="h-6 w-6" />
              </div>
              <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-400 border border-blue-500/20">
                100% Produits Validés
              </span>
            </div>

            <div className="mt-6">
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                Catalogue de Produits Prêts à la Vente
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed max-w-xl">
                Accédez à un inventaire constamment réapprovisionné en produits gagnants.
                Photos haute définition, vidéos publicitaires optimisées et fiches produits complètes prêtes à être publiées sur vos campagnes.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
              <div className="rounded-lg bg-white/[0.03] p-2.5 border border-white/05">
                <span className="font-bold text-white block">Électronique</span>
                <span className="text-[10px] text-slate-400">+120 refs</span>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-2.5 border border-white/05">
                <span className="font-bold text-white block">Beauté &amp; Soins</span>
                <span className="text-[10px] text-slate-400">+85 refs</span>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-2.5 border border-white/05">
                <span className="font-bold text-white block">Maison &amp; Déco</span>
                <span className="text-[10px] text-slate-400">+90 refs</span>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-2.5 border border-white/05">
                <span className="font-bold text-white block">Fitness</span>
                <span className="text-[10px] text-slate-400">+60 refs</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
