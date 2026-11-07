"use client";

import React from "react";
import { AuthLanguageProvider, useAuthLanguage } from "./auth-language-context";
import { AuthLanguageToggle } from "./auth-language-toggle";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { DynamicBrandLogo } from "@/components/brand/dynamic-brand-logo";
import { AuthMarketingShowcase } from "./auth-marketing-showcase";
import { DeliveryPartnersShowcase } from "./delivery-partners-showcase";
import type { DeliveryPartnersConfig } from "@/modules/branding/delivery-partners-schemas";
import {
  DEFAULT_AUTH_PAGES_DESIGN,
  type AuthPagesDesign,
  type ResolvedBranding,
} from "@/modules/branding/defaults";
import { cn } from "@/lib/utils";

interface AuthSplitShellProps {
  pageType?: "login" | "register";
  heroVisual?: React.ReactNode;
  authDesign?: AuthPagesDesign | null;
  branding?: ResolvedBranding | null;
  deliveryPartnersConfig?: DeliveryPartnersConfig | null;
  children: React.ReactNode;
}

function AuthSplitShellInner({
  pageType = "login",
  heroVisual,
  authDesign: propAuthDesign,
  branding,
  deliveryPartnersConfig,
  children,
}: AuthSplitShellProps) {
  const { lang, isRtl } = useAuthLanguage();
  const authDesign = propAuthDesign || DEFAULT_AUTH_PAGES_DESIGN;
  const content = authDesign.content[lang] || authDesign.content.fr;

  const showMarketing = authDesign.layout?.showMarketingPanel ?? true;
  const marketingBg = authDesign.colors?.marketingBg || "#0B0F19";
  const primaryColor = authDesign.colors?.primaryColor || "#10B981";

  // Resolve custom logo if specified in auth design
  const darkLogoUrl = authDesign.branding?.logoDarkUrl || branding?.logoDark || null;
  const lightLogoUrl = authDesign.branding?.logoLightUrl || branding?.logoLight || null;
  const brandName = branding?.name || "EcomPartner";

  return (
    <div
      dir="ltr"
      className="relative min-h-screen w-full bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary flex flex-col justify-between"
    >
      {/* Top action controls (Floating: Language & Theme) */}
      <header
        className={cn(
          "fixed top-4 z-50 flex items-center gap-2",
          isRtl ? "left-4" : "right-4"
        )}
      >
        <AuthLanguageToggle />
        <ThemeToggle variant="outline" />
      </header>

      {/* Main Structural Grid */}
      <div
        className={cn(
          "grid w-full flex-1",
          showMarketing ? "lg:grid-cols-2" : "grid-cols-1"
        )}
      >
        {/* ── Left Pane: Marketing Showcase (Desktop) ── */}
        {showMarketing && (
          <aside
            className="relative hidden lg:flex flex-col justify-between overflow-hidden p-10 xl:p-14 text-white border-r border-white/10"
            style={{ backgroundColor: marketingBg }}
            aria-label="Brand showcase"
          >
            {/* Ambient mesh drift & glowing tech radial glows */}
            <div
              className="pointer-events-none absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full opacity-25"
              style={{
                background: `radial-gradient(circle, ${primaryColor} 0%, transparent 70%)`,
                filter: "blur(80px)",
              }}
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full opacity-15"
              style={{
                background: `radial-gradient(circle, ${authDesign.colors.accentColor} 0%, transparent 70%)`,
                filter: "blur(90px)",
              }}
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: `radial-gradient(circle, #ffffff 1px, transparent 1px)`,
                backgroundSize: "24px 24px",
              }}
              aria-hidden="true"
            />

            {/* Top Brand Logo */}
            <div className="relative z-10">
              <DynamicBrandLogo
                variant="horizontal"
                theme="dark"
                showTagline={true}
                branding={branding}
                customLogoUrl={darkLogoUrl}
                customName={brandName}
              />
            </div>

            {/* Center Showcase Visual */}
            <div className="relative z-10 my-auto py-8">
              {heroVisual ? (
                heroVisual
              ) : (
                <AuthMarketingShowcase
                  pageType={pageType}
                  authDesign={authDesign}
                />
              )}
            </div>

            {/* Bottom Trust Signoff */}
            <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-4">
              <span className="font-mono text-[11px] tracking-wider uppercase text-slate-400">
                {content.footerText || `${brandName} Platform · Tous droits réservés.`}
              </span>
              <span>&copy; {new Date().getFullYear()}</span>
            </div>
          </aside>
        )}

        {/* ── Right Pane: Form Workspace ── */}
        <main
          className={cn(
            "relative flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 lg:p-12 overflow-y-auto",
            !showMarketing && "max-w-xl mx-auto w-full"
          )}
          id="auth-form-container"
        >
          {/* Subtle architectural background grid */}
          <div
            className="pointer-events-none fixed inset-0 -z-10 opacity-[0.03] dark:opacity-[0.06]"
            style={{
              backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
              backgroundSize: "32px 32px",
            }}
            aria-hidden="true"
          />

          {/* Mobile Top Brand Bar (Visible only on < lg or when marketing pane is hidden) */}
          <div
            dir="ltr"
            className={cn(
              "mb-6 flex flex-col items-center gap-2 w-full max-w-md pt-8",
              showMarketing ? "lg:hidden" : "flex"
            )}
          >
            <DynamicBrandLogo
              variant="horizontal"
              theme="auto"
              showTagline={true}
              branding={branding}
              customLogoUrl={lightLogoUrl}
              customName={brandName}
            />
          </div>

          {/* Form Content Wrapper */}
          <div className="w-full max-w-lg my-auto py-4">
            {children}
          </div>
        </main>
      </div>

      {/* ── Bottom: Delivery Partners Showcase ── */}
      <DeliveryPartnersShowcase config={deliveryPartnersConfig} />
    </div>
  );
}

export function AuthSplitShell({
  pageType = "login",
  heroVisual,
  authDesign,
  branding,
  deliveryPartnersConfig,
  children,
}: AuthSplitShellProps) {
  return (
    <AuthLanguageProvider>
      <AuthSplitShellInner
        pageType={pageType}
        heroVisual={heroVisual}
        authDesign={authDesign}
        branding={branding}
        deliveryPartnersConfig={deliveryPartnersConfig}
      >
        {children}
      </AuthSplitShellInner>
    </AuthLanguageProvider>
  );
}
