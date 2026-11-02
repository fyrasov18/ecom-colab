"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Archive, CheckCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  archiveAnnouncementAction,
  deleteAnnouncementAction,
  publishAnnouncementAction,
} from "./actions";

export function AnnouncementRowActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handlePublish = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("id", id);
      try {
        await publishAnnouncementAction(fd);
        toast.success("Annonce publiée aux partenaires ciblés !");
      } catch {
        toast.error("Erreur lors de la publication.");
      }
    });
  };

  const handleArchive = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("id", id);
      try {
        await archiveAnnouncementAction(fd);
        toast.success("Annonce archivée.");
      } catch {
        toast.error("Erreur lors de l'archivage.");
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer définitivement cette annonce ?")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("id", id);
      try {
        await deleteAnnouncementAction(fd);
        toast.success("Annonce supprimée.");
      } catch {
        toast.error("Erreur lors de la suppression.");
      }
    });
  };

  return (
    <div className="flex items-center justify-end gap-1">
      {status !== "PUBLISHED" && status !== "ARCHIVED" && (
        <Button
          variant="outline"
          size="sm"
          onClick={handlePublish}
          disabled={isPending}
          className="h-8 gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          title="Publier immédiatement"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Publier
        </Button>
      )}

      {status === "PUBLISHED" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleArchive}
          disabled={isPending}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          title="Archiver l'annonce"
        >
          <Archive className="h-4 w-4" />
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={isPending}
        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
        title="Supprimer définitivement"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
