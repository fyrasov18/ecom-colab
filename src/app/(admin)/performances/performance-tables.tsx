import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/money";
import type { PartnerPerfRow, ProductPerfRow } from "@/modules/analytics/compute";

export function TopPartnersTable({ partners }: { partners: PartnerPerfRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Partenaire</TableHead>
          <TableHead className="text-center">Commandes</TableHead>
          <TableHead className="text-center">Livrées</TableHead>
          <TableHead className="text-center">Retours</TableHead>
          <TableHead className="text-center">Taux succès</TableHead>
          <TableHead className="text-right">Volume livré</TableHead>
          <TableHead className="text-right">Gains</TableHead>
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
              {formatPrice(p.turnover)} DT
            </TableCell>
            <TableCell className="text-right text-xs font-medium text-emerald-600">
              {formatPrice(p.earnings)} DT
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function TopProductsTable({ products }: { products: ProductPerfRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produit</TableHead>
          <TableHead className="text-center">Commandes</TableHead>
          <TableHead className="text-center">Unités livrées</TableHead>
          <TableHead className="text-center">Retours</TableHead>
          <TableHead className="text-center">Taux succès</TableHead>
          <TableHead className="text-right">Chiffre d&apos;affaires</TableHead>
          <TableHead className="text-right">Gains</TableHead>
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
              {formatPrice(p.turnover)} DT
            </TableCell>
            <TableCell className="text-right text-xs font-semibold text-emerald-600">
              {formatPrice(p.earnings)} DT
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
