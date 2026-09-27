import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { formatPrice } from "@/lib/money";
import type { OrderStatus } from "@prisma/client";

export type RecentOrderRow = {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  amount: number;
  customerName: string;
  productName: string;
  createdAt: string;
};

export function PartnerRecentOrders({ orders }: { orders: RecentOrderRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>N°</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Produit</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead className="text-right">Montant</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((o) => (
          <TableRow key={o.id}>
            <TableCell className="font-mono text-xs font-medium">
              <Link href={`/mes-commandes/${o.id}`} className="hover:underline">
                #{o.orderNumber}
              </Link>
            </TableCell>
            <TableCell className="text-xs">{o.customerName}</TableCell>
            <TableCell className="max-w-40 truncate text-xs text-muted-foreground">
              {o.productName}
            </TableCell>
            <TableCell>
              <OrderStatusBadge status={o.status} />
            </TableCell>
            <TableCell className="text-right text-xs font-semibold">
              {formatPrice(o.amount)} DT
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
