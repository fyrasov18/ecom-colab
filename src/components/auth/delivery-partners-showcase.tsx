"use client";

import * as React from "react";
import Image from "next/image";
import { Truck, ExternalLink } from "lucide-react";
import { useAuthLanguage } from "./auth-language-context";
import type { DeliveryPartnerItem, DeliveryPartnersConfig } from "@/modules/branding/delivery-partners-schemas";
import { cn } from "@/lib/utils";

interface DeliveryPartnersShowcaseProps {
  config?: DeliveryPartnersConfig | null;
  partners?: DeliveryPartnerItem[];
  className?: string;
  isSimulatorPreview?: boolean;
}

export function DeliveryPartnersShowcase({
  config,
  partners: propPartners,
  className,
  isSimulatorPreview = false,
}: DeliveryPartnersShowcaseProps) {
  const { lang, isRtl } = useAuthLanguage();

  if (config && config.enabled === false) {
    return null;
  }

  // Resolve partners list
  const rawList = propPartners ?? config?.partners ?? [];

  // Filter only active partners on public pages, sorted by displayOrder
  const activePartners = rawList
    .filter((p) => p.isActive)
    .sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
    });

  if (activePartners.length === 0) {
    return null;
  }

  // Multilingual title & subtitle resolution
  const title =
    config?.title?.[lang] ||
    config?.title?.fr ||
    (lang === "ar"
      ? "شركاؤنا في التوصيل"
      : lang === "en"
      ? "Our Delivery Partners"
      : "Nos partenaires de livraison");

  const subtitle =
    config?.subtitle?.[lang] ||
    (lang === "ar"
      ? "شبكة من الشركاء لدعم ومرافقة عمليات التوصيل الخاصة بكم."
      : lang === "en"
      ? "A network of partners to support your delivery operations."
      : "Un réseau de partenaires pour accompagner vos opérations de livraison.");

  // For a continuous infinite marquee without gaps on large screens,
  // we repeat the sequence enough times so that each track exceeds any standard viewport.
  const minItemsPerTrack = 8;
  const repeatFactor = Math.max(2, Math.ceil(minItemsPerTrack / activePartners.length));
  const trackSequence: DeliveryPartnerItem[] = [];
  for (let r = 0; r < repeatFactor; r++) {
    trackSequence.push(...activePartners);
  }

  // Render a single partner logo or minimal typographic badge
  const renderPartnerItem = (
    partner: DeliveryPartnerItem,
    indexKey: string,
    isAccessible: boolean
  ) => {
    const hasValidLogo = Boolean(partner.logoUrl && partner.logoUrl.trim().length > 0);
    const content = hasValidLogo ? (
      <div className="relative flex items-center justify-center h-8 sm:h-9 w-auto max-w-[120px] sm:max-w-[140px] px-1 select-none">
        <Image
          src={partner.logoUrl!}
          alt={isAccessible ? partner.name : ""}
          width={130}
          height={36}
          className={cn(
            "h-7 sm:h-8 w-auto max-w-[120px] sm:max-w-[140px] object-contain transition-all duration-300",
            "filter grayscale opacity-60 hover:grayscale-0 hover:opacity-100 hover:scale-105"
          )}
          loading="lazy"
        />
      </div>
    ) : (
      <div className="flex items-center gap-2 rounded-full border border-border/50 bg-background/50 dark:bg-card/40 px-3.5 py-1.5 text-xs font-medium text-foreground/80 hover:text-foreground hover:border-primary/40 transition-colors">
        <Truck className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="tracking-tight whitespace-nowrap">{partner.name}</span>
      </div>
    );

    // If real verified website link exists, render as accessible anchor
    if (partner.websiteUrl && isAccessible) {
      return (
        <a
          key={indexKey}
          href={partner.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`${partner.name} (site officiel)`}
          className="group inline-flex items-center justify-center shrink-0 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md"
        >
          {content}
        </a>
      );
    }

    if (partner.websiteUrl && !isAccessible) {
      return (
        <div
          key={indexKey}
          aria-hidden="true"
          className="group inline-flex items-center justify-center shrink-0 pointer-events-none"
        >
          {content}
        </div>
      );
    }

    return (
      <div
        key={indexKey}
        aria-hidden={!isAccessible}
        className="group inline-flex items-center justify-center shrink-0 cursor-default"
        title={partner.name}
      >
        {content}
      </div>
    );
  };

  return (
    <section
      aria-label={title}
      dir={isRtl ? "rtl" : "ltr"}
      className={cn(
        "w-full border-t border-border/40 bg-card/30 dark:bg-card/10 backdrop-blur-sm transition-colors",
        isSimulatorPreview ? "py-3 px-2" : "py-5 sm:py-6 px-4 sm:px-6 lg:px-8",
        className
      )}
    >
      <div className="mx-auto max-w-5xl">
        {/* Section Header */}
        <div className="mb-4 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] font-medium text-primary mb-1.5">
            <Truck className="h-3 w-3" />
            <span>
              {lang === "ar"
                ? "حلول التوصيل والشحن"
                : lang === "en"
                ? "Delivery Solutions"
                : "Réseau de livraison"}
            </span>
          </div>

          <h2 className="text-sm sm:text-base font-semibold tracking-tight text-foreground">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground/80 max-w-lg mx-auto leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {/* ── CONTINUOUS HORIZONTAL INFINITE LOGO MARQUEE ── */}
        <div
          className={cn(
            "relative w-full overflow-hidden marquee-wrapper py-2",
            "marquee-fade-mask"
          )}
          role="region"
          aria-label="Défilement des partenaires de livraison"
        >
          <div className="flex w-max items-center">
            {/* Primary Track (Announced by screen readers for the first cycle) */}
            <div
              className={cn(
                "flex shrink-0 items-center gap-10 sm:gap-14 lg:gap-16",
                isRtl
                  ? "animate-marquee-rtl pl-10 sm:pl-14 lg:pl-16 pr-0"
                  : "animate-marquee-ltr pr-10 sm:pr-14 lg:pr-16"
              )}
            >
              {trackSequence.map((partner, idx) =>
                renderPartnerItem(partner, `track1-${partner.id}-${idx}`, idx < activePartners.length)
              )}
            </div>

            {/* Duplicate Track (Seamless infinite loop, aria-hidden for accessibility) */}
            <div
              aria-hidden="true"
              className={cn(
                "marquee-duplicate-track flex shrink-0 items-center gap-10 sm:gap-14 lg:gap-16 select-none",
                isRtl
                  ? "animate-marquee-rtl pl-10 sm:pl-14 lg:pl-16 pr-0"
                  : "animate-marquee-ltr pr-10 sm:pr-14 lg:pr-16"
              )}
            >
              {trackSequence.map((partner, idx) =>
                renderPartnerItem(partner, `track2-${partner.id}-${idx}`, false)
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
