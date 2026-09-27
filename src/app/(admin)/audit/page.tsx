import type { Metadata } from "next";
import { requireSession } from "@/lib/rbac";
import { listAuditLogs } from "@/modules/audit/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, ShieldCheck } from "lucide-react";
import { AuditTable } from "./audit-table";

export const metadata: Metadata = { title: "Journal d'audit" };
export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireSession(["SUPER_ADMIN"]);
  const sp = await searchParams;
  const page = typeof sp.page === "string" ? Math.max(1, parseInt(sp.page, 10) || 1) : 1;
  const q = typeof sp.q === "string" ? sp.q : "";
  const entityType = typeof sp.entityType === "string" ? sp.entityType : "ALL";
  const action = typeof sp.action === "string" ? sp.action : "ALL";

  const data = await listAuditLogs({ page, pageSize: 30, q, entityType, action });

  const serializedItems = data.items.map((log) => ({
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    actor: log.actor
      ? { firstName: log.actor.firstName, lastName: log.actor.lastName, role: log.actor.role }
      : null,
    before: log.before,
    after: log.after,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Journal d&apos;audit</h1>
          <p className="text-sm text-muted-foreground">
            Traçabilité des opérations sensibles (acteur, action, entité, horodatage).
          </p>
        </div>
        <Badge variant="outline" className="w-fit gap-1 border-primary/30 text-primary">
          <ShieldCheck className="h-3.5 w-3.5" /> Super Admin
        </Badge>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Recherche</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input name="q" defaultValue={q} placeholder="Action, type d'entité, ID..." className="pl-8 text-sm" />
              </div>
            </div>
            <div className="w-48 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Entité</label>
              <NativeSelect name="entityType" defaultValue={entityType}>
                <option value="ALL">Tous les types</option>
                {data.availableEntityTypes.map((et) => (
                  <option key={et} value={et}>{et}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="w-56 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Action</label>
              <NativeSelect name="action" defaultValue={action}>
                <option value="ALL">Toutes les actions</option>
                {data.availableActions.map((act) => (
                  <option key={act} value={act}>{act}</option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit" variant="secondary" size="sm">Filtrer</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-medium">Entrées ({data.total})</CardTitle>
        </CardHeader>
        <CardContent>
          {serializedItems.length === 0 ? (
            <EmptyState
              title="Aucun enregistrement"
              description="Aucun événement d'audit ne correspond à vos filtres."
            />
          ) : (
            <div className="space-y-4">
              <AuditTable items={serializedItems} />
              <Pagination page={data.page} totalPages={data.totalPages} searchParams={sp} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

