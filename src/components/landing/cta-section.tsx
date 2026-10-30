"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section id="cta" className="relative py-20 bg-slate-950 text-white border-t border-white/[0.08] overflow-hidden">
      {/* Background ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 20% 10%, rgba(37, 99, 235, 0.25) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 80% 90%, rgba(30, 58, 138, 0.25) 0%, transparent 60%)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 z-10">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-white mb-6">
            Prêt à développer votre activité e-commerce ?
          </h2>
          <p className="text-lg sm:text-xl text-slate-300/90 leading-relaxed mb-10 max-w-2xl mx-auto">
            Rejoignez un environnement conçu pour structurer vos collaborations,
            suivre vos performances et développer votre activité sur la base de
            résultats concrets.
          </p>

          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto h-12 px-8 text-base font-semibold text-white shadow-xl transition-all duration-200 hover:shadow-blue-500/25 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
              boxShadow: "0 6px 24px rgba(37,99,235,0.45)",
            }}
          >
            <Link href="/register">
              <Sparkles className="mr-2 h-4 w-4 text-blue-200" />
              Rejoindre la plateforme
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}