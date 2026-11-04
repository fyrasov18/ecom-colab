"use client";

import React from "react";
import { AuthLanguageProvider } from "./auth-language-context";
import { AuthLanguageToggle } from "./auth-language-toggle";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { EcomPartnerLogo } from "@/components/brand/logo";

interface AuthSplitShellProps {
  heroVisual: React.ReactNode;
  children: React.ReactNode;
}

function AuthSplitShellInner({ heroVisual, children }: AuthSplitShellProps) {

  return (
    <div
      dir="ltr"
      className="relative min-h-screen w-full bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary"
    >
      {/* Shared SVG Defs to ensure gradients resolve even when desktop pane is hidden on mobile */}
      <svg className="absolute w-0 h-0 overflow-hidden" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="ep-gradient-h" x1="12" y1="24" x2="92" y2="84" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A3E635" />
            <stop offset="0.48" stopColor="#10B981" />
            <stop offset="1" stopColor="#0F766E" />
          </linearGradient>
          <linearGradient id="ep-gradient-mark" x1="12" y1="24" x2="92" y2="84" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A3E635" />
            <stop offset="0.48" stopColor="#10B981" />
            <stop offset="1" stopColor="#0F766E" />
          </linearGradient>
        </defs>
      </svg>

      {/* Top action controls (Floating: Language & Theme) */}
      <header className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <AuthLanguageToggle />
        <ThemeToggle variant="outline" />
      </header>

      {/* Main Structural Grid — always LTR structure to keep Hero on left and Form on right */}
      <div className="grid min-h-screen w-full lg:grid-cols-2">
        {/* ── Left Pane: Hero Visual Showcase (Desktop) ── */}
        <aside
          className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-slate-950 p-10 xl:p-14 text-white border-r border-white/10"
          aria-label="Brand showcase"
        >
          {/* Ambient mesh drift & tech grid */}
          <div className="pointer-events-none absolute inset-0 bg-mesh-animated opacity-90" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 bg-grid-agency opacity-40" aria-hidden="true" />
          <div
            className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full opacity-30"
            style={{
              background: "radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
            aria-hidden="true"
          />

          {/* Top Brand Logo */}
          <div className="relative z-10">
            <EcomPartnerLogo variant="horizontal" theme="dark" showTagline={true} />
          </div>

          {/* Center Showcase Visual */}
          <div className="relative z-10 my-auto py-8">
            {heroVisual}
          </div>

          {/* Bottom Trust Signoff */}
          <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-4">
            <span className="font-mono text-[11px] tracking-wider uppercase text-slate-400">
              EcomPartner Platform
            </span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
        </aside>

        {/* ── Right Pane: Form Workspace ── */}
        <main
          className="relative flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 lg:p-12 overflow-y-auto"
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

          {/* Mobile Top Brand Bar (Visible only on < lg) */}
          <div dir="ltr" className="mb-6 flex flex-col items-center gap-2 lg:hidden w-full max-w-md pt-8">
            <EcomPartnerLogo variant="horizontal" theme="auto" showTagline={true} />
          </div>

          {/* Form Content Wrapper */}
          <div className="w-full max-w-lg my-auto py-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function AuthSplitShell({ heroVisual, children }: AuthSplitShellProps) {
  return (
    <AuthLanguageProvider>
      <AuthSplitShellInner heroVisual={heroVisual}>
        {children}
      </AuthSplitShellInner>
    </AuthLanguageProvider>
  );
}
