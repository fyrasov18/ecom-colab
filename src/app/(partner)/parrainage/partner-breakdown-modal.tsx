"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Calculator, X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";

export interface PartnerBreakdownProps {
  commissionId: string;
  orderId?: string | null;
  amount: string | number;
  currency?: string;
  calculationDetails?: any;
  referredName?: string;
}

export function PartnerBreakdownModal({
  commissionId,
  orderId,
  amount,
  currency = "TND",
  calculationDetails,
  referredName,
}: PartnerBreakdownProps) {
  const [open, setOpen] = useState(false);

  const details =
    typeof calculationDetails === "string"
      ? (() => {
          try {
            return JSON.parse(calculationDetails);
          } catch {
            return null;
          }
        })()
      : calculationDetails;

  const revenue = details?.revenue ?? details?.R ?? null;
  const expenses = details?.expenses ?? details?.E ?? null;
  const profit = details?.profit ?? details?.P ?? null;
  const adminShare = details?.adminShare ?? details?.A ?? null;
  const remainingPool = details?.remainingPool ?? details?.B ?? null;
  const commissionRate = details?.commissionRate ?? details?.r ?? null;
  const referralCommission = details?.referralCommission ?? details?.C ?? amount;
  const referrerLevel = details?.referrerLevel ?? (details?.level || null);

  const ratePercent = commissionRate
    ? `${(Number(commissionRate) * 100).toFixed(0)}%`
    : referrerLevel
      ? referrerLevel === 3
        ? "15%"
        : referrerLevel === 2
          ? "10%"
          : "5%"
      : "5%";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 text-xs text-primary hover:text-primary hover:bg-primary/10">
          <Calculator className="h-3.5 w-3.5" />
          Détails ($R, E, P, A, B, C$)
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150"
          aria-describedby="partner-calc-description"
        >
          <div className="flex items-start justify-between border-b pb-4">
            <div>
              <Dialog.Title className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Transparence du calcul de vos gains
              </Dialog.Title>
              <Dialog.Description
                id="partner-calc-description"
                className="mt-1 text-xs text-muted-foreground"
              >
                Décomposition détaillée des recettes, dépenses et calcul de votre commission.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4 space-y-4 text-xs">
            {/* Meta info */}
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-3">
              {referredName && (
                <div>
                  <span className="text-muted-foreground">Filleul associé :</span>
                  <p className="font-semibold text-foreground truncate">{referredName}</p>
                </div>
              )}
              {orderId && (
                <div>
                  <span className="text-muted-foreground">Commande source :</span>
                  <p className="font-mono font-medium text-foreground truncate">{orderId}</p>
                </div>
              )}
            </div>

            {/* R, E, P, A, B, C breakdown */}
            <div className="divide-y rounded-lg border bg-card">
              <div className="flex items-center justify-between p-2.5">
                <div>
                  <span className="font-medium text-foreground">1. Chiffre d&apos;affaires collecté ($R$)</span>
                  <p className="text-muted-foreground">Revenu net réglé de la commande</p>
                </div>
                <span className="font-mono font-semibold text-foreground">
                  {revenue !== null ? formatMoney(revenue, { currency }) : "N/A"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5">
                <div>
                  <span className="font-medium text-foreground">2. Dépenses d&apos;exploitation ($E$)</span>
                  <p className="text-muted-foreground">Coûts d&apos;expédition et frais directs</p>
                </div>
                <span className="font-mono font-semibold text-danger-600">
                  {expenses !== null ? `-${formatMoney(expenses, { currency })}` : "N/A"}
                </span>
              </div>

              <div className="flex items-center justify-between bg-muted/20 p-2.5">
                <div>
                  <span className="font-semibold text-foreground">3. Marge bénéficiaire ($P = R - E$)</span>
                  <p className="text-muted-foreground">Bénéfice net d&apos;opération</p>
                </div>
                <span className="font-mono font-bold text-foreground">
                  {profit !== null ? formatMoney(profit, { currency }) : "N/A"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5">
                <div>
                  <span className="font-medium text-foreground">4. Part plateforme ($A = 70\% \times P$)</span>
                  <p className="text-muted-foreground">Part de gestion de la plateforme</p>
                </div>
                <span className="font-mono text-muted-foreground">
                  {adminShare !== null ? formatMoney(adminShare, { currency }) : "N/A"}
                </span>
              </div>

              <div className="flex items-center justify-between bg-primary/5 p-2.5">
                <div>
                  <span className="font-semibold text-primary">5. Pool éligible ($B = 30\% \times P$)</span>
                  <p className="text-muted-foreground">Assiette de votre commission (30%)</p>
                </div>
                <span className="font-mono font-bold text-primary">
                  {remainingPool !== null ? formatMoney(remainingPool, { currency }) : "N/A"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5">
                <div>
                  <span className="font-medium text-foreground">6. Votre taux ($r$)</span>
                  <p className="text-muted-foreground">
                    {referrerLevel ? `Selon votre Niveau ${referrerLevel}` : "Taux de votre palier"}
                  </p>
                </div>
                <Badge variant="secondary" className="font-mono font-bold">
                  {ratePercent}
                </Badge>
              </div>

              <div className="flex items-center justify-between bg-success-50/70 p-3">
                <div>
                  <span className="font-bold text-success-800">
                    7. Votre commission de parrainage ($C = B \times r$)
                  </span>
                  <p className="text-success-700">Montant crédité à votre compte</p>
                </div>
                <span className="font-mono text-base font-extrabold text-success-700">
                  {formatMoney(referralCommission, { currency })}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <Dialog.Close asChild>
              <Button type="button" variant="outline" size="sm">
                Fermer
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
