import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { requireSession } from "@/lib/rbac";
import { listPartnerOrders } from "@/modules/orders/queries";
import { formatPrice } from "@/lib/money";
import { ORDER_FILTER_STATUSES, ORDER_STATUS_LABELS } from "@/modules/orders/labels";
import type { OrderStatus } from "@prisma/client";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import { Pagination } from "@/components/ui/pagination";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Mes commandes" };

export default async function MyOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const user = await requireSession(["PARTNER"]);
  const status =
    typeof sp.status === "string" &&
    (ORDER_FILTER_STATUSES as string[]).includes(sp.status)
      ? (sp.status as OrderStatus)
      : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const { items, total, totalPages } = await listPartnerOrders(user.partnerId!, {
    status,
    page,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mes commandes</h1>
        <p className="text-sm text-muted-foreground">{total} commande(s)</p>
      </div>

      <form className="flex flex-wrap items-center gap-3" method="GET">
        <NativeSelect name="status" defaultValue={status ?? ""} className="w-52">
          <option value="">Tous les statuts</option>
          {ORDER_FILTER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
        <button
          type="submit"
          className="inline-flex h-9 rounded-md border border-input bg-card px-3 text-sm font-medium shadow-sm hover:bg-accent"
        >
          Filtrer
        </button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="Aucune commande"
          description="Créez votre première commande après l'avoir confirmée avec votre client."
          action={
            <Link
              href="/nouvelle-commande"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              + Ajouter une commande
            </Link>
          }
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Votre gain</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créée le</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">#{o.orderNumber}</TableCell>
                  <TableCell>
                    <div>{o.customer.fullName}</div>
                    <div className="text-xs text-muted-foreground">{o.customer.phone}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {o.items[0]?.productName}
                    {o.quantity > 1 ? ` ×${o.quantity}` : ""}
                  </TableCell>
                  <TableCell>
                    {formatPrice(Number(o.unitSellingPrice) * o.quantity)} DT
                  </TableCell>
                  <TableCell className="font-medium text-primary">
                    {formatPrice(o.partnerEarning)} DT
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {o.createdAt.toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/mes-commandes/${o.id}`}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent"
                    >
                      Suivre <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} searchParams={sp} />
    </div>
  );
}

