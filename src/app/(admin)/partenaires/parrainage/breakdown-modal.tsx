"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Calculator, X, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";

export interface CalculationBreakdownProps {
  commissionId: string;
  orderId?: string | null;
  amount: string | number;
  currency?: string;
  calculationDetails?: any;
  referrerName?: string;
  referredName?: string;
  triggerLabel?: string;
  triggerVariant?: "outline" | "ghost" | "default" | "secondary";
  triggerSize?: "sm" | "default" | "icon";
}

export function CalculationBreakdownModal({
  commissionId,
  orderId,
  amount,
  currency = "TND",
  calculationDetails,
  referrerName,
  referredName,
  triggerLabel = "Détail du calcul",
  triggerVariant = "outline",
  triggerSize = "sm",
}: CalculationBreakdownProps) {
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
  const referralCommission =
    details?.referralCommission ?? details?.C ?? amount;
  const balanceAfterCommission = details?.balanceAfterCommission ?? null;
  const referrerLevel = details?.referrerLevel ?? (details?.level || null);
  const isProfitable = details?.isProfitable ?? (profit ? Number(profit) > 0 : true);

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
        <Button variant={triggerVariant} size={triggerSize} className="gap-1.5 text-xs">
          <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
          {triggerLabel}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150"
          aria-describedby="calculation-modal-description"
        >
          <div className="flex items-start justify-between border-b pb-4">
            <div>
              <Dialog.Title className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" aria-hidden="true" />
                Décomposition financière ($R, E, P, A, B, C$)
              </Dialog.Title>
              <Dialog.Description
                id="calculation-modal-description"
                className="mt-1 text-xs text-muted-foreground"
              >
                Transparence du calcul de profit sharing et commission de parrainage.
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

          <div className="mt-4 space-y-4 text-sm">
            {/* Context meta */}
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-xs">
              <div>
                <span className="text-muted-foreground">Commission ID:</span>
                <p className="font-mono font-medium truncate">{commissionId}</p>
              </div>
              {orderId && (
                <div>
                  <span className="text-muted-foreground">Commande liée:</span>
                  <p className="font-mono font-medium truncate">{orderId}</p>
                </div>
              )}
              {referrerName && (
                <div>
                  <span className="text-muted-foreground">Parrain:</span>
                  <p className="font-medium truncate">{referrerName}</p>
                </div>
              )}
              {referredName && (
                <div>
                  <span className="text-muted-foreground">Filleul:</span>
                  <p className="font-medium truncate">{referredName}</p>
                </div>
              )}
            </div>

            {/* Formula Explanation Banner */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-primary">
                <Info className="h-3.5 w-3.5" />
                <span>Règle comptable : $P = R - E \implies A = 70\% \times P, B = 30\% \times P, C = B \times r$</span>
              </div>
              <p className="text-muted-foreground">
                La commission est prélevée uniquement sur le pool restant $B$ (30%), jamais sur le bénéfice brut avant la part admin.
              </p>
            </div>

            {/* Variables breakdown Table */}
            <div className="divide-y rounded-lg border bg-card text-xs">
              <div className="flex items-center justify-between p-2.5">
                <div>
                  <span className="font-semibold text-foreground">Revenu encaissé ($R$)</span>
                  <p className="text-muted-foreground">Chiffre d&apos;affaires collecté / réglé</p>
                </div>
                <span className="font-mono font-semibold text-foreground">
                  {revenue !== null ? formatMoney(revenue, { currency }) : "N/A"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5">
                <div>
                  <span className="font-semibold text-foreground">Dépenses imputables ($E$)</span>
                  <p className="text-muted-foreground">Coûts et dépenses d&apos;exploitation approuvés</p>
                </div>
                <span className="font-mono font-semibold text-danger-600">
                  {expenses !== null ? `-${formatMoney(expenses, { currency })}` : "N/A"}
                </span>
              </div>

              <div className="flex items-center justify-between bg-muted/30 p-2.5">
                <div>
                  <span className="font-bold text-foreground">Bénéfice net ($P = R - E$)</span>
                  <p className="text-muted-foreground">Bénéfice avant répartition</p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-foreground">
                    {profit !== null ? formatMoney(profit, { currency }) : "N/A"}
                  </span>
                  {!isProfitable && (
                    <Badge variant="destructive" className="ml-2 text-[10px]">
                      Déficit (P ≤ 0)
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5">
                <div>
                  <span className="font-semibold text-foreground">Part Admin ($A = 70\% \times P$)</span>
                  <p className="text-muted-foreground">Part revenant à la plateforme (70%)</p>
                </div>
                <span className="font-mono font-semibold text-foreground">
                  {adminShare !== null ? formatMoney(adminShare, { currency }) : "N/A"}
                </span>
              </div>

              <div className="flex items-center justify-between bg-primary/5 p-2.5">
                <div>
                  <span className="font-semibold text-primary">Pool restant ($B = 30\% \times P$)</span>
                  <p className="text-muted-foreground">Assiette de calcul de commission (30%)</p>
                </div>
                <span className="font-mono font-bold text-primary">
                  {remainingPool !== null ? formatMoney(remainingPool, { currency }) : "N/A"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5">
                <div>
                  <span className="font-semibold text-foreground">Taux de parrainage ($r$)</span>
                  <p className="text-muted-foreground">
                    {referrerLevel ? `Niveau ${referrerLevel}` : "Taux selon le niveau du parrain"}
                  </p>
                </div>
                <Badge variant="secondary" className="font-mono font-bold">
                  {ratePercent}
                </Badge>
              </div>

              <div className="flex items-center justify-between bg-success-50/60 p-3">
                <div>
                  <span className="font-bold text-success-800">
                    Commission calculée ($C = B \times r$)
                  </span>
                  <p className="text-success-700">Montant net attribué au parrain</p>
                </div>
                <span className="font-mono text-base font-extrabold text-success-700">
                  {formatMoney(referralCommission, { currency })}
                </span>
              </div>

              {balanceAfterCommission !== null && (
                <div className="flex items-center justify-between p-2.5 text-muted-foreground">
                  <div>
                    <span>Solde pool après commission ($B - C$)</span>
                  </div>
                  <span className="font-mono">
                    {formatMoney(balanceAfterCommission, { currency })}
                  </span>
                </div>
              )}
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
