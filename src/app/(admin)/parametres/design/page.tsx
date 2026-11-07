import type { Metadata } from "next";
import { requireSession } from "@/lib/rbac";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { getDashboardDesign, getPlatformBranding } from "@/modules/branding/service";
import { DesignForm } from "./design-form";

export const metadata: Metadata = {
  title: "Design & Marque",
  description: "Personnalisation des logos, de la marque et du thème visuel de la plateforme.",
};

export default async function AdminDesignPage() {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const canEdit = await hasPermission(user, PERMISSIONS.MANAGE_PLATFORM_BRANDING);

  const [branding, design] = await Promise.all([
    getPlatformBranding(),
    getDashboardDesign(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Design & Marque"
        description="Personnalisez l'identité visuelle de la plateforme, les logos institutionnels et la palette de couleurs du tableau de bord."
      />

      <DesignForm
        initialBranding={branding}
        initialDesign={design}
        canEdit={canEdit}
      />
    </div>
  );
}
