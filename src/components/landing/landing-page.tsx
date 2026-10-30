"use client";

import { LandingNavbar } from "./navbar";
import { HeroSection } from "./hero-section";
import { FeaturesBento } from "./features-bento";
import { HowItWorks } from "./how-it-works";
import { PricingSection } from "./pricing-section";
import { CTASection } from "./cta-section";
import { LandingFooter } from "./footer";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-blue-600 selection:text-white">
      <LandingNavbar />
      <main id="main-content">
        <HeroSection />
        <FeaturesBento />
        <HowItWorks />
        <PricingSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
}
