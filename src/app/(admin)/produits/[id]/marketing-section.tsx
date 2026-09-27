"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { addMarketingAsset, removeMarketingAsset, type ActionState } from "../actions";

type Asset = {
  id: string;
  kind: string;
  title: string | null;
  content: string | null;
  mediaUrl: string | null;
};

const KIND_LABELS: Record<string, string> = {
  AD_COPY: "Argumentaire",
  HOOK: "Hook",
  CAPTION: "Caption",
  DESCRIPTION: "Description",
  SCRIPT: "Script de vente",
  FAQ: "FAQ",
  CREATIVE: "Créa",
};

const initialState: ActionState = { ok: false };

export function MarketingSection({
  productId,
  assets,
}: {
  productId: string;
  assets: Asset[];
}) {
  const [state, formAction] = useActionState(addMarketingAsset, initialState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);

  return (
    <section className="space-y-4" id="marketing">
      <h2 className="text-base font-semibold">Kit marketing</h2>

      <form action={formAction} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
        <input type="hidden" name="productId" value={productId} />
        <div className="space-y-1.5">
          <Label htmlFor="mk-kind">Type</Label>
          <NativeSelect id="mk-kind" name="kind" defaultValue="AD_COPY">
            {Object.entries(KIND_LABELS).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mk-title">Titre (optionnel)</Label>
          <Input id="mk-title" name="title" maxLength={160} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="mk-content">Contenu (texte, script, FAQ…)</Label>
          <textarea
            id="mk-content"
            name="content"
            rows={3}
            maxLength={10000}
            className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="mk-media">URL média (visuel, optionnel)</Label>
          <Input id="mk-media" name="mediaUrl" maxLength={500} placeholder="https://…" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" variant="outline" size="sm">
            <Plus className="h-4 w-4" /> Ajouter au kit
          </Button>
        </div>
      </form>

      {assets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun élément marketing pour ce produit.
        </p>
      ) : (
        <ul className="space-y-3">
          {assets.map((a) => (
            <li key={a.id} className="rounded-lg border p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="info">{KIND_LABELS[a.kind] ?? a.kind}</Badge>
                  {a.title && <span className="text-sm font-medium">{a.title}</span>}
                </div>
                <form action={removeMarketingAsset}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="productId" value={productId} />
                  <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                    Supprimer
                  </Button>
                </form>
              </div>
              {a.content && (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.content}</p>
              )}
              {a.mediaUrl && (
                <a
                  href={a.mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-sm text-primary underline-offset-2 hover:underline"
                >
                  Ouvrir le média
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
