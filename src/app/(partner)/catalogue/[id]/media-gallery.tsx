"use client";

import { useState } from "react";
import {
  Download,
  ExternalLink,
  Eye,
  Video,
  Image as ImageIcon,
  X,
  Play,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deriveGoogleDriveUrls } from "@/lib/google-drive";

export type PartnerMediaItem = {
  id: string;
  type: string;
  googleDriveUrl: string;
  title: string | null;
  sortOrder: number;
};

export function PartnerMediaGallery({ media }: { media: PartnerMediaItem[] }) {
  const [previewItem, setPreviewItem] = useState<PartnerMediaItem | null>(null);

  if (media.length === 0) return null;

  const images = media.filter((m) => m.type !== "VIDEO");
  const videos = media.filter((m) => m.type === "VIDEO");

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm" id="materiels-marketing">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Supports visuels &amp; vidéos marketing</h2>
        </div>
        <span className="text-xs text-muted-foreground font-medium">
          {images.length} visuel{images.length > 1 ? "s" : ""} · {videos.length} vidéo{videos.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Images section */}
      {images.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ImageIcon className="h-3.5 w-3.5 text-primary" /> Photos &amp; Miniatures
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((item) => {
              const derived = deriveGoogleDriveUrls(item.googleDriveUrl);
              return (
                <div
                  key={item.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-lg border bg-muted/20 transition hover:border-primary/50 hover:shadow-sm"
                >
                  <div
                    className="relative h-36 w-full cursor-pointer overflow-hidden bg-muted"
                    onClick={() => setPreviewItem(item)}
                    title="Aperçu grand format"
                  >
                    {derived ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={derived.previewUrl}
                        alt={item.title ?? "Visuel produit"}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : null}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition group-hover:opacity-100">
                      <span className="inline-flex items-center gap-1 rounded bg-black/75 px-2 py-1 text-xs text-white">
                        <Eye className="h-3 w-3" /> Voir
                      </span>
                    </div>
                    <Badge variant="outline" className="absolute left-1.5 top-1.5 bg-background/90 text-[10px]">
                      {item.type}
                    </Badge>
                  </div>

                  <div className="p-2 space-y-1.5">
                    <p className="line-clamp-1 text-xs font-medium" title={item.title ?? undefined}>
                      {item.title || "Visuel promotionnel"}
                    </p>
                    <div className="flex items-center justify-between gap-1 pt-1 border-t text-[11px]">
                      {derived ? (
                        <a
                          href={derived.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                          title="Télécharger directement le fichier haute définition"
                        >
                          <Download className="h-3 w-3" /> Télécharger
                        </a>
                      ) : null}
                      {derived ? (
                        <a
                          href={derived.normalizedViewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                          title="Ouvrir dans Google Drive"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Videos section */}
      {videos.length > 0 && (
        <div className="space-y-2.5 pt-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Video className="h-3.5 w-3.5 text-primary" /> Vidéos &amp; Créas publicitaires
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((item) => {
              const derived = deriveGoogleDriveUrls(item.googleDriveUrl);
              return (
                <div
                  key={item.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-lg border bg-muted/20 transition hover:border-primary/50 hover:shadow-sm"
                >
                  <div
                    className="relative h-44 w-full cursor-pointer overflow-hidden bg-black flex items-center justify-center"
                    onClick={() => setPreviewItem(item)}
                    title="Lire la vidéo"
                  >
                    {derived ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={derived.previewUrl}
                        alt={item.title ?? "Aperçu vidéo"}
                        className="h-full w-full object-cover opacity-80 transition group-hover:scale-105 group-hover:opacity-90"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : null}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg transition group-hover:scale-110">
                        <Play className="h-5 w-5 fill-current ml-0.5" />
                      </div>
                    </div>
                    <Badge variant="info" className="absolute left-2 top-2 text-[10px]">
                      Vidéo HD
                    </Badge>
                  </div>

                  <div className="p-3 space-y-2">
                    <div>
                      <p className="line-clamp-1 text-xs font-semibold" title={item.title ?? undefined}>
                        {item.title || "Vidéo publicitaire"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Idéal pour TikTok, Meta Ads &amp; Reels
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t text-xs">
                      {derived ? (
                        <a
                          href={derived.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition"
                        >
                          <Download className="h-3.5 w-3.5" /> Télécharger HD
                        </a>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setPreviewItem(item)}
                      >
                        <Play className="h-3 w-3 mr-1" /> Lecture
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Modal Video / Image Preview Dialog */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <Badge variant={previewItem.type === "VIDEO" ? "info" : "outline"} className="text-xs">
                  {previewItem.type}
                </Badge>
                <h3 className="font-semibold text-sm">
                  {previewItem.title || "Support de promotion"}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setPreviewItem(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="relative aspect-video w-full bg-black">
              {(() => {
                const derived = deriveGoogleDriveUrls(previewItem.googleDriveUrl);
                if (!derived) return null;
                return (
                  <iframe
                    src={derived.embedUrl}
                    className="h-full w-full border-0"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    title={previewItem.title ?? "Aperçu Google Drive"}
                  />
                );
              })()}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 px-4 py-3 text-xs">
              {(() => {
                const derived = deriveGoogleDriveUrls(previewItem.googleDriveUrl);
                if (!derived) return null;
                return (
                  <>
                    <span className="text-muted-foreground font-medium">
                      Fichier original hébergé sur Google Drive
                    </span>
                    <div className="flex items-center gap-2">
                      <a
                        href={derived.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        <Download className="h-3.5 w-3.5" /> Télécharger directement
                      </a>
                      <a
                        href={derived.normalizedViewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Ouvrir dans Drive
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



