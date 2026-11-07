import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { getPartnerBranding } from "@/modules/branding/service";
import { CompanyForm } from "./company-form";

export const metadata: Metadata = {
  title: "Mon entreprise",
  description: "Gestion de l'identité commerciale, des logos et des coordonnées de contact de la boutique partenaire.",
};

export const dynamic = "force-dynamic";

export default async function PartnerCompanyPage() {
  const user = await requireSession(["PARTNER"]);

  if (!user.partnerId) {
    redirect("/tableau-de-bord");
  }

  const branding = await getPartnerBranding(user.partnerId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon entreprise"
        description="Gérez la raison sociale, les logos, la couleur de marque et les coordonnées de contact de votre boutique."
      />

      <CompanyForm initialBranding={branding} />
    </div>
  );
}
