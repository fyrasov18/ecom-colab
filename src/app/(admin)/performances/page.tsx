import type { Metadata } from "next";
import { requireSession } from "@/lib/rbac";
import { getPlatformPerformances } from "@/modules/analytics/platform";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPrice } from "@/lib/money";
import { TopPartnersTable, TopProductsTable } from "./performance-tables";
import { TrendingUp, RotateCcw, DollarSign, Percent } from "lucide-react";

export const metadata: Metadata = { title: "Performances Globales" };
export const dynamic = "force-dynamic";

export default async function PerformancesPage() {
  await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const data = await getPlatformPerformances();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Performances Plateforme</h1>
        <p className="text-sm text-muted-foreground">
          Indicateurs d&apos;efficacité commerciale, logistique et rentabilité globale.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taux de livraison global</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.kpis.deliveryRate}%</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.kpis.deliveredOrders} livrées sur {data.kpis.deliveredOrders + data.kpis.returnedOrders} commandes résolues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taux de retour global</CardTitle>
            <RotateCcw className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.kpis.returnRate}%</div>
            <p className="mt-1 text-xs text-muted-foreground">{data.kpis.returnedOrders} commandes retournées ou refusées</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Volume d&apos;affaires livré</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(data.kpis.turnover)} DT</div>
            <p className="mt-1 text-xs text-muted-foreground">Partenaires payés : {formatPrice(data.kpis.partnerPayout)} DT</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Marge brute plateforme</CardTitle>
            <Percent className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(data.kpis.platformMargin)} DT</div>
            <p className="mt-1 text-xs text-muted-foreground">Sur {data.kpis.totalOrders} commandes au total</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Top Partenaires par Volume</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topPartners.length === 0 ? (
              <EmptyState
                title="Aucun partenaire"
                description="Aucun partenaire actif ou volume de commandes enregistré."
              />
            ) : (
              <TopPartnersTable partners={data.topPartners} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Top Produits par Unités Livrées</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topProducts.length === 0 ? (
              <EmptyState
                title="Aucun produit vendu"
                description="Aucune commande livrée à ce jour, le classement apparaîtra ici."
              />
            ) : (
              <TopProductsTable products={data.topProducts} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

