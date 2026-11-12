"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/money";
import { useI18n } from "@/lib/i18n";

type WalletKpis = {
  totalEarned: number;
  totalWithdrawn: number;
  assignedProductsCount: number;
};

export function PartnerFinancialSummary({ data }: { data: WalletKpis }) {
  const { dict, locale } = useI18n();
  const currencySymbol = locale === "ar" ? "د.ت" : locale === "en" ? "TND" : "DT";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          {locale === "ar" ? "الملخص المالي" : locale === "en" ? "Financial Summary" : "Bilan financier"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between border-b pb-2 text-sm">
          <span className="text-muted-foreground">
            {locale === "ar" ? "إجمالي الأرباح" : locale === "en" ? "Cumulative earnings" : "Gains cumulés"}
          </span>
          <span className="font-semibold">{formatPrice(data.totalEarned)} {currencySymbol}</span>
        </div>
        <div className="flex justify-between border-b pb-2 text-sm">
          <span className="text-muted-foreground">
            {locale === "ar" ? "المسحوب" : locale === "en" ? "Withdrawn" : "Retiré"}
          </span>
          <span className="font-semibold">{formatPrice(data.totalWithdrawn)} {currencySymbol}</span>
        </div>
        <div className="flex justify-between pt-1 text-sm">
          <span className="text-muted-foreground">{dict.partnerPortal.catalogue.myAssignedProducts}</span>
          <span className="font-semibold">{data.assignedProductsCount}</span>
        </div>
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href="/portefeuille">{dict.partnerPortal.wallet.title}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
