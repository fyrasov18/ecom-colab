import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { listCustomers } from "@/modules/customers/queries";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total, totalPages } = await listCustomers({ search: q, page });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <p className="text-sm text-muted-foreground">
          {total} client(s) — chaque client appartient au partenaire qui l'a
          saisi (téléphone = identifiant par partenaire).
        </p>
      </div>

      <form className="flex flex-wrap items-center gap-3" method="GET">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Nom, téléphone ou ville…"
            className="flex h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Rechercher
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="Aucun client"
          description="Les clients sont créés automatiquement lorsqu'un partenaire saisit une commande."
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Localisation</TableHead>
                <TableHead>Partenaire</TableHead>
                <TableHead>Commandes</TableHead>
                <TableHead>Dernière MAJ</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.city}, {c.governorate}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.ownerPartner.displayName}
                  </TableCell>
                  <TableCell>{c._count.orders}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.updatedAt.toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/clients/${c.id}`}>Voir</Link>
                    </Button>
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

