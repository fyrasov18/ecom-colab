"use client";

import { useActionState, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  FolderPlus,
  Pencil,
  X,
  Home,
  Smartphone,
  Utensils,
  Sparkles,
  Flame,
  Package,
  Shirt,
  Heart,
  Gift,
  Tag,
  ShoppingBag,
  Tv,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { saveCategoryAction, type CategoryActionState } from "./actions";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Home,
  Smartphone,
  Utensils,
  Sparkles,
  Flame,
  Package,
  Shirt,
  Heart,
  Gift,
  Tag,
  ShoppingBag,
  Tv,
  Briefcase,
};

export type CategoryData = {
  id: string;
  name: string;
  nameAr?: string | null;
  slug: string;
  description?: string | null;
  icon?: string | null;
  imageUrl?: string | null;
  displayOrder: number;
  isActive: boolean;
};

type Props = {
  category?: CategoryData;
  trigger?: React.ReactNode;
};

const initialState: CategoryActionState = { ok: false };

export function CategoryModal({ category, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(saveCategoryAction, initialState);
  const [selectedIcon, setSelectedIcon] = useState(category?.icon ?? "Package");
  const [isActive, setIsActive] = useState(category?.isActive ?? true);

  const isEditing = Boolean(category);

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      setOpen(false);
    } else if (!state.ok && state.error) {
      toast.error(state.error);
    }
  }, [state]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setSelectedIcon(category?.icon ?? "Package");
      setIsActive(category?.isActive ?? true);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-2">
            {isEditing ? (
              <>
                <Pencil className="h-4 w-4" /> Modifier
              </>
            ) : (
              <>
                <FolderPlus className="h-4 w-4" /> Nouvelle catégorie
              </>
            )}
          </Button>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
          aria-describedby="category-dialog-description"
        >
          <div className="flex items-start justify-between border-b pb-4">
            <div>
              <Dialog.Title className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                {isEditing ? (
                  <>
                    <Pencil className="h-5 w-5 text-primary" /> Modifier la catégorie
                  </>
                ) : (
                  <>
                    <FolderPlus className="h-5 w-5 text-primary" /> Nouvelle catégorie
                  </>
                )}
              </Dialog.Title>
              <Dialog.Description
                id="category-dialog-description"
                className="mt-1 text-xs text-muted-foreground"
              >
                {isEditing
                  ? "Mettez à jour les informations, l'icône et la visibilité de la catégorie."
                  : "Créez une nouvelle catégorie pour organiser le catalogue de produits."}
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

          <form action={formAction} className="mt-4 space-y-4">
            {category && <input type="hidden" name="id" value={category.id} />}
            <input type="hidden" name="icon" value={selectedIcon} />
            <input type="hidden" name="isActive" value={isActive ? "true" : "false"} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cat-name">Nom (Français) *</Label>
                <Input
                  id="cat-name"
                  name="name"
                  required
                  placeholder="ex: Cuisine & Électroménager"
                  defaultValue={category?.name ?? ""}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cat-nameAr">Nom (Arabe / العربية)</Label>
                <Input
                  id="cat-nameAr"
                  name="nameAr"
                  dir="rtl"
                  placeholder="مثال: المطبخ والأجهزة المنزلية"
                  defaultValue={category?.nameAr ?? ""}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cat-desc">Description</Label>
                <textarea
                  id="cat-desc"
                  name="description"
                  rows={2}
                  placeholder="Courte description de la catégorie..."
                  defaultValue={category?.description ?? ""}
                  className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Icône de la catégorie</Label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-1">
                  {Object.entries(CATEGORY_ICONS).map(([name, IconComponent]) => {
                    const isSelected = selectedIcon === name;
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setSelectedIcon(name)}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                            : "border-border hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        <IconComponent className="h-5 w-5 mb-1" />
                        <span className="truncate max-w-full text-[10px]">{name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cat-order">Ordre d&apos;affichage</Label>
                <Input
                  id="cat-order"
                  name="displayOrder"
                  type="number"
                  min="0"
                  defaultValue={category?.displayOrder ?? 0}
                />
                <p className="text-[11px] text-muted-foreground">
                  Plus le nombre est petit, plus la catégorie apparaît en premier.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cat-image">URL de l&apos;image (optionnel)</Label>
                <Input
                  id="cat-image"
                  name="imageUrl"
                  type="url"
                  placeholder="https://..."
                  defaultValue={category?.imageUrl ?? ""}
                />
              </div>

              <div className="sm:col-span-2 pt-2 border-t">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="cat-active"
                    checked={isActive}
                    onCheckedChange={(checked) => setIsActive(Boolean(checked))}
                  />
                  <Label htmlFor="cat-active" className="cursor-pointer font-medium">
                    Catégorie active
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  Si désactivée, cette catégorie et ses produits seront masqués du catalogue partenaire.
                </p>
              </div>
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
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? "Enregistrement..."
                  : isEditing
                  ? "Mettre à jour"
                  : "Créer la catégorie"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
