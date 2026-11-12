"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

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
  const { dict, locale, formatDate } = useI18n();
  const t = dict.audit;
  const c = dict.common;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{c.date}</TableHead>
          <TableHead>{t.actor}</TableHead>
          <TableHead>{t.action}</TableHead>
          <TableHead>{t.entity}</TableHead>
          <TableHead>ID</TableHead>
          <TableHead className="text-right">{t.details}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((log) => {
          const actorName = log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : (locale === "ar" ? "النظام" : locale === "en" ? "System" : "Système");
          const hasDiff = Boolean(log.before || log.after);
          return (
            <TableRow key={log.id}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {formatDate(log.createdAt, {
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
                      {log.before != null && <div><span className="text-rose-600 font-bold">{locale === "ar" ? "قبل: " : locale === "en" ? "Before: " : "Avant: "}</span><pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(log.before, null, 1)}</pre></div>}
                      {log.after != null && <div><span className="text-emerald-600 font-bold">{locale === "ar" ? "بعد: " : locale === "en" ? "After: " : "Après: "}</span><pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(log.after, null, 1)}</pre></div>}
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
