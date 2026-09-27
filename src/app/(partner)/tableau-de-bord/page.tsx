import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/rbac";
import { getPartnerDashboardData } from "@/modules/analytics/partner";
import { formatPrice } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PartnerRecentOrders } from "./recent-orders";
import { PartnerFinancialSummary } from "./summary-card";
import { Wallet, TrendingUp, RotateCcw, PlusCircle, PackageCheck, ChevronRight } from "lucide-react";

export const metadata: Metadata = { title: "Tableau de bord" };
export const dynamic = "force-dynamic";

export default async function PartnerDashboardPage() {
  const user = await requireSession(["PARTNER"]);
  if (!user.partnerId) {
    return <div className="p-6 font-medium text-destructive">Compte non configuré.</div>;
  }

  const data = await getPartnerDashboardData(user.partnerId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">Aperçu en temps réel de votre activité et de vos gains.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link href="/nouvelle-commande"><PlusCircle className="mr-1.5 h-4 w-4" />Nouvelle commande</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/catalogue">Catalogue</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Solde disponible</CardTitle>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(data.wallet.availableBalance)} DT</div>
            <p className="mt-1 text-xs text-muted-foreground">+ {formatPrice(data.wallet.pendingBalance)} DT en attente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taux de livraison</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.orders.deliveryRate}%</div>
            <p className="mt-1 text-xs text-muted-foreground">{data.orders.delivered} livrées</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">En acheminement</CardTitle>
            <PackageCheck className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.orders.inDelivery}</div>
            <p className="mt-1 text-xs text-muted-foreground">{data.orders.preparing} en préparation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taux de retour</CardTitle>
            <RotateCcw className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.orders.returnRate}%</div>
            <p className="mt-1 text-xs text-muted-foreground">{data.orders.returnedOrRefused} retour/refus</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PartnerFinancialSummary
          data={{
            totalEarned: data.wallet.totalEarned,
            totalWithdrawn: data.wallet.totalWithdrawn,
            assignedProductsCount: data.assignedProductsCount,
          }}
        />

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Dernières commandes</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link href="/mes-commandes">Voir tout <ChevronRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentOrders.length === 0 ? (
              <EmptyState
                title="Aucune commande"
                description="Vous n'avez pas encore passé de commande."
              />
            ) : (
              <PartnerRecentOrders orders={data.recentOrders} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

