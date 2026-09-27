"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export type AuditLogItem = {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: { firstName: string; lastName: string; role: string } | null;
  before: unknown;
  after: unknown;
};

export function AuditTable({ items }: { items: AuditLogItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Acteur</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Entité</TableHead>
          <TableHead>ID</TableHead>
          <TableHead className="text-right">Détails</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((log) => {
          const actorName = log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "Système";
          const hasDiff = Boolean(log.before || log.after);
          return (
            <TableRow key={log.id}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {new Date(log.createdAt).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </TableCell>
              <TableCell>
                <div className="text-sm font-medium">{actorName}</div>
                <div className="text-xs text-muted-foreground">{log.actor?.role ?? "SYSTEM"}</div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-mono text-[11px]">{log.action}</Badge>
              </TableCell>
              <TableCell className="text-xs font-semibold">{log.entityType}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {log.entityId ? log.entityId.slice(0, 10) + "…" : "—"}
              </TableCell>
              <TableCell className="text-right">
                {hasDiff ? (
                  <details className="text-left text-xs">
                    <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">Diff</summary>
                    <div className="mt-2 max-w-xs rounded bg-muted/70 p-2 font-mono text-[11px]">
                      {log.before != null && <div><span className="text-rose-600 font-bold">Avant: </span><pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(log.before, null, 1)}</pre></div>}
                      {log.after != null && <div><span className="text-emerald-600 font-bold">Après: </span><pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(log.after, null, 1)}</pre></div>}
                    </div>
                  </details>
                ) : "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
