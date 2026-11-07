import type { Metadata } from "next";
import { requireSession } from "@/lib/rbac";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { getAuthPagesDesign, getDeliveryPartnersConfig, getPlatformBranding } from "@/modules/branding/service";
import { AuthDesignForm } from "./auth-design-form";

export const metadata: Metadata = {
  title: "Design des Pages d'Authentification",
  description: "Personnalisation visuelle et marketing des pages de connexion et d'inscription.",
};

export default async function AdminAuthDesignPage() {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const canEdit = await hasPermission(user, PERMISSIONS.MANAGE_PLATFORM_BRANDING);

  const [authDesign, platformBranding, deliveryPartnersConfig] = await Promise.all([
    getAuthPagesDesign(),
    getPlatformBranding(),
    getDeliveryPartnersConfig(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Design des Pages d'Authentification"
        description="Configurez la palette de couleurs, les logos personnalisés, les textes marketing multilingues (FR / AR / EN), les partenaires de livraison et la disposition des écrans de connexion et d'inscription."
      />

      <AuthDesignForm
        initialDesign={authDesign}
        platformBranding={platformBranding}
        initialDeliveryPartnersConfig={deliveryPartnersConfig}
        canEdit={canEdit}
      />
    </div>
  );
}
