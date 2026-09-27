import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  PackageCheck,
  Percent,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { getAdminDashboardData } from "@/modules/analytics/dashboard";
import { formatPrice } from "@/lib/money";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Confirmée",
  VALIDATED: "Validée",
  ON_HOLD: "En attente",
  PREPARING: "Préparation",
  PACKAGED: "Emballée",
  SHIPPED: "Expédiée",
  IN_DELIVERY: "En livraison",
  DELIVERED: "Livrée",
  REFUSED: "Refusée",
  RETURNED: "Retournée",
  CANCELLED: "Annulée",
};

function KpiCard({
  label,
  value,
  icon: Icon,
  href,
  hint,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  hint?: string;
}) {
  const body = (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {hint && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            {hint}
            {href && <ArrowRight className="h-3 w-3" />}
          </div>
        )}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function DashboardPage() {
  const data = await getAdminDashboardData();

  const alerts: {
    label: string;
    href: string;
    tone: "warning" | "destructive";
  }[] = [];
  if (data.lowStockProducts > 0)
    alerts.push({
      label: `${data.lowStockProducts} produit(s) en stock faible`,
      href: "/produits",
      tone: "warning",
    });
  if (data.pendingWithdrawals > 0)
    alerts.push({
      label: `${data.pendingWithdrawals} demande(s) de retrait en attente`,
      href: "/finance",
      tone: "warning",
    });
  if (data.onHold > 0)
    alerts.push({
      label: `${data.onHold} commande(s) en attente (ON_HOLD)`,
      href: "/logistique",
      tone: "destructive",
    });
  if (data.refusedOrReturned > 0)
    alerts.push({
      label: `${data.refusedOrReturned} retour(s)/refus à traiter`,
      href: "/logistique",
      tone: "destructive",
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Vue d&apos;ensemble de l&apos;activité — données en temps réel.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Partenaires actifs" value={data.activePartners} icon={Users} href="/partenaires" />
        <KpiCard label="Commandes aujourd'hui" value={data.ordersToday} icon={ShoppingCart} href="/commandes" />
        <KpiCard label="Livrées" value={data.delivered} icon={PackageCheck} href="/commandes?status=DELIVERED" />
        <KpiCard label="En livraison" value={data.inDelivery} icon={Truck} href="/commandes?status=IN_DELIVERY" />
        <KpiCard label="Retours / Refus" value={data.refusedOrReturned} icon={AlertTriangle} href="/commandes?status=RETURNED" />
        <KpiCard label="À valider" value={data.awaitingValidation} icon={ShoppingCart} href="/commandes?status=CONFIRMED" />
        <KpiCard
          label="Gains en attente (partenaires)"
          value={`${formatPrice(data.wallets.pending)} DT`}
          icon={Wallet}
          href="/finance"
        />
        <KpiCard
          label="Solde disponible total"
          value={`${formatPrice(data.wallets.available)} DT`}
          icon={Percent}
          href="/finance"
        />
      </div>

      {alerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              Alertes opérationnelles
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {alerts.map((a) => (
              <Link key={a.label} href={a.href}>
                <Badge variant={a.tone === "destructive" ? "destructive" : "warning"}>
                  {a.label}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commandes récentes</CardTitle>
          <CardDescription>
            Dernières commandes créées sur la plateforme.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentOrders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune commande pour le moment.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Partenaire</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Créée le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">#{o.orderNumber}</TableCell>
                    <TableCell>{o.customer.fullName}</TableCell>
                    <TableCell>{o.partner.displayName}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          o.status === "DELIVERED"
                            ? "success"
                            : o.status === "REFUSED" || o.status === "RETURNED"
                              ? "destructive"
                              : o.status === "ON_HOLD"
                                ? "warning"
                                : "info"
                        }
                      >
                        {STATUS_LABELS[o.status] ?? o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.createdAt.toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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


