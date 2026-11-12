import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Palette, ShieldCheck, User, Users } from "lucide-react";
import { requireSession } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { listFinanceSettings } from "@/modules/settings/service";
import { listPerformanceLevels } from "@/modules/finance/performance-service";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n";
import { FinanceSettingsForm } from "./settings-form";
import { PerformanceLevelsSection } from "./performance-levels-section";

export const metadata: Metadata = { title: "Paramètres" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [user, locale] = await Promise.all([
    requireSession(["SUPER_ADMIN", "ADMIN"]),
    getServerLocale(),
  ]);
  const dict = getDictionary(locale);
  const [settings, levels, canEdit] = await Promise.all([
    listFinanceSettings(),
    listPerformanceLevels({ includeInactive: true }),
    hasPermission(user, "MANAGE_CONTRIBUTION_SETTINGS"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{dict.settingsHub.title}</h1>
        <p className="text-sm text-muted-foreground">
          {dict.settingsHub.subtitle}
        </p>
      </div>

      {/* Quick navigation to Admin Management, Account Settings & Design */}
      <div className="grid gap-4 sm:grid-cols-2">
        {user.role === "SUPER_ADMIN" && (
          <Link
            href="/parametres/administrateurs"
            className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-soft transition-colors hover:border-primary/50 hover:bg-muted/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-foreground">{dict.settingsHub.adminManagementTitle}</div>
                <div className="text-xs text-muted-foreground">
                  {dict.settingsHub.adminManagementDesc}
                </div>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </Link>
        )}

        <Link
          href="/parametres/compte"
          className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-soft transition-colors hover:border-primary/50 hover:bg-muted/40"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <User className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-foreground">{dict.settingsHub.myAccountTitle}</div>
              <div className="text-xs text-muted-foreground">
                {dict.settingsHub.myAccountDesc}
              </div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </Link>

        <Link
          href="/parametres/design"
          className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-soft transition-colors hover:border-primary/50 hover:bg-muted/40"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-foreground">{dict.settingsHub.brandDesignTitle}</div>
              <div className="text-xs text-muted-foreground">
                {dict.settingsHub.brandDesignDesc}
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
              <div className="font-semibold text-foreground">{dict.settingsHub.authDesignTitle}</div>
              <div className="text-xs text-muted-foreground">
                {dict.settingsHub.authDesignDesc}
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
