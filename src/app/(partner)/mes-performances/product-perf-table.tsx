import type { ProductPerfRow } from "@/modules/analytics/compute";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/money";

export function PartnerProductPerfTable({ items }: { items: ProductPerfRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produit</TableHead>
          <TableHead className="text-center">Commandes</TableHead>
          <TableHead className="text-center">Unités</TableHead>
          <TableHead className="text-center">Livrées</TableHead>
          <TableHead className="text-center">Retours</TableHead>
          <TableHead className="text-center">Taux livraison</TableHead>
          <TableHead className="text-right">Chiffre d&apos;affaires</TableHead>
          <TableHead className="text-right">Vos gains</TableHead>
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
              {formatPrice(item.turnover)} DT
            </TableCell>
            <TableCell className="text-right text-xs font-bold text-emerald-600">
              {formatPrice(item.earnings)} DT
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
