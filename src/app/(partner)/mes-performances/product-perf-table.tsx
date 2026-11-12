"use client";

import type { ProductPerfRow } from "@/modules/analytics/compute";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/money";
import { useI18n } from "@/lib/i18n";

export function PartnerProductPerfTable({ items }: { items: ProductPerfRow[] }) {
  const { dict, locale } = useI18n();
  const currencySymbol = locale === "ar" ? "د.ت" : locale === "en" ? "TND" : "DT";

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{dict.products.productName}</TableHead>
          <TableHead className="text-center">{dict.orders.title}</TableHead>
          <TableHead className="text-center">{dict.common.quantity}</TableHead>
          <TableHead className="text-center">{dict.statuses.order.DELIVERED}</TableHead>
          <TableHead className="text-center">{dict.statuses.order.RETURNED}</TableHead>
          <TableHead className="text-center">{dict.performances.globalDeliveryRate}</TableHead>
          <TableHead className="text-right">{dict.finance.totalRevenue}</TableHead>
          <TableHead className="text-right">{dict.orders.partnerEarning}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.productId}>
            <TableCell className="text-xs font-medium">{item.name}</TableCell>
            <TableCell className="text-center text-xs">{item.totalOrders}</TableCell>
            <TableCell className="text-center text-xs">{item.unitsSold}</TableCell>
            <TableCell className="text-center text-xs font-medium text-emerald-600">
              {item.deliveredUnits}
            </TableCell>
            <TableCell className="text-center text-xs font-medium text-rose-600">
              {item.returnedUnits}
            </TableCell>
            <TableCell className="text-center">
              <Badge variant={item.deliveryRate >= 70 ? "success" : item.deliveryRate >= 50 ? "warning" : "destructive"}>
                {item.deliveryRate}%
              </Badge>
            </TableCell>
            <TableCell className="text-right text-xs font-semibold">
              {formatPrice(item.turnover)} {currencySymbol}
            </TableCell>
            <TableCell className="text-right text-xs font-bold text-emerald-600">
              {formatPrice(item.earnings)} {currencySymbol}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
