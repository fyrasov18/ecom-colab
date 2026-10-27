import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, PlusCircle, X } from "lucide-react";
import { requireSession } from "@/lib/rbac";
import { listPartnerOrders } from "@/modules/orders/queries";
import { formatPrice } from "@/lib/money";
import {
  ORDER_FILTER_STATUSES,
  ORDER_STATUS_LABELS,
} from "@/modules/orders/labels";
import type { OrderStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
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

  const { items, total, totalPages } = await listPartnerOrders(
    user.partnerId!,
    { status, page },
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mes commandes"
        description={`${total} commande(s)`}
        action={
          <Button asChild size="sm">
            <Link href="/nouvelle-commande">
              <PlusCircle className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Nouvelle commande
            </Link>
          </Button>
        }
      />

      {/* Status filter */}
      <form
        className="flex flex-wrap items-center gap-3"
        method="GET"
        role="search"
        aria-label="Filtrer mes commandes"
      >
        <NativeSelect
          name="status"
          defaultValue={status ?? ""}
          className="w-52"
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          {ORDER_FILTER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline" size="sm">
          Filtrer
        </Button>
        {status && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/mes-commandes">
              <X className="h-4 w-4 mr-1" aria-hidden="true" />
              Réinitialiser
            </Link>
          </Button>
        )}
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="Aucune commande"
          description={
            status
              ? "Aucune commande avec ce statut."
              : "Créez votre première commande après l'avoir confirmée avec votre client."
          }
          action={
            !status ? (
              <Button asChild size="sm">
                <Link href="/nouvelle-commande">
                  <PlusCircle className="h-4 w-4 mr-1.5" aria-hidden="true" />
                  Créer une commande
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href="/mes-commandes">Voir toutes mes commandes</Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="hidden md:table-cell">Produit</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead className="hidden sm:table-cell">Votre gain</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden lg:table-cell">Créée le</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">#{o.orderNumber}</TableCell>
                  <TableCell>
                    <div>{o.customer.fullName}</div>
                    <div className="text-xs text-muted-foreground">
                      {o.customer.phone}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {o.items[0]?.productName}
                    {o.quantity > 1 ? ` ×${o.quantity}` : ""}
                  </TableCell>
                  <TableCell>
                    {formatPrice(Number(o.unitSellingPrice) * o.quantity)} DT
                  </TableCell>
                  <TableCell className="hidden font-medium text-primary sm:table-cell">
                    {formatPrice(o.partnerEarning)} DT
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {o.createdAt.toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/mes-commandes/${o.id}`}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
                      aria-label={`Suivre la commande #${o.orderNumber}`}
                    >
                      Suivre{" "}
                      <ChevronRight
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
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
