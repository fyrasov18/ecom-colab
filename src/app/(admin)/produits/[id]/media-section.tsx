"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
  uploadProductMedia,
  removeProductMedia,
  type ActionState,
} from "../actions";

type MediaItem = { id: string; type: string; url: string };

const initialState: ActionState = { ok: false };

export function MediaSection({
  productId,
  media,
}: {
  productId: string;
  media: MediaItem[];
}) {
  const [state, formAction] = useActionState(uploadProductMedia, initialState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);

  return (
    <section className="space-y-4" id="medias">
      <h2 className="text-base font-semibold">Médias</h2>

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="productId" value={productId} />
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="media-file">Fichier</label>
          <input
            id="media-file"
            name="file"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="media-type">Type</label>
          <NativeSelect id="media-type" name="type" className="w-40">
            <option value="IMAGE">Image</option>
            <option value="THUMBNAIL">Miniature</option>
            <option value="VIDEO">Vidéo</option>
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline">
          <ImagePlus className="h-4 w-4" /> Ajouter
        </Button>
      </form>

      {media.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun média. Formats : JPG, PNG, WEBP, GIF, MP4, WEBM, MOV — 25 Mo max.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {media.map((m) => (
            <figure key={m.id} className="group relative overflow-hidden rounded-lg border">
              {m.type === "VIDEO" ? (
                <video src={m.url} className="h-32 w-full object-cover" controls muted />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" className="h-32 w-full object-cover" />
              )}
              <figcaption className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                {m.type}
              </figcaption>
              <form
                action={removeProductMedia}
                className="absolute right-1 top-1"
                aria-label="Supprimer"
              >
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="productId" value={productId} />
                <button
                  type="submit"
                  className="rounded bg-red-600/90 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-red-700"
                >
                  Suppr.
                </button>
              </form>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
