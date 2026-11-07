import type { Metadata } from "next";
import { requireSession } from "@/lib/rbac";
import { getGlobalCommission, getMinOrderContribution } from "@/modules/settings/service";
import { resolveContributionRate } from "@/modules/finance/contribution-engine";
import { getPartnerById } from "@/modules/partners/queries";
import { listOrderableAssignments } from "@/modules/products/partner-catalogue";
import { OrderForm } from "./order-form";

export const metadata: Metadata = { title: "Nouvelle commande" };

export default async function NewOrderPage() {
  const user = await requireSession(["PARTNER"]);
  const partner = await getPartnerById(user.partnerId!);

  const assignments = await listOrderableAssignments(partner.id);

  const globalCommission = await getGlobalCommission();
  const minContribution = await getMinOrderContribution();

  const products = assignments
    .filter((a) => a.product.status === "ACTIVE" || a.product.status === "OUT_OF_STOCK")
    .map((a) => {
      const rule = resolveContributionRate({
        partnerProduct: {
          commissionType: a.commissionType,
          commissionValue: a.commissionValue,
        },
        partner: {
          commissionType: partner.defaultCommissionType,
          commissionValue: partner.defaultCommissionValue,
        },
        performanceLevel: partner.performanceLevel,
        global: globalCommission,
      });
      return {
        id: a.product.id,
        name: a.product.name,
        description: a.product.description,
        sellingPrice: Number(a.product.sellingPrice),
        purchaseCost: Number(a.product.purchaseCost),
        packagingCost: Number(a.product.packagingCost),
        deliveryCost: Number(a.product.deliveryCost),
        stockQuantity: a.product.stockQuantity,
        commissionType: rule.type,
        commissionValue: Number(rule.rate),
        commissionSource: rule.source,
        performanceLevelName: rule.performanceLevelName,
      };
    });

  const first = products[0];
  const ruleHint = first
    ? ` ${first.commissionType === "PERCENTAGE" ? `${first.commissionValue} %` : `${first.commissionValue} DT`} (${
        first.commissionSource === "PARTNER_PRODUCT"
          ? "produit personnalisé"
          : first.commissionSource === "PARTNER"
            ? "admin partenaire"
            : first.commissionSource === "PERFORMANCE_LEVEL"
              ? `niveau ${first.performanceLevelName ?? ""}`
              : "défaut global"
      }).`
    : "";

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nouvelle commande</h1>
        <p className="text-sm text-muted-foreground">
          Vous ne créez une commande qu&apos;après l&apos;avoir confirmée avec le
          client. Elle part ensuite directement en opérations.
        </p>
      </div>
      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aucun produit ne vous est assigné pour le moment. Contactez
          l&apos;équipe.
        </div>
      ) : (
        <OrderForm products={products} minContribution={minContribution} />
      )}
      <p className="text-xs text-muted-foreground">
        Estimations calculées selon le moteur canonique de contribution (override produit → admin partenaire → niveau de performance → défaut global 30%).
        Seuil de contribution minimal requis : {minContribution} DT. Le gain définitif est figé à la création de la commande.{ruleHint}
      </p>
    </div>
  );
}
