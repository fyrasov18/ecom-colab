"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Users2,
  Settings,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    number: 1,
    icon: Zap,
    title: "Découvrir et s'inscrire",
    description:
      "Créez votre compte partenaire sur la plateforme. L'inscription est gratuite et votre demande est soumise à validation administrative.",
    iconColor: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  {
    number: 2,
    icon: Users2,
    title: "Collaborer avec des partenaires",
    description:
      "Rejoignez un réseau de marques et de vendeurs e-commerce. Vous accédez au catalogue produits et aux outils de gestion partagés.",
    iconColor: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
  },
  {
    number: 3,
    icon: Settings,
    title: "Gérer les opérations",
    description:
      "Suivez vos commandes, organisez vos responsabilités et coordonnez la logistique depuis votre espace partenaire dédié.",
    iconColor: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
  },
  {
    number: 4,
    icon: TrendingUp,
    title: "Suivre les performances",
    description:
      "Consultez vos commissions, vos ventes et vos indicateurs de performance en temps réel depuis votre tableau de bord.",
    iconColor: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  {
    number: 5,
    icon: CheckCircle2,
    title: "Développer votre activité",
    description:
      "Réinvestissez vos gains, parrainez de nouveaux partenaires et faites grandir votre collaboration sur des résultats mesurables.",
    iconColor: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative py-20 bg-slate-950 text-white border-t border-white/[0.08]"
    >
      {/* Background ambient light */}
      <div
        className="pointer-events-none absolute left-1/3 top-1/4 -z-0 h-96 w-96 rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, rgba(37, 99, 235, 0.3) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 z-10">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center mb-16">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 mb-4">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Processus de collaboration
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Comment fonctionne la{" "}
            <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
              collaboration
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400">
            Un parcours structuré en cinq étapes, de l&apos;inscription au
            développement de votre activité e-commerce.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {steps.map((step) => (
            <div
              key={step.number}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 backdrop-blur-xl transition-all duration-300 hover:border-blue-500/30 hover:bg-slate-900/70"
            >
              {/* Step number */}
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-xs font-bold text-white mb-4">
                {step.number}
              </div>

              {/* Icon */}
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${step.bgColor} ${step.borderColor} ${step.iconColor} mb-6`}
              >
                <step.icon className="h-6 w-6" />
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold text-white mb-3">
                {step.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-slate-400 leading-relaxed">
                {step.description}
              </p>

              {/* Subtle hover underline */}
              <div className="mt-6 h-0.5 w-0 group-hover:w-full transition-all duration-300 bg-blue-500/30" />
            </div>
          ))}
        </div>

        {/* CTA within section */}
        <div className="mt-16 flex justify-center">
          <Button
            asChild
            size="lg"
            className="h-12 px-8 text-base font-semibold shadow-xl"
            style={{
              background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
              boxShadow: "0 6px 24px rgba(37,99,235,0.45)",
            }}
          >
            <Link href="/register">
              <ArrowRight className="mr-2 h-4 w-4" />
              Rejoindre la plateforme
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}