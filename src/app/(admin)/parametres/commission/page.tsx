import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireSession } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { listFinanceSettings } from "@/modules/settings/service";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n";
import { CommissionRulesForm } from "./commission-form";

export const metadata: Metadata = { title: "Règles de Commission" };
export const dynamic = "force-dynamic";

export default async function CommissionRulesPage() {
  const [user, locale] = await Promise.all([
    requireSession(["SUPER_ADMIN", "ADMIN"]),
    getServerLocale(),
  ]);
  const dict = getDictionary(locale);
  const [settings, canEdit] = await Promise.all([
    listFinanceSettings(),
    hasPermission(user, "MANAGE_CONTRIBUTION_SETTINGS"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/parametres"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {dict.settingsHub.title}
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{dict.settingsHub.commissionRulesTitle}</h1>
        <p className="text-sm text-muted-foreground">{dict.settingsHub.commissionRulesDesc}</p>
      </div>
      <CommissionRulesForm
        settings={settings.map((s) => ({ key: s.key, description: s.description, value: s.value }))}
        canEdit={canEdit}
      />
    </div>
  );
}
