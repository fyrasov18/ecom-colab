import type { Metadata } from "next";
import { requireSession } from "@/lib/rbac";
import { listFinanceSettings } from "@/modules/settings/service";
import { listPerformanceLevels } from "@/modules/finance/performance-service";
import { FinanceSettingsForm } from "./settings-form";
import { PerformanceLevelsSection } from "./performance-levels-section";

export const metadata: Metadata = { title: "Paramètres" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const [settings, levels] = await Promise.all([
    listFinanceSettings(),
    listPerformanceLevels({ includeInactive: true }),
  ]);
  // A share percentage is a financial rule, so editing levels is SUPER_ADMIN only.
  const canEdit = user.role === "SUPER_ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Configuration globale de la plateforme.
        </p>
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
