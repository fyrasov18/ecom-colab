"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { deleteCategoryAction, type CategoryActionState } from "./actions";

type SimpleCategory = {
  id: string;
  name: string;
};

type Props = {
  category: {
    id: string;
    name: string;
    productCount: number;
  };
  availableCategories: SimpleCategory[];
  trigger?: React.ReactNode;
};

const initialState: CategoryActionState = { ok: false };

export function DeleteCategoryDialog({
  category,
  availableCategories,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const [, formAction, isPending] = useActionState(
    async (prev: CategoryActionState, formData: FormData) => {
      const result = await deleteCategoryAction(prev, formData);
      if (result.ok) {
        if (result.message) toast.success(result.message);
        setOpen(false);
      } else if (result.error) {
        toast.error(result.error);
      }
      return result;
    },
    initialState,
  );

  const otherCategories = availableCategories.filter((c) => c.id !== category.id);
  const hasProducts = category.productCount > 0;
  const canReassign = otherCategories.length > 0;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150"
          aria-describedby="delete-category-dialog-description"
        >
          <div className="flex items-start justify-between border-b pb-4">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-destructive/10 p-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <Dialog.Title className="text-base font-semibold text-foreground">
                Supprimer la catégorie
              </Dialog.Title>
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

          <form action={formAction} className="mt-4 space-y-4">
            <input type="hidden" name="id" value={category.id} />

            <div id="delete-category-dialog-description" className="space-y-3 text-sm">
              <p>
                Êtes-vous sûr de vouloir supprimer la catégorie{" "}
                <span className="font-semibold text-foreground">
                  &laquo; {category.name} &raquo;
                </span>{" "}
                ?
              </p>

              {hasProducts ? (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground space-y-2">
                  <div className="font-semibold flex items-center gap-1.5 text-warning">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Cette catégorie contient {category.productCount} produit(s)</span>
                  </div>
                  <p>
                    Pour protéger l&apos;intégrité de votre catalogue et éviter toute perte de données, vous devez réaffecter ces produits à une autre catégorie active.
                  </p>

                  {canReassign ? (
                    <div className="pt-2">
                      <Label htmlFor="reassign-select" className="text-xs font-medium text-foreground">
                        Réaffecter les {category.productCount} produit(s) vers : *
                      </Label>
                      <NativeSelect
                        id="reassign-select"
                        name="reassignToCategoryId"
                        required
                        className="mt-1.5 bg-card text-foreground"
                      >
                        <option value="">-- Choisir une catégorie cible --</option>
                        {otherCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  ) : (
                    <p className="text-destructive font-medium pt-1">
                      Aucune autre catégorie n&apos;est disponible. Veuillez d&apos;abord créer une autre catégorie avant de supprimer celle-ci.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Cette catégorie ne contient aucun produit. Sa suppression est sans danger immédiat.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isPending || (hasProducts && !canReassign)}
              >
                {isPending
                  ? "Suppression..."
                  : hasProducts
                  ? "Réaffecter et supprimer"
                  : "Supprimer"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
