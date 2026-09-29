"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Info, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { EmptyState } from "@/components/ui/empty-state";
import {
  removePerformanceLevel,
  savePerformanceLevel,
  type LevelActionState,
} from "./performance-actions";

export type LevelDTO = {
  id: string;
  name: string;
  description: string | null;
  sharePercentage: string;
  isActive: boolean;
  sortOrder: number;
  partnerCount: number;
};

const INITIAL: LevelActionState = { ok: false };

/** Toast + close the editor, then return whether the call succeeded. */
function report(res: LevelActionState, fallback: string): boolean {
  if (res.ok) toast.success(res.message ?? fallback);
  else toast.error(res.error ?? fallback);
  return res.ok;
}

const fieldClass =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function LevelFields({
  id,
  level,
}: {
  id: string;
  level?: LevelDTO;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor={`${id}-name`}>
            Nom
          </label>
          <input
            id={`${id}-name`}
            name="name"
            required
            maxLength={80}
            defaultValue={level?.name}
            className={fieldClass}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor={`${id}-share`}>
            Partage du profit (%)
          </label>
          <input
            id={`${id}-share`}
            name="sharePercentage"
            type="number"
            step="0.01"
            min={0}
            max={100}
            required
            defaultValue={level?.sharePercentage}
            className={fieldClass}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor={`${id}-sort`}>
            Priorité
          </label>
          <input
            id={`${id}-sort`}
            name="sortOrder"
            type="number"
            min={0}
            required
            defaultValue={level?.sortOrder ?? 0}
            className={fieldClass}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium" htmlFor={`${id}-desc`}>
          Description
        </label>
        <input
          id={`${id}-desc`}
          name="description"
          maxLength={500}
          defaultValue={level?.description ?? ""}
          className={fieldClass}
        />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={level ? level.isActive : true}
          className="h-4 w-4 rounded border-input"
        />
        Actif
      </label>
    </>
  );
}
export function PerformanceLevelsSection({
  levels,
  canEdit,
}: {
  levels: LevelDTO[];
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Build the FormData before the transition: `event.currentTarget` is only
  // valid during dispatch, not after an await.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const res = await savePerformanceLevel(INITIAL, formData);
      if (report(res, editingId ? "Niveau mis à jour." : "Niveau créé.")) {
        setEditingId(null);
        setShowCreate(false);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Niveaux de performance</CardTitle>
        <CardDescription>
          Les niveaux de performance déterminent le partage du profit. Chaque
          niveau porte un pourcentage appliqué au profit pool de la commande.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-info-100 bg-info-50 p-3 text-xs text-info-700">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Les conditions de progression sont configurables ici. Tant
            qu&apos;aucun niveau n&apos;est attribué à un partenaire, la règle de
            commission historique reste appliquée — aucun changement n&apos;est
            rétroactif sur les commandes existantes.
          </p>
        </div>

        {levels.length === 0 ? (
          <EmptyState
            title="Aucun niveau configuré"
            description="Créez un premier niveau pour activer la répartition par performance."
          />
        ) : (
          <ul className="divide-y rounded-lg border">
            {levels.map((l) => (
              <li key={l.id} className="p-3">
                {editingId === l.id ? (
                  <form
                    onSubmit={handleSubmit}
                    className="space-y-3"
                  >
                    <input type="hidden" name="id" value={l.id} />
                    <LevelFields id={`edit-${l.id}`} level={l} />
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={isPending}>
                        Enregistrer
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        Annuler
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{l.name}</p>
                        <Badge variant={l.isActive ? "success" : "secondary"}>
                          {l.isActive ? "Actif" : "Inactif"}
                        </Badge>
                        <Badge variant="info">{l.sharePercentage} % du profit</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Priorité {l.sortOrder} · {l.partnerCount} partenaire(s)
                        {l.description ? ` · ${l.description}` : ""}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(l.id)}
                        >
                          Modifier
                        </Button>
                        {l.partnerCount === 0 && (
                          <form action={removePerformanceLevel}>
                            <input type="hidden" name="id" value={l.id} />
                            <ConfirmSubmit
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              confirmMessage={`Supprimer le niveau « ${l.name} » ?`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </ConfirmSubmit>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && showCreate && (
          <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-lg border bg-muted/20 p-3"
          >
            <LevelFields id="new" />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isPending}>
                Créer le niveau
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCreate(false)}
              >
                Annuler
              </Button>
            </div>
          </form>
        )}

        {canEdit && !showCreate && (
          <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5" /> Ajouter un niveau
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
