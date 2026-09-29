"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Link as LinkIcon,
  ExternalLink,
  Pencil,
  Trash2,
  MoveUp,
  MoveDown,
  Eye,
  Video,
  Image as ImageIcon,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import {
  addGoogleDriveMedia,
  editGoogleDriveMedia,
  removeProductMedia,
  reorderProductMediaAction,
  type ActionState,
} from "../actions";
import { deriveGoogleDriveUrls } from "@/lib/google-drive";

export type MediaItem = {
  id: string;
  type: "IMAGE" | "VIDEO" | "THUMBNAIL" | string;
  googleDriveUrl: string;
  title: string | null;
  sortOrder: number;
};

const NEUTRAL_STATE: ActionState = { ok: false };

function report(res: ActionState, fallback: string): boolean {
  if (res.ok) toast.success(res.message ?? fallback);
  else toast.error(res.error ?? fallback);
  return res.ok;
}

export function MediaSection({
  productId,
  media,
}: {
  productId: string;
  media: MediaItem[];
}) {
  const [isAdding, startAddTransition] = useTransition();
  const [isEditing, startEditTransition] = useTransition();
  const [isPendingOrder, startOrderTransition] = useTransition();

  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<"IMAGE" | "VIDEO" | "THUMBNAIL">("IMAGE");

  const draftDerived = newUrl.trim() ? deriveGoogleDriveUrls(newUrl.trim()) : null;

  const handleAddSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draftDerived) {
      toast.error("Lien Google Drive invalide — collez le lien de partage du fichier.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    startAddTransition(async () => {
      const res = await addGoogleDriveMedia(NEUTRAL_STATE, formData);
      if (report(res, "Média ajouté.")) {
        setNewUrl("");
        setNewTitle("");
      }
    });
  };

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startEditTransition(async () => {
      const res = await editGoogleDriveMedia(NEUTRAL_STATE, formData);
      if (report(res, "Média modifié.")) setEditingId(null);
    });
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= media.length) return;

    const reordered = [...media];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const ids = reordered.map((m) => m.id);
    startOrderTransition(async () => {
      const res = await reorderProductMediaAction(productId, ids);
      if (res.ok && res.message) toast.success(res.message);
      else if (!res.ok && res.error) toast.error(res.error);
    });
  };

  return (
    <section className="space-y-4" id="medias">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Médias (Google Drive)</h2>
          <p className="text-xs text-muted-foreground">
            Associez des fichiers Google Drive partagés (images de haute qualité, vidéos publicitaires, miniatures).
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {media.length} élément{media.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Add Media Form */}
      <form onSubmit={handleAddSubmit} className="rounded-lg border bg-card p-4 space-y-3">
        <input type="hidden" name="productId" value={productId} />
        <div className="grid gap-3 sm:grid-cols-12 items-end">
          <div className="sm:col-span-5 space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="drive-url">
              Lien de partage Google Drive <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <LinkIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="drive-url"
                name="googleDriveUrl"
                type="url"
                required
                placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                className="pl-8 text-sm"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="sm:col-span-3 space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="media-title">
              Titre / Libellé (optionnel)
            </label>
            <Input
              id="media-title"
              name="title"
              placeholder="Ex: Face avant, Démo vidéo..."
              className="text-sm"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="media-type">
              Type
            </label>
            <NativeSelect
              id="media-type"
              name="type"
              value={newType}
              onChange={(e) => setNewType(e.target.value as "IMAGE" | "VIDEO" | "THUMBNAIL")}
              className="w-full text-sm"
            >
              <option value="IMAGE">Image</option>
              <option value="THUMBNAIL">Miniature</option>
              <option value="VIDEO">Vidéo</option>
            </NativeSelect>
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={isAdding || !newUrl.trim()} className="w-full text-sm">
              {isAdding ? "Ajout..." : "Ajouter média"}
            </Button>
          </div>
        </div>

        {/* Live validation feedback for new URL */}
        {newUrl.trim() && (
          <div className="mt-2 rounded-md bg-muted/60 p-2.5 text-xs">
            {draftDerived ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                  <Check className="h-3.5 w-3.5" /> ID Drive détecté :{" "}
                  <code className="bg-emerald-50 dark:bg-emerald-950/40 px-1 py-0.5 rounded text-[11px]">
                    {draftDerived.fileId}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={draftDerived.normalizedViewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Tester le lien Drive
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-amber-600">
                <AlertCircle className="h-3.5 w-3.5" />
                Format non reconnu. Assurez-vous d&apos;utiliser un lien de fichier Google Drive avec accès lecteur.
              </div>
            )}
          </div>
        )}
      </form>

      {/* Media List */}
      {media.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aucun média Google Drive configuré pour ce produit.
          <br />
          Ajoutez des liens de partage Drive pour alimenter le kit marketing des partenaires.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((item, index) => {
            const derived = deriveGoogleDriveUrls(item.googleDriveUrl);
            const isEditingItem = editingId === item.id;

            return (
              <div
                key={item.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-lg border bg-card p-3 shadow-sm transition hover:shadow-md"
              >
                {/* Header row: badge and reordering / actions */}
                <div className="flex items-center justify-between gap-1 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={item.type === "VIDEO" ? "info" : "outline"} className="text-[10px] uppercase">
                      {item.type === "VIDEO" ? (
                        <Video className="mr-1 h-3 w-3 inline" />
                      ) : (
                        <ImageIcon className="mr-1 h-3 w-3 inline" />
                      )}
                      {item.type}
                    </Badge>
                    <span className="text-[11px] font-mono text-muted-foreground">#{index + 1}</span>
                  </div>

                  {/* Reorder and quick actions */}
                  <div className="flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={index === 0 || isPendingOrder}
                      onClick={() => handleMove(index, "up")}
                      title="Monter"
                    >
                      <MoveUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={index === media.length - 1 || isPendingOrder}
                      onClick={() => handleMove(index, "down")}
                      title="Descendre"
                    >
                      <MoveDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setEditingId(isEditingItem ? null : item.id)}
                      title="Modifier"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <form action={removeProductMedia}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="productId" value={productId} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                  </div>
                </div>


                {/* Edit Form if open */}
                {isEditingItem ? (
                  <form
                    onSubmit={handleEditSubmit}
                    className="my-2 space-y-2 rounded border bg-muted/40 p-2.5 text-xs"
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="productId" value={productId} />
                    <div>
                      <label className="font-medium text-foreground">Lien Drive</label>
                      <Input
                        name="googleDriveUrl"
                        defaultValue={item.googleDriveUrl}
                        required
                        className="mt-1 h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-medium text-foreground">Titre</label>
                      <Input
                        name="title"
                        defaultValue={item.title ?? ""}
                        placeholder="Titre..."
                        className="mt-1 h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-medium text-foreground">Type</label>
                      <NativeSelect name="type" defaultValue={item.type} className="mt-1 h-8 text-xs">
                        <option value="IMAGE">Image</option>
                        <option value="THUMBNAIL">Miniature</option>
                        <option value="VIDEO">Vidéo</option>
                      </NativeSelect>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="mr-1 h-3 w-3" /> Annuler
                      </Button>
                      <Button type="submit" size="sm" disabled={isEditing} className="h-7 px-2 text-xs">
                        <Check className="mr-1 h-3 w-3" /> Enregistrer
                      </Button>
                    </div>
                  </form>
                ) : (
                  /* Preview Card Body */
                  <div className="space-y-2 py-1">
                    <div
                      className="relative flex h-36 w-full cursor-pointer items-center justify-center overflow-hidden rounded border bg-muted/30 group-hover:bg-muted/50"
                      onClick={() => setPreviewMedia(item)}
                      title="Aperçu interactif"
                    >
                      {derived ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={derived.previewUrl}
                          alt={item.title ?? "Média Drive"}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : null}
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 text-white opacity-0 transition group-hover:opacity-100">
                        <Eye className="h-6 w-6 mb-1" />
                        <span className="text-[11px] font-medium">Cliquer pour prévisualiser</span>
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <p className="line-clamp-1 text-xs font-medium text-foreground">
                        {item.title || "Sans libellé"}
                      </p>
                      <p className="line-clamp-1 font-mono text-[11px] text-muted-foreground" title={item.googleDriveUrl}>
                        {derived ? `ID: ${derived.fileId}` : item.googleDriveUrl}
                      </p>
                    </div>
                  </div>
                )}

                {/* Footer links */}
                <div className="mt-2 flex items-center justify-between border-t pt-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setPreviewMedia(item)}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Eye className="h-3 w-3" /> Aperçu
                  </button>
                  {derived && (
                    <a
                      href={derived.normalizedViewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" /> Ouvrir dans Drive
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Modal Preview Dialog */}
      {previewMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in"
          onClick={() => setPreviewMedia(null)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <Badge variant={previewMedia.type === "VIDEO" ? "info" : "outline"} className="text-xs">
                  {previewMedia.type}
                </Badge>
                <h3 className="font-semibold text-sm">
                  {previewMedia.title || "Prévisualisation du média Google Drive"}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setPreviewMedia(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Modal Body: Embedded Player / Viewer */}
            <div className="relative aspect-video w-full bg-black">
              {(() => {
                const derived = deriveGoogleDriveUrls(previewMedia.googleDriveUrl);
                if (!derived) {
                  return (
                    <div className="flex h-full items-center justify-center text-sm text-white">
                      URL Drive non reconnue
                    </div>
                  );
                }
                return (
                  <iframe
                    src={derived.embedUrl}
                    className="h-full w-full border-0"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    title={previewMedia.title ?? "Aperçu Google Drive"}
                  />
                );
              })()}
            </div>

            {/* Modal Footer with Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 px-4 py-3 text-xs">
              {(() => {
                const derived = deriveGoogleDriveUrls(previewMedia.googleDriveUrl);
                if (!derived) return null;
                return (
                  <>
                    <div className="flex items-center gap-2 text-muted-foreground font-mono">
                      <span>ID : {derived.fileId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={derived.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Télécharger directement
                      </a>
                      <a
                        href={derived.normalizedViewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Ouvrir dans Google Drive
                      </a>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
