"use client";

import Link from "next/link";
import { ArrowUp, Heart, Shield, Lock } from "lucide-react";
import { EcomPartnerLogo } from "@/components/brand/logo";
import { useI18n } from "@/lib/i18n";

export function LandingFooter() {
  const { dict } = useI18n();

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
            <Link href="/" className="inline-block">
              <EcomPartnerLogo variant="horizontal" theme="dark" />
            </Link>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              {dict.landing.footerDesc}
            </p>
          </div>

          {/* Nav links columns */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
              {dict.landing.partnerSpace}
            </h4>
            <ul className="mt-4 space-y-2.5 text-xs">
              <li>
                <Link href="/register" className="hover:text-white transition-colors">
                  {dict.landing.createMyAccount}
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  {dict.landing.loginSpace}
                </Link>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  {dict.products.title}
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-white transition-colors">
                  {dict.nav.revenue}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
              {dict.landing.suppliers}
            </h4>
            <ul className="mt-4 space-y-2.5 text-xs">
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  {dict.products.title}
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-white transition-colors">
                  {dict.landing.pricingBadge}
                </a>
              </li>
              <li>
                <a href="#cta" className="hover:text-white transition-colors">
                  {dict.landing.joinPlatform}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
              {dict.landing.securityLegal}
            </h4>
            <ul className="mt-4 space-y-2.5 text-xs">
              <li className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-slate-400" />
                <span>{dict.landing.dataProtection}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-slate-400" />
                <span>{dict.landing.encryptedTransactions}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p className="flex items-center gap-1">
            &copy; {new Date().getFullYear()} EcomPartner. Together, We Grow. {dict.landing.allRightsReserved}
          </p>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={scrollToTop}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {dict.landing.backToTop} <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
