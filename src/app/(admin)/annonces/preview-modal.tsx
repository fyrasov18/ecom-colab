"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useI18n } from "@/lib/i18n";
import {
  ArrowRight,
  Eye,
  Megaphone,
  PartyPopper,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WelcomeOnboardingModal } from "@/components/announcements/welcome-onboarding-modal";

type PreviewProps = {
  type: "WELCOME" | "LEVEL_UP" | "ANNOUNCEMENT";
  title: string;
  message: string;
  buttonText: string;
  buttonUrl?: string;
  badgeText?: string;
  bannerText?: string;
  themeColor?: string;
  imageUrl?: string;
  metadata?: {
    oldLevel?: number;
    newLevel?: number;
    newRate?: number;
  };
  trigger?: React.ReactNode;
};

export function NotificationPreviewModal({
  type,
  title,
  message,
  buttonText,
  buttonUrl: _buttonUrl = "#",
  badgeText: _badgeText,
  bannerText,
  themeColor,
  imageUrl,
  metadata = { oldLevel: 1, newLevel: 2, newRate: 0.07 },
  trigger,
}: PreviewProps) {
  const { dict } = useI18n();
  const t = dict.announcements;
  const [open, setOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isLevelUp = type === "LEVEL_UP";
  const isWelcome = type === "WELCOME";

  const oldLevel = metadata.oldLevel ?? 1;
  const newLevel = metadata.newLevel ?? 2;
  const rateNumber = metadata.newRate ?? 0.07;
  const ratePercent = Math.round(rateNumber <= 1 ? rateNumber * 100 : rateNumber);

  const interpolatedTitle = title
    .replace("{partnerName}", "Karim Ben Salah")
    .replace("{newLevel}", String(newLevel))
    .replace("{oldLevel}", String(oldLevel))
    .replace("{commissionRate}", String(ratePercent));

  const interpolatedMessage = message
    .replace("{partnerName}", "Karim Ben Salah")
    .replace("{newLevel}", String(newLevel))
    .replace("{oldLevel}", String(oldLevel))
    .replace("{commissionRate}", String(ratePercent));

  // Dedicated Onboarding Welcome Modal Preview
  if (isWelcome) {
    return (
      <>
        {trigger ? (
          <span onClick={() => setOpen(true)} className="cursor-pointer inline-flex">
            {trigger}
          </span>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setOpen(true)}
          >
            <Eye className="h-3.5 w-3.5" /> {t.previewButton}
          </Button>
        )}
        <WelcomeOnboardingModal
          isOpen={open}
          onClose={() => setOpen(false)}
          onAction={() => setOpen(false)}
          title={interpolatedTitle}
          subtitle={interpolatedMessage}
          buttonText={buttonText}
          bannerText={bannerText}
          themeColor={themeColor}
          isPreview={true}
        />
      </>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Eye className="h-3.5 w-3.5" /> {t.previewButton}
          </Button>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in" />
        <Dialog.Content
          className={`fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 sm:p-8 max-h-[90vh] overflow-y-auto ${
            isLevelUp
              ? "border-amber-500/40 shadow-amber-500/10"
              : "border-border shadow-xl"
          }`}
          aria-describedby="preview-modal-description"
        >
          <div className="absolute right-4 top-4 flex items-center gap-2">
            <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t.partnerPreview}
            </span>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={dict.common.close}
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex flex-col items-center text-center mt-2">
            {isLevelUp ? (
              <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-tr from-amber-500/20 via-yellow-500/30 to-amber-400/20 ring-8 ring-amber-500/10">
                <PartyPopper className="h-10 w-10 text-amber-500" />
                <div className="absolute -top-1 -right-1 rounded-full bg-amber-500 p-1 text-white shadow-xs">
                  <Sparkles className="h-4 w-4" />
                </div>
              </div>
            ) : (
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary ring-6 ring-primary/5">
                <Megaphone className="h-8 w-8" />
              </div>
            )}

            {isLevelUp ? (
              <Badge className="mb-3 bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/30 gap-1.5 px-3 py-1 font-semibold text-xs uppercase tracking-wider">
                <TrendingUp className="h-3.5 w-3.5" /> {t.levelPromotionBadge}
              </Badge>
            ) : (
              <Badge variant="outline" className="mb-3 px-3 py-1 text-xs uppercase tracking-wider">
                {t.title}
              </Badge>
            )}

            <Dialog.Title className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {interpolatedTitle}
            </Dialog.Title>

            {isLevelUp && (
              <div className="my-5 w-full rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-left">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-2">
                  <span>{t.officialProgression}</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">{t.validatedByAdmin}</span>
                </div>
                <div className="flex items-center justify-around gap-2 py-2">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">{t.oldLevel}</div>
                    <div className="mt-1 text-lg font-bold text-muted-foreground line-through">
                      {t.levelNumber.replace("{level}", String(oldLevel))}
                    </div>
                  </div>
                  <div className="text-amber-500 font-bold text-xl">➔</div>
                  <div className="text-center">
                    <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold">{t.newLevelStatus}</div>
                    <div className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">
                      {t.levelNumber.replace("{level}", String(newLevel))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-amber-500/20 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t.newCommissionRate}</span>
                  <span className="font-bold text-foreground text-base bg-amber-500/20 px-2.5 py-0.5 rounded-md text-amber-700 dark:text-amber-300">
                    {ratePercent} %
                  </span>
                </div>
              </div>
            )}

            {/* Optional Image */}
            {imageUrl && !imageError && (
              <div className="my-4 h-48 w-full overflow-hidden rounded-xl bg-muted border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                  onError={() => setImageError(true)}
                />
              </div>
            )}

            {/* Body Message */}
            <p
              id="preview-modal-description"
              className="mt-3 text-sm sm:text-base leading-relaxed text-muted-foreground"
            >
              {interpolatedMessage}
            </p>

            {/* Actions Preview */}
            <div className="mt-6 flex w-full flex-col sm:flex-row gap-3">
              <Dialog.Close asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto order-2 sm:order-1"
                >
                  Fermer
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                onClick={() => setOpen(false)}
                className={`w-full flex-1 order-1 sm:order-2 gap-2 text-sm font-semibold shadow-md ${
                  isLevelUp
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : ""
                }`}
              >
                <span>{buttonText || "Continuer"}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
