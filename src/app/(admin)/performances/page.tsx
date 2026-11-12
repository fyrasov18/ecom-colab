import type { Metadata } from "next";
import { requireSession } from "@/lib/rbac";
import { getPlatformPerformances } from "@/modules/analytics/platform";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPrice } from "@/lib/money";
import { TopPartnersTable, TopProductsTable } from "./performance-tables";
import { TrendingUp, RotateCcw, DollarSign, Percent } from "lucide-react";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = { title: "Performances Globales" };
export const dynamic = "force-dynamic";

export default async function PerformancesPage() {
  await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const data = await getPlatformPerformances();

  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.performances;
  const currencySymbol = locale === "ar" ? "د.ت" : locale === "en" ? "TND" : "DT";

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
            <CardTitle className="text-sm font-medium text-muted-foreground">{t.globalDeliveryRate}</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.kpis.deliveryRate}%</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {locale === "ar"
                ? `${data.kpis.deliveredOrders} تم تسليمها من أصل ${data.kpis.deliveredOrders + data.kpis.returnedOrders} طلب منجز`
                : locale === "en"
                ? `${data.kpis.deliveredOrders} delivered out of ${data.kpis.deliveredOrders + data.kpis.returnedOrders} resolved orders`
                : `${data.kpis.deliveredOrders} livrées sur ${data.kpis.deliveredOrders + data.kpis.returnedOrders} commandes résolues`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t.returnRate}</CardTitle>
            <RotateCcw className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.kpis.returnRate}%</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {locale === "ar"
                ? `${data.kpis.returnedOrders} طلبات مرتجعة أو مرفوضة`
                : locale === "en"
                ? `${data.kpis.returnedOrders} returned or refused orders`
                : `${data.kpis.returnedOrders} commandes retournées ou refusées`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t.deliveredVolume}</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(data.kpis.turnover)} {currencySymbol}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {locale === "ar"
                ? `الشركاء المدفوع لهم: ${formatPrice(data.kpis.partnerPayout)} ${currencySymbol}`
                : locale === "en"
                ? `Partners paid: ${formatPrice(data.kpis.partnerPayout)} ${currencySymbol}`
                : `Partenaires payés : ${formatPrice(data.kpis.partnerPayout)} ${currencySymbol}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{dict.dashboard.platformShare}</CardTitle>
            <Percent className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(data.kpis.platformMargin)} {currencySymbol}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {locale === "ar"
                ? `على إجمالي ${data.kpis.totalOrders} طلب`
                : locale === "en"
                ? `On ${data.kpis.totalOrders} orders in total`
                : `Sur ${data.kpis.totalOrders} commandes au total`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.volumeRanking}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topPartners.length === 0 ? (
              <EmptyState
                title={locale === "ar" ? "لا يوجد شركاء" : locale === "en" ? "No partners" : "Aucun partenaire"}
                description={locale === "ar" ? "لا يوجد نشاط تجاري مسجل حالياً." : locale === "en" ? "No active partners or order volume recorded yet." : "Aucun partenaire actif ou volume de commandes enregistré."}
              />
            ) : (
              <TopPartnersTable partners={data.topPartners} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">{t.productRanking}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topProducts.length === 0 ? (
              <EmptyState
                title={locale === "ar" ? "لا توجد منتجات مباعة" : locale === "en" ? "No products sold" : "Aucun produit vendu"}
                description={locale === "ar" ? "سيظهر التصنيف هنا بمجرد تسليم أولى الطلبات." : locale === "en" ? "Rankings will appear here once orders are delivered." : "Aucune commande livrée à ce jour, le classement apparaîtra ici."}
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
