import type { Metadata } from "next";
import { requireSession } from "@/lib/rbac";
import { getSystemHealth } from "@/modules/system/health";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TelegramSettings } from "./telegram-settings";

export const metadata: Metadata = { title: "État du système" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  operational: "Opérationnel",
  warning: "Attention",
  error: "Erreur",
  not_configured: "Non configuré",
};

const STATUS_VARIANT = {
  operational: "success",
  warning: "warning",
  error: "destructive",
  not_configured: "secondary",
} as const;

export default async function SystemHealthPage() {
  await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const checks = await getSystemHealth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="État du système"
        description="Vérifications réelles de l'infrastructure et des intégrations."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {checks.map((c) => (
          <Card key={c.key}>
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.detail}</p>
              </div>
              <Badge
                variant={STATUS_VARIANT[c.status]}
                className="shrink-0"
              >
                {STATUS_LABEL[c.status]}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <TelegramSettings />
    </div>
  );
}
