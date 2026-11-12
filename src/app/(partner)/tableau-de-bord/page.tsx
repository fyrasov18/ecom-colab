import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/rbac";
import { getPartnerDashboardData } from "@/modules/analytics/partner";
import { formatPrice } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AnimatedCard, AnimatedKpiValue } from "@/components/ui/animated-card";
import { PartnerRecentOrders } from "./recent-orders";
import { PartnerFinancialSummary } from "./summary-card";
import { Wallet, TrendingUp, RotateCcw, PlusCircle, PackageCheck, ChevronRight } from "lucide-react";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = { title: "Tableau de bord" };
export const dynamic = "force-dynamic";

export default async function PartnerDashboardPage() {
  const user = await requireSession(["PARTNER"]);
  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.partnerPortal.dashboard;
  const c = dict.common;
  const o = dict.orders;
  const currencySymbol = locale === "ar" ? "د.ت" : locale === "en" ? "TND" : "DT";

  if (!user.partnerId) {
    return <div className="p-6 font-medium text-destructive">{locale === "ar" ? "الحساب غير مهيأ." : locale === "en" ? "Account not configured." : "Compte non configuré."}</div>;
  }

  const data = await getPartnerDashboardData(user.partnerId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {user.firstName ? t.greeting.replace("{name}", user.firstName) : dict.dashboard.title}
          </h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link href="/nouvelle-commande"><PlusCircle className="mr-1.5 h-4 w-4" />{t.newOrderCTA}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/catalogue">{dict.partnerPortal.catalogue.title}</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1 — Solde disponible */}
        <AnimatedCard delay={0}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t.balance}</CardTitle>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <AnimatedKpiValue
                value={parseFloat(String(data.wallet.availableBalance))}
                suffix={` ${currencySymbol}`}
                decimals={3}
                delay={0}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              + {formatPrice(data.wallet.pendingBalance)} {currencySymbol} {locale === "ar" ? "قيد الانتظار" : locale === "en" ? "pending" : "en attente"}
            </p>
          </CardContent>
        </AnimatedCard>

        {/* Card 2 — Taux de livraison */}
        <AnimatedCard delay={75}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t.deliveryRate}</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <AnimatedKpiValue value={data.orders.deliveryRate} suffix="%" delay={75} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{data.orders.delivered} {locale === "ar" ? "مسلمة" : locale === "en" ? "delivered" : "livrées"}</p>
          </CardContent>
        </AnimatedCard>

        {/* Card 3 — En acheminement */}
        <AnimatedCard delay={150}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{locale === "ar" ? "قيد التوصيل" : locale === "en" ? "In transit" : "En acheminement"}</CardTitle>
            <PackageCheck className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <AnimatedKpiValue value={data.orders.inDelivery} delay={150} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{data.orders.preparing} {locale === "ar" ? "قيد التحضير" : locale === "en" ? "preparing" : "en préparation"}</p>
          </CardContent>
        </AnimatedCard>

        {/* Card 4 — Taux de retour */}
        <AnimatedCard delay={225}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{dict.performances.returnRate}</CardTitle>
            <RotateCcw className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <AnimatedKpiValue value={data.orders.returnRate} suffix="%" delay={225} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.orders.returnedOrRefused} {locale === "ar" ? "إرجاع/رفض" : locale === "en" ? "returned/refused" : "retour/refus"}
            </p>
          </CardContent>
        </AnimatedCard>
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
            <CardTitle className="text-base font-medium">{t.myRecentOrders}</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link href="/mes-commandes">{dict.dashboard.viewAll} <ChevronRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentOrders.length === 0 ? (
              <EmptyState
                title={locale === "ar" ? "لا توجد طلبات" : locale === "en" ? "No orders" : "Aucune commande"}
                description={locale === "ar" ? "لم تقم بتسجيل أي طلب بعد." : locale === "en" ? "You haven't placed any orders yet." : "Vous n'avez pas encore passé de commande."}
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
