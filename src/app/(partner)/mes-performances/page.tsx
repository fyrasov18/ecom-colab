import type { Metadata } from "next";
import { requireSession } from "@/lib/rbac";
import { getPartnerPerformanceData } from "@/modules/analytics/partner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPrice } from "@/lib/money";
import { BarChart3, TrendingUp, RotateCcw, Wallet, Percent } from "lucide-react";
import { PartnerProductPerfTable } from "./product-perf-table";

export const metadata: Metadata = { title: "Mes Performances" };
export const dynamic = "force-dynamic";

export default async function MesPerformancesPage() {
  const user = await requireSession(["PARTNER"]);
  if (!user.partnerId) {
    return <div className="p-6 font-medium text-destructive">Compte non configuré.</div>;
  }

  const data = await getPartnerPerformanceData(user.partnerId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Performances commerciales</h1>
        <p className="text-sm text-muted-foreground">
          Indicateurs détaillés de vos ventes, taux de succès et rentabilité par produit.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total commandes</CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.orders.total}</div>
            <p className="mt-1 text-xs text-muted-foreground">{data.orders.delivered} livrées avec succès</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taux de livraison global</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.orders.deliveryRate}%</div>
            <p className="mt-1 text-xs text-muted-foreground">Ratio de succès sur commandes abouties</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taux de retour / refus</CardTitle>
            <RotateCcw className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.orders.returnRate}%</div>
            <p className="mt-1 text-xs text-muted-foreground">{data.orders.returnedOrRefused} commandes non abouties</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Chiffre d&apos;affaires livré</CardTitle>
            <Percent className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(data.commercial.turnover)} DT</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Panier moyen : {formatPrice(data.commercial.averageBasket)} DT · {data.commercial.unitsSold} unités
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gains cumulés</CardTitle>
            <Wallet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(data.wallet.totalEarned)} DT</div>
            <p className="mt-1 text-xs text-muted-foreground">{formatPrice(data.wallet.availableBalance)} DT disponible</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Performance par produit</CardTitle>
        </CardHeader>
        <CardContent>
          {data.productPerformances.length === 0 ? (
            <EmptyState
              title="Aucune donnée produit"
              description="Vos commandes passées apparaîtront ici ventilées par produit."
            />
          ) : (
            <PartnerProductPerfTable items={data.productPerformances} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

