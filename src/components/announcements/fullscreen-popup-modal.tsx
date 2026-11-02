"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Gift,
  Megaphone,
  PartyPopper,
  Sparkles,
  Star,
  TrendingUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CelebrationConfetti } from "./confetti";
import {
  dismissPartnerPopupAction,
  trackPopupDisplayedAction,
} from "@/modules/announcements/actions";
import type { PartnerPopupPayload } from "@/modules/announcements/service";

type Props = {
  initialPopup: PartnerPopupPayload | null;
  partnerId: string;
};

export function FullscreenPopupModal({ initialPopup, partnerId }: Props) {
  const router = useRouter();
  const [popup, setPopup] = useState<PartnerPopupPayload | null>(initialPopup);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (popup?.id) {
      void trackPopupDisplayedAction(popup.id);
    }
  }, [popup?.id]);

  if (!popup) return null;

  const handleClose = async () => {
    setClosing(true);
    await dismissPartnerPopupAction(popup.id, false);
    setTimeout(() => {
      setPopup(null);
      setClosing(false);
    }, 250);
  };

  const handleAction = async () => {
    setClosing(true);
    await dismissPartnerPopupAction(popup.id, true);
    setTimeout(() => {
      setPopup(null);
      setClosing(false);
      if (popup.buttonUrl) {
        if (popup.buttonUrl.startsWith("http")) {
          window.open(popup.buttonUrl, "_blank", "noopener,noreferrer");
        } else {
          router.push(popup.buttonUrl);
        }
      }
    }, 200);
  };

  const isLevelUp = popup.type === "LEVEL_UP";
  const isWelcome = popup.type === "WELCOME";

  // Level Up Metadata
  const oldLevel = Number(popup.metadata?.previousLevel ?? 1);
  const newLevel = Number(popup.metadata?.newLevel ?? 2);
  const rateNumber = Number(popup.metadata?.newRate ?? 0.07);
  const ratePercent = Math.round(rateNumber <= 1 ? rateNumber * 100 : rateNumber);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
      role="dialog"
      aria-modal="true"
    >
      {/* Celebration Confetti for Level Up */}
      {isLevelUp && <CelebrationConfetti duration={4500} />}

      {/* Backdrop with strong blur */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Container */}
      <div
        className={`relative z-10 w-full max-w-lg transform overflow-hidden rounded-2xl border bg-card p-6 shadow-2xl transition-all duration-300 sm:p-8 ${
          closing ? "scale-95 opacity-0" : "scale-100 opacity-100"
        } ${
          isLevelUp
            ? "border-amber-500/40 shadow-amber-500/10"
            : isWelcome
            ? "border-indigo-500/40 shadow-indigo-500/10"
            : "border-border shadow-xl"
        }`}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Icon / Animation Graphic */}
        <div className="flex flex-col items-center text-center">
          {isLevelUp ? (
            <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-tr from-amber-500/20 via-yellow-500/30 to-amber-400/20 ring-8 ring-amber-500/10">
              <PartyPopper className="h-10 w-10 text-amber-500 animate-bounce" />
              <div className="absolute -top-1 -right-1 rounded-full bg-amber-500 p-1 text-white shadow-xs">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
          ) : isWelcome ? (
            <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-tr from-indigo-500/20 via-primary/30 to-sky-400/20 ring-8 ring-indigo-500/10">
              <CheckCircle2 className="h-10 w-10 text-indigo-500 animate-pulse" />
              <div className="absolute -top-1 -right-1 rounded-full bg-indigo-500 p-1 text-white shadow-xs">
                <Star className="h-4 w-4" />
              </div>
            </div>
          ) : (
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary ring-6 ring-primary/5">
              <Megaphone className="h-8 w-8" />
            </div>
          )}

          {/* Badge */}
          {isLevelUp ? (
            <Badge className="mb-3 bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/30 gap-1.5 px-3 py-1 font-semibold text-xs uppercase tracking-wider">
              <TrendingUp className="h-3.5 w-3.5" /> Promotion de niveau
            </Badge>
          ) : isWelcome ? (
            <Badge className="mb-3 bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-500/20 border-indigo-500/30 gap-1.5 px-3 py-1 font-semibold text-xs uppercase tracking-wider">
              <Star className="h-3.5 w-3.5" /> {popup.badgeText || "Compte Partenaire Actif"}
            </Badge>
          ) : (
            <Badge variant="outline" className="mb-3 px-3 py-1 text-xs uppercase tracking-wider">
              {popup.announcementType || "Annonce"}
            </Badge>
          )}

          {/* Title */}
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {popup.title}
          </h2>

          {/* Special Visual: Level Progression comparison */}
          {isLevelUp && (
            <div className="my-5 w-full rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-left">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-2">
                <span>Progression officielle</span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold">Validé par l&apos;Admin</span>
              </div>
              <div className="flex items-center justify-around gap-2 py-2">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Ancien niveau</div>
                  <div className="mt-1 text-lg font-bold text-muted-foreground line-through">
                    Niveau {oldLevel}
                  </div>
                </div>
                <div className="text-amber-500 font-bold text-xl">➔</div>
                <div className="text-center">
                  <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Nouveau statut</div>
                  <div className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">
                    Niveau {newLevel}
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-amber-500/20 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Nouveau taux de commission :</span>
                <span className="font-bold text-foreground text-base bg-amber-500/20 px-2.5 py-0.5 rounded-md text-amber-700 dark:text-amber-300">
                  {ratePercent} %
                </span>
              </div>
            </div>
          )}

          {/* Optional Image */}
          {popup.imageUrl && (
            <div className="my-4 h-48 w-full overflow-hidden rounded-xl bg-muted border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={popup.imageUrl}
                alt={popup.title}
                className="h-full w-full object-cover"
              />
            </div>
          )}

          {/* Body Message */}
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-muted-foreground">
            {popup.message}
          </p>

          {/* Actions */}
          <div className="mt-6 flex w-full flex-col sm:flex-row gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              Fermer
            </Button>
            <Button
              type="button"
              onClick={handleAction}
              className={`w-full flex-1 order-1 sm:order-2 gap-2 text-sm font-semibold shadow-md ${
                isLevelUp
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : isWelcome
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : ""
              }`}
            >
              <span>{popup.buttonText || "Continuer"}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
