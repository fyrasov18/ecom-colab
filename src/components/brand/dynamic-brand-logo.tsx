"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { EcomPartnerLogo } from "./logo";
import type { ResolvedBranding } from "@/modules/branding/defaults";

export interface DynamicBrandLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "horizontal" | "compact" | "mark" | "wordmark";
  theme?: "light" | "dark" | "auto";
  showTagline?: boolean;
  href?: string;
  iconOnly?: boolean;
  branding?: ResolvedBranding | null;
  /** Direct override for logo url */
  customLogoUrl?: string | null;
  /** Direct override for brand name */
  customName?: string | null;
}

/**
 * Dynamic brand logo that renders custom partner or platform branding logos with
 * automated failover to the built-in vector EcomPartnerLogo.
 */
export function DynamicBrandLogo({
  variant = "horizontal",
  theme = "auto",
  showTagline = false,
  href,
  iconOnly = false,
  branding,
  customLogoUrl,
  customName,
  className,
  ...props
}: DynamicBrandLogoProps) {
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
  const actualVariant = iconOnly ? "mark" : variant;

  const brandName = customName ?? branding?.name ?? "EcomPartner";
  const tagline = branding?.tagline ?? "Together, We Grow.";

  // Determine applicable logo image URL
  const targetLogoUrl = React.useMemo(() => {
    if (customLogoUrl) return customLogoUrl;
    if (!branding) return null;

    if (actualVariant === "mark") {
      return branding.logoMark || (theme === "light" ? branding.logoLight : branding.logoDark) || branding.logoLight || branding.logoDark;
    }

    if (theme === "light") {
      return branding.logoLight || branding.logoDark || branding.logoMark;
    }

    if (theme === "dark") {
      return branding.logoDark || branding.logoLight || branding.logoMark;
    }

    // auto
    return branding.logoDark || branding.logoLight || branding.logoMark;
  }, [customLogoUrl, branding, actualVariant, theme]);

  const isImgError = failedUrl !== null && failedUrl === targetLogoUrl;

  // If no custom logo or image error occurred, render vector logo
  if (!targetLogoUrl || isImgError) {
    return (
      <EcomPartnerLogo
        variant={actualVariant}
        theme={theme}
        showTagline={showTagline}
        href={href}
        iconOnly={iconOnly}
        className={className}
        {...props}
      />
    );
  }

  const imageElement = (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 select-none",
        theme === "dark" && "dark text-white",
        theme === "light" && "text-slate-900",
        className
      )}
      {...props}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={targetLogoUrl}
        alt={brandName}
        onError={() => setFailedUrl(targetLogoUrl)}
        className={cn(
          "object-contain shrink-0 transition-opacity",
          actualVariant === "mark" ? "h-9 w-9 rounded-md" : "h-8 max-w-[160px]"
        )}
      />

      {actualVariant !== "mark" && (
        <div className="flex flex-col min-w-0">
          <span className="font-bold tracking-tight text-base leading-tight truncate">
            {brandName}
          </span>
          {showTagline && tagline && (
            <span className="text-[10px] text-muted-foreground leading-tight truncate">
              {tagline}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md transition-opacity hover:opacity-95"
      >
        {imageElement}
      </Link>
    );
  }

  return imageElement;
}
