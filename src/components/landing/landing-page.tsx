"use client";

import { LandingNavbar } from "./navbar";
import { HeroSection } from "./hero-section";
import { FeaturesBento } from "./features-bento";
import { PricingSection } from "./pricing-section";
import { LandingFooter } from "./footer";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-blue-600 selection:text-white">
      <LandingNavbar />
      <main id="main-content">
        <HeroSection />
        <FeaturesBento />
        <PricingSection />
      </main>
      <LandingFooter />
    </div>
  );
}
