"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { toggleCategoryActiveAction } from "./actions";

type Props = {
  id: string;
  isActive: boolean;
};

export function ToggleCategoryStatusButton({ id, isActive }: Props) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("id", id);
      fd.append("isActive", isActive ? "false" : "true");
      try {
        await toggleCategoryActiveAction(fd);
        toast.success(
          isActive ? "Catégorie désactivée" : "Catégorie activée",
        );
      } catch {
        toast.error("Impossible de modifier le statut de la catégorie.");
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      className="inline-flex cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50"
      title={`Cliquer pour ${isActive ? "désactiver" : "activer"}`}
    >
      <Badge variant={isActive ? "success" : "secondary"}>
        {isPending ? "..." : isActive ? "Active" : "Inactive"}
      </Badge>
    </button>
  );
}
