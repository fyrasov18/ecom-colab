import type { Metadata } from "next";
import { requireSession } from "@/lib/rbac";
import { getPartnerPerformanceData } from "@/modules/analytics/partner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPrice } from "@/lib/money";
import { BarChart3, TrendingUp, RotateCcw, Wallet, Percent } from "lucide-react";
import { PartnerProductPerfTable } from "./product-perf-table";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = { title: "Mes Performances" };
export const dynamic = "force-dynamic";

export default async function MesPerformancesPage() {
  const user = await requireSession(["PARTNER"]);
  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.performances;
  const o = dict.orders;
  const currencySymbol = locale === "ar" ? "د.ت" : locale === "en" ? "TND" : "DT";

  if (!user.partnerId) {
    return <div className="p-6 font-medium text-destructive">{locale === "ar" ? "الحساب غير مهيأ." : locale === "en" ? "Account not configured." : "Compte non configuré."}</div>;
  }

  const data = await getPartnerPerformanceData(user.partnerId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t.subtitle}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{dict.dashboard.totalOrders}</CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.orders.total}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.orders.delivered} {locale === "ar" ? "تم تسليمها بنجاح" : locale === "en" ? "successfully delivered" : "livrées avec succès"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t.globalDeliveryRate}</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.orders.deliveryRate}%</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {locale === "ar" ? "نسبة النجاح للطلبات المنجزة" : locale === "en" ? "Success ratio on completed orders" : "Ratio de succès sur commandes abouties"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t.returnRate}</CardTitle>
            <RotateCcw className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.orders.returnRate}%</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.orders.returnedOrRefused} {locale === "ar" ? "طلبات غير منجزة" : locale === "en" ? "unsuccessful orders" : "commandes non abouties"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t.deliveredVolume}</CardTitle>
            <Percent className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(data.commercial.turnover)} {currencySymbol}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {locale === "ar" ? "متوسط السلة: " : locale === "en" ? "Avg basket: " : "Panier moyen : "}{formatPrice(data.commercial.averageBasket)} {currencySymbol} · {data.commercial.unitsSold} {locale === "ar" ? "وحدة" : locale === "en" ? "units" : "unités"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{locale === "ar" ? "الأرباح المتراكمة" : locale === "en" ? "Cumulative earnings" : "Gains cumulés"}</CardTitle>
            <Wallet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(data.wallet.totalEarned)} {currencySymbol}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatPrice(data.wallet.availableBalance)} {currencySymbol} {locale === "ar" ? "متاح للسحب" : locale === "en" ? "available" : "disponible"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">{t.productRanking}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.productPerformances.length === 0 ? (
            <EmptyState
              title={locale === "ar" ? "لا توجد مبيعات منتجات بعد" : locale === "en" ? "No product sales yet" : "Aucune vente de produit"}
              description={locale === "ar" ? "ستظهر إحصائيات كل منتج هنا بمجرد تسليم أولى الطلبات." : locale === "en" ? "Statistics per product will appear here once orders are delivered." : "Les statistiques par produit apparaîtront ici dès vos premières livraisons."}
            />
          ) : (
            <PartnerProductPerfTable items={data.productPerformances} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
