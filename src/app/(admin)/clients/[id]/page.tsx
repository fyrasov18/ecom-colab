import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCustomerDetail } from "@/modules/customers/queries";
import { formatPrice } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Fiche client" };
export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomerDetail(id);
  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <div>
        <ButtonBack />
        <h1 className="text-2xl font-semibold tracking-tight">{customer.fullName}</h1>
        <p className="text-sm text-muted-foreground">
          {customer.phone} · {customer.address}, {customer.city},{" "}
          {customer.governorate}
        </p>
        <p className="text-xs text-muted-foreground">
          Propriétaire :{" "}
          <Link
            href={`/partenaires/${customer.ownerPartner.id}`}
            className="text-primary underline-offset-2 hover:underline"
          >
            {customer.ownerPartner.displayName} ({customer.ownerPartner.code})
          </Link>
        </p>
        {customer.notes ? <p className="mt-2 text-sm">Note : {customer.notes}</p> : null}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Commandes ({customer.orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customer.orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune commande.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">#{o.orderNumber}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.items[0]?.productName}
                      {o.quantity > 1 ? ` ×${o.quantity}` : ""}
                    </TableCell>
                    <TableCell>
                      {formatPrice(Number(o.unitSellingPrice) * o.quantity)} DT
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {o.createdAt.toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/commandes/${o.id}`}
                        className="text-sm text-primary underline-offset-2 hover:underline"
                      >
                        Ouvrir
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ButtonBack() {
  return (
    <Link
      href="/clients"
      className="mb-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent"
    >
      <ArrowLeft className="h-4 w-4" /> Clients
    </Link>
  );
}
