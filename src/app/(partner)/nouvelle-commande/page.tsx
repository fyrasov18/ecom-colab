import type { Metadata } from "next";
import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/modules/settings/service";
import { SETTING_KEYS } from "@/modules/settings/defaults";
import { resolveCommission } from "@/modules/finance/commission";
import { OrderForm } from "./order-form";

export const metadata: Metadata = { title: "Nouvelle commande" };

export default async function NewOrderPage() {
  const user = await requireSession(["PARTNER"]);
  const partner = await prisma.partner.findUniqueOrThrow({
    where: { id: user.partnerId! },
  });

  const assignments = await prisma.partnerProduct.findMany({
    where: { partnerId: partner.id, status: "ACTIVE" },
    include: { product: true },
    orderBy: { assignedAt: "desc" },
  });

  const globalCommission = await getSetting<{
    commissionType: "PERCENTAGE" | "FIXED";
    commissionValue: number;
  }>(SETTING_KEYS.GLOBAL_COMMISSION);

  const products = assignments
    .filter((a) => a.product.status === "ACTIVE" || a.product.status === "OUT_OF_STOCK")
    .map((a) => {
      const rule = resolveCommission({
        partnerProduct: {
          commissionType: a.commissionType,
          commissionValue: a.commissionValue,
        },
        partner: {
          commissionType: partner.defaultCommissionType,
          commissionValue: partner.defaultCommissionValue,
        },
        product: {
          commissionType: a.product.commissionType,
          commissionValue: a.product.commissionValue,
        },
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
        commissionType: rule.type as "PERCENTAGE" | "FIXED",
        commissionValue: Number(rule.value),
        commissionSource: rule.source,
      };
    });

  const first = products[0];
  const ruleHint = first
    ? ` ${first.commissionType === "PERCENTAGE" ? `${first.commissionValue} %` : `${first.commissionValue} DT`} (${
        first.commissionSource === "PARTNER_PRODUCT"
          ? "personnalisée"
          : first.commissionSource === "PARTNER"
            ? "partenaire"
            : first.commissionSource === "PRODUCT"
              ? "produit"
              : "global"
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
        <OrderForm products={products} />
      )}
      <p className="text-xs text-muted-foreground">
        Estimations calculées avec la règle de commission qui vous est appliquée
        (assignment → partenaire → produit → global). Le gain définitif est figé
        à la création de la commande.{ruleHint}
      </p>
    </div>
  );
}

