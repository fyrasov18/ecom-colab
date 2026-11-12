"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/money";
import type { PartnerPerfRow, ProductPerfRow } from "@/modules/analytics/compute";
import { useI18n } from "@/lib/i18n";

export function TopPartnersTable({ partners }: { partners: PartnerPerfRow[] }) {
  const { dict, locale } = useI18n();
  const currencySymbol = locale === "ar" ? "د.ت" : locale === "en" ? "TND" : "DT";

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{dict.orders.partner}</TableHead>
          <TableHead className="text-center">{dict.orders.title}</TableHead>
          <TableHead className="text-center">{dict.statuses.order.DELIVERED}</TableHead>
          <TableHead className="text-center">{dict.statuses.order.RETURNED}</TableHead>
          <TableHead className="text-center">{dict.partners.successRate}</TableHead>
          <TableHead className="text-right">{dict.performances.deliveredVolume}</TableHead>
          <TableHead className="text-right">{locale === "ar" ? "الأرباح" : locale === "en" ? "Earnings" : "Gains"}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {partners.map((p) => (
          <TableRow key={p.partnerId}>
            <TableCell>
              <div className="font-medium text-xs">{p.displayName}</div>
              <div className="text-[11px] text-muted-foreground">
                {p.code} · {p.status}
              </div>
            </TableCell>
            <TableCell className="text-center text-xs">{p.totalOrders}</TableCell>
            <TableCell className="text-center text-xs font-medium text-emerald-600">
              {p.deliveredOrders}
            </TableCell>
            <TableCell className="text-center text-xs font-medium text-rose-600">
              {p.returnedOrders}
            </TableCell>
            <TableCell className="text-center">
              <Badge variant={p.deliveryRate >= 70 ? "success" : p.deliveryRate >= 50 ? "warning" : "secondary"}>
                {p.deliveryRate}%
              </Badge>
            </TableCell>
            <TableCell className="text-right text-xs font-semibold">
              {formatPrice(p.turnover)} {currencySymbol}
            </TableCell>
            <TableCell className="text-right text-xs font-medium text-emerald-600">
              {formatPrice(p.earnings)} {currencySymbol}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function TopProductsTable({ products }: { products: ProductPerfRow[] }) {
  const { dict, locale } = useI18n();
  const currencySymbol = locale === "ar" ? "د.ت" : locale === "en" ? "TND" : "DT";

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{dict.products.productName}</TableHead>
          <TableHead className="text-center">{dict.orders.title}</TableHead>
          <TableHead className="text-center">{locale === "ar" ? "الوحدات المسلمة" : locale === "en" ? "Delivered units" : "Unités livrées"}</TableHead>
          <TableHead className="text-center">{dict.statuses.order.RETURNED}</TableHead>
          <TableHead className="text-center">{dict.partners.successRate}</TableHead>
          <TableHead className="text-right">{dict.finance.totalRevenue}</TableHead>
          <TableHead className="text-right">{locale === "ar" ? "الأرباح" : locale === "en" ? "Earnings" : "Gains"}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((p) => (
          <TableRow key={p.productId}>
            <TableCell className="text-xs font-medium">{p.name}</TableCell>
            <TableCell className="text-center text-xs">{p.totalOrders}</TableCell>
            <TableCell className="text-center text-xs font-medium text-emerald-600">
              {p.deliveredUnits}
            </TableCell>
            <TableCell className="text-center text-xs font-medium text-rose-600">
              {p.returnedUnits}
            </TableCell>
            <TableCell className="text-center">
              <Badge variant={p.deliveryRate >= 70 ? "success" : p.deliveryRate >= 50 ? "warning" : "secondary"}>
                {p.deliveryRate}%
              </Badge>
            </TableCell>
            <TableCell className="text-right text-xs font-semibold">
              {formatPrice(p.turnover)} {currencySymbol}
            </TableCell>
            <TableCell className="text-right text-xs font-semibold text-emerald-600">
              {formatPrice(p.earnings)} {currencySymbol}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
