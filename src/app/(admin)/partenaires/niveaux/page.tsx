import type { Metadata } from "next";
import { requireSession } from "@/lib/rbac";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import {
  listPerformanceLevels,
  getPartnersPerformanceOverview,
} from "@/modules/finance/performance-service";
import { PerformanceLevelsClient } from "./performance-levels-client";

export const metadata: Metadata = {
  title: "Gestion des niveaux de performance | Ecom Partner",
};

export default async function PerformanceLevelsAdminPage() {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);

  const [canManageSettings, canManagePartners] = await Promise.all([
    hasPermission(user, PERMISSIONS.MANAGE_CONTRIBUTION_SETTINGS),
    hasPermission(user, PERMISSIONS.MANAGE_PARTNERS),
  ]);

  const canManage = user.role === "SUPER_ADMIN" || canManageSettings || canManagePartners;

  const [rawLevels, rawPartners] = await Promise.all([
    listPerformanceLevels({ includeInactive: true }),
    getPartnersPerformanceOverview(),
  ]);

  const levels = rawLevels.map((lvl) => ({
    id: lvl.id,
    name: lvl.name,
    description: lvl.description,
    sharePercentage: Number(lvl.sharePercentage),
    sortOrder: lvl.sortOrder,
    isActive: lvl.isActive,
    criteria: lvl.criteria,
    _count: lvl._count,
  }));

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 max-w-7xl">
      <PerformanceLevelsClient
        levels={levels}
        partners={rawPartners}
        canManage={canManage}
      />
    </div>
  );
}
