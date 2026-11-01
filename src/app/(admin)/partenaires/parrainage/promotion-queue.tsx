"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Award, ArrowUpRight, Loader2, Sparkles, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  confirmPromotionAction,
  rejectPromotionAction,
  type AdminCommissionActionState,
} from "./actions";

const initialState: AdminCommissionActionState = { ok: false };

function useActionToast(state: AdminCommissionActionState) {
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);
}

export type PromotionCandidate = {
  partnerId: string;
  displayName: string;
  code: string;
  email?: string;
  currentLevel: number;
  targetLevel: number;
  qualifiedCount: number;
  threshold: number;
  currentRate: string;
  targetRate: string;
};

function PromotionRow({ candidate }: { candidate: PromotionCandidate }) {
  const [state, action, pending] = useActionState(confirmPromotionAction, initialState);
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectPromotionAction, initialState);
  const [isRejecting, setIsRejecting] = useState(false);
  const [reason, setReason] = useState("");

  useActionToast(state);
  useActionToast(rejectState);

  useEffect(() => {
    if (rejectState.ok) {
      setIsRejecting(false);
      setReason("");
    }
  }, [rejectState]);

  return (
    <>
      <tr className="hover:bg-muted/50 border-b transition-colors text-xs">
        <td className="p-3 font-medium">
          <div>
            <span className="font-semibold text-foreground">{candidate.displayName}</span>
            <span className="ml-1 text-[11px] font-mono text-muted-foreground">({candidate.code})</span>
          </div>
          {candidate.email && (
            <p className="text-[11px] text-muted-foreground">{candidate.email}</p>
          )}
        </td>

        <td className="p-3">
          <Badge variant="outline" className="font-mono text-xs">
            Niveau {candidate.currentLevel} ({candidate.currentRate})
          </Badge>
        </td>

        <td className="p-3 font-mono">
          <span className="font-bold text-foreground">{candidate.qualifiedCount}</span>
          <span className="text-muted-foreground"> / {candidate.threshold} qualifiés</span>
        </td>

        <td className="p-3">
          <Badge variant="success" className="gap-1 font-mono text-xs">
            <ArrowUpRight className="h-3 w-3" />
            Niveau {candidate.targetLevel} ({candidate.targetRate})
          </Badge>
        </td>

        <td className="p-3">
          {!isRejecting ? (
            <div className="flex items-center gap-2">
              <form action={action}>
                <input type="hidden" name="partnerId" value={candidate.partnerId} />
                <input type="hidden" name="targetLevel" value={String(candidate.targetLevel)} />
                <Button
                  type="submit"
                  size="sm"
                  variant="default"
                  disabled={pending || rejectPending}
                  className="gap-1 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {pending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Confirmer
                </Button>
              </form>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || rejectPending}
                onClick={() => setIsRejecting(true)}
                className="gap-1 text-xs text-destructive hover:bg-destructive/10 border-destructive/20"
              >
                Rejeter
              </Button>
            </div>
          ) : (
            <form action={rejectAction} className="flex flex-col gap-2 min-w-[280px]">
              <input type="hidden" name="partnerId" value={candidate.partnerId} />
              <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Motif du refus obligatoire :</span>
              </div>
              <Input
                name="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex : Commandes non conformes, vérification en cours..."
                className="h-8 text-xs bg-background"
                required
              />
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  size="sm"
                  variant="destructive"
                  disabled={!reason.trim() || rejectPending}
                  className="gap-1 text-xs h-7 px-2"
                >
                  {rejectPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  Confirmer le rejet
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={rejectPending}
                  onClick={() => {
                    setIsRejecting(false);
                    setReason("");
                  }}
                  className="text-xs h-7 px-2 gap-1"
                >
                  <X className="h-3 w-3" />
                  Annuler
                </Button>
              </div>
            </form>
          )}
        </td>
      </tr>
    </>
  );
}

export function PromotionQueueTable({ candidates }: { candidates: PromotionCandidate[] }) {
  if (candidates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
        <Award className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
        <p className="text-sm font-medium">Aucun partenaire en attente de promotion</p>
        <p className="text-xs text-muted-foreground mt-1">
          Tous les partenaires ayant atteint les seuils de parrainage (10, 100, 300 ou 900 qualifiés) sont à jour.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-soft">
      <table className="w-full text-left">
        <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground">
          <tr>
            <th className="p-3">Partenaire</th>
            <th className="p-3">Niveau actuel</th>
            <th className="p-3">Filleuls qualifiés</th>
            <th className="p-3">Niveau éligible</th>
            <th className="p-3">Action d&apos;attribution</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {candidates.map((c) => (
            <PromotionRow key={c.partnerId} candidate={c} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
