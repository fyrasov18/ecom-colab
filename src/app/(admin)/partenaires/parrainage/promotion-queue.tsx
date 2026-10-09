"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Award, ArrowUpRight, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  confirmPromotionAction,
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

  useActionToast(state);

  return (
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
        <form action={action}>
          <input type="hidden" name="partnerId" value={candidate.partnerId} />
          <input type="hidden" name="targetLevel" value={String(candidate.targetLevel)} />
          <Button
            type="submit"
            size="sm"
            variant="default"
            disabled={pending}
            className="gap-1 text-xs bg-amber-600 hover:bg-amber-700 text-white"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            Confirmer la promotion
          </Button>
        </form>
      </td>
    </tr>
  );
}

export function PromotionQueueTable({ candidates }: { candidates: PromotionCandidate[] }) {
  if (candidates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
        <Award className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
        <p className="text-sm font-medium">Aucun partenaire en attente de promotion</p>
        <p className="text-xs text-muted-foreground mt-1">
          Tous les partenaires ayant atteint les seuils de parrainage (3 ou 10) sont à jour.
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
