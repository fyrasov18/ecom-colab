import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Palette, ShieldCheck } from "lucide-react";
import { requireSession } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { listFinanceSettings } from "@/modules/settings/service";
import { listPerformanceLevels } from "@/modules/finance/performance-service";
import { FinanceSettingsForm } from "./settings-form";
import { PerformanceLevelsSection } from "./performance-levels-section";

export const metadata: Metadata = { title: "Paramètres" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const [settings, levels, canEdit] = await Promise.all([
    listFinanceSettings(),
    listPerformanceLevels({ includeInactive: true }),
    hasPermission(user, "MANAGE_CONTRIBUTION_SETTINGS"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Configuration globale de la plateforme.
        </p>
      </div>

      {/* Quick link to Design & Branding */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/parametres/design"
          className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-soft transition-colors hover:border-primary/50 hover:bg-muted/40"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-foreground">Design & Marque de la Plateforme</div>
              <div className="text-xs text-muted-foreground">
                Logos, nom de la plateforme, couleurs et style visuel du tableau de bord.
              </div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </Link>

        <Link
          href="/parametres/auth-design"
          className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-soft transition-colors hover:border-primary/50 hover:bg-muted/40"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-foreground">Design Pages d&apos;Authentification</div>
              <div className="text-xs text-muted-foreground">
                Inspiration Shipper : volet marketing, textes multilingues, mockup et couleurs CTA.
              </div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </Link>
      </div>

      <FinanceSettingsForm
        settings={settings.map((s) => ({
          key: s.key,
          description: s.description,
          value: s.value,
        }))}
        canEdit={canEdit}
      />

      <PerformanceLevelsSection
        levels={levels.map((l) => ({
          id: l.id,
          name: l.name,
          description: l.description,
          sharePercentage: l.sharePercentage.toString(),
          isActive: l.isActive,
          sortOrder: l.sortOrder,
          partnerCount: l._count.partners,
        }))}
        canEdit={canEdit}
      />
    </div>
  );
}
