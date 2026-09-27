import { Construction } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Honest placeholder for modules delivered in later phases.
 * Never displays fake KPI values.
 */
export function ModulePlaceholder({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Module en cours de déploiement — {phase}
        </p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Construction className="h-5 w-5" />
          </div>
          <CardTitle className="text-base">Bientôt disponible</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Aucune donnée affichée pour l&apos;instant afin d&apos;éviter toute
          valeur non issue de la base de données.
        </CardContent>
      </Card>
    </div>
  );
}
