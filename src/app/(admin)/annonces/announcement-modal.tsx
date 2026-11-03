"use client";

import { useActionState, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Eye, Megaphone, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { saveAnnouncementAction, type AdminAnnouncementActionState } from "./actions";
import { NotificationPreviewModal } from "./preview-modal";

export type AnnouncementData = {
  id: string;
  title: string;
  content: string;
  type: string;
  imageUrl?: string | null;
  buttonText?: string | null;
  buttonUrl?: string | null;
  targetAudience: string;
  status: string;
  scheduledAt?: Date | string | null;
  isFullScreen: boolean;
};

type Props = {
  announcement?: AnnouncementData;
  trigger?: React.ReactNode;
};

const initialState: AdminAnnouncementActionState = { ok: false };

export function AnnouncementModal({ announcement, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(saveAnnouncementAction, initialState);

  // Form state for live preview
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [content, setContent] = useState(announcement?.content ?? "");
  const [buttonText, setButtonText] = useState(announcement?.buttonText ?? "Découvrir");
  const [buttonUrl, setButtonUrl] = useState(announcement?.buttonUrl ?? "/catalogue");
  const [imageUrl, setImageUrl] = useState(announcement?.imageUrl ?? "");
  const [status, setStatus] = useState(announcement?.status ?? "DRAFT");
  const [isFullScreen, setIsFullScreen] = useState(announcement?.isFullScreen ?? true);

  const isEditing = Boolean(announcement);

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
    if (newOpen && announcement) {
      setTitle(announcement.title);
      setContent(announcement.content);
      setButtonText(announcement.buttonText ?? "Découvrir");
      setButtonUrl(announcement.buttonUrl ?? "/catalogue");
      setImageUrl(announcement.imageUrl ?? "");
      setStatus(announcement.status);
      setIsFullScreen(announcement.isFullScreen);
    }
  };

  const formattedScheduledDate = announcement?.scheduledAt
    ? new Date(announcement.scheduledAt).toISOString().slice(0, 16)
    : "";

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
                <Plus className="h-4 w-4" /> Nouvelle annonce
              </>
            )}
          </Button>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
          aria-describedby="announcement-modal-description"
        >
          <div className="flex items-start justify-between border-b pb-4">
            <div>
              <Dialog.Title className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                {isEditing ? "Modifier l'annonce" : "Nouvelle annonce partenaire"}
              </Dialog.Title>
              <Dialog.Description
                id="announcement-modal-description"
                className="mt-1 text-xs text-muted-foreground"
              >
                Diffusez une actualité, une offre ou une mise en avant produit auprès de vos partenaires.
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
            {announcement && <input type="hidden" name="id" value={announcement.id} />}
            <input type="hidden" name="isFullScreen" value={isFullScreen ? "true" : "false"} />

            <div className="space-y-1.5">
              <Label htmlFor="ann-title">Titre de l&apos;annonce *</Label>
              <Input
                id="ann-title"
                name="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ex: Arrivage massif : Nouveaux produits gagnants disponibles !"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ann-content">Message / Contenu *</Label>
              <textarea
                id="ann-content"
                name="content"
                required
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Détaillez votre annonce, les conseils ou les opportunités à saisir..."
                className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ann-type">Catégorie d&apos;annonce</Label>
                <NativeSelect id="ann-type" name="type" defaultValue={announcement?.type ?? "INFO"}>
                  <option value="PRODUCT">⭐ Produit du catalogue</option>
                  <option value="PROMO">🔥 Opportunité / Promotion</option>
                  <option value="INFO">📢 Actualité plateforme</option>
                  <option value="FEATURE">✨ Nouvelle fonctionnalité</option>
                  <option value="TRAINING">🎓 Formation &amp; Conseils</option>
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ann-audience">Ciblage des partenaires</Label>
                <NativeSelect
                  id="ann-audience"
                  name="targetAudience"
                  defaultValue={announcement?.targetAudience ?? "ALL"}
                >
                  <option value="ALL">Tous les partenaires</option>
                  <option value="ACTIVE_ONLY">Partenaires actifs uniquement</option>
                  <option value="LEVEL_1">Partenaires Niveau 1 uniquement</option>
                  <option value="LEVEL_2">Partenaires Niveau 2 uniquement</option>
                  <option value="LEVEL_3">Partenaires Niveau 3 uniquement</option>
                  <option value="LEVEL_4">Partenaires Niveau 4 uniquement</option>
                  <option value="LEVEL_5">Partenaires Niveau 5 uniquement</option>
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ann-btnText">Texte du bouton (CTA)</Label>
                <Input
                  id="ann-btnText"
                  name="buttonText"
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  placeholder="ex: Voir le catalogue"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ann-btnUrl">Lien du bouton</Label>
                <Input
                  id="ann-btnUrl"
                  name="buttonUrl"
                  value={buttonUrl}
                  onChange={(e) => setButtonUrl(e.target.value)}
                  placeholder="/catalogue ou https://..."
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ann-image">URL de l&apos;image (optionnel)</Label>
                <Input
                  id="ann-image"
                  name="imageUrl"
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                />
                <p className="text-[11px] text-muted-foreground">
                  Lien direct d&apos;image (.png, .jpg, .webp). Les liens de partage (Kommodo, etc.) sont convertis automatiquement.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ann-status">Statut de publication</Label>
                <NativeSelect
                  id="ann-status"
                  name="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="DRAFT">Brouillon (non diffusé)</option>
                  <option value="PUBLISHED">Publier immédiatement</option>
                  <option value="SCHEDULED">Programmer pour plus tard</option>
                  <option value="ARCHIVED">Archivé</option>
                </NativeSelect>
              </div>

              {status === "SCHEDULED" && (
                <div className="space-y-1.5">
                  <Label htmlFor="ann-scheduledAt">Date et heure de diffusion *</Label>
                  <Input
                    id="ann-scheduledAt"
                    name="scheduledAt"
                    type="datetime-local"
                    required
                    defaultValue={formattedScheduledDate}
                  />
                </div>
              )}

              <div className="sm:col-span-2 pt-2 border-t">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ann-fullscreen"
                    checked={isFullScreen}
                    onCheckedChange={(checked) => setIsFullScreen(Boolean(checked))}
                  />
                  <Label htmlFor="ann-fullscreen" className="cursor-pointer font-medium text-sm">
                    Afficher en notification plein écran au démarrage
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  S&apos;affichera une seule fois par partenaire sous forme de popup immersive à sa prochaine visite.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
              <NotificationPreviewModal
                type="ANNOUNCEMENT"
                title={title || "Titre de votre annonce"}
                message={content || "Contenu descriptif de l'annonce..."}
                buttonText={buttonText || "Consulter"}
                buttonUrl={buttonUrl || "/catalogue"}
                imageUrl={imageUrl || undefined}
                trigger={
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 w-full sm:w-auto">
                    <Eye className="h-4 w-4" /> Prévisualiser l&apos;aperçu
                  </Button>
                }
              />

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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
                    : "Créer l'annonce"}
                </Button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
