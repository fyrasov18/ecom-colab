import type { Metadata } from "next";
import { requireSession } from "@/lib/rbac";
import { listNotifications } from "@/modules/notifications/queries";
import { NOTIFICATION_TYPE_LABELS } from "@/modules/notifications/labels";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Pagination } from "@/components/ui/pagination";
import { NotificationFeed, type NotificationRow } from "@/components/notifications/notification-feed";
import { BellRing } from "lucide-react";
import type { NotificationType } from "@prisma/client";

export const metadata: Metadata = { title: "Mes notifications" };
export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "all", label: "Toutes" },
  { key: "unread", label: "Non lues" },
  { key: "read", label: "Lues" },
] as const;

const TYPES = Object.keys(NOTIFICATION_TYPE_LABELS) as NotificationType[];

export default async function MesNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireSession(["PARTNER"]);
  const sp = await searchParams;

  const page = typeof sp.page === "string" ? Math.max(1, parseInt(sp.page, 10) || 1) : 1;
  const rawView = typeof sp.view === "string" ? sp.view : "all";
  const view = (["all", "unread", "read"].includes(rawView) ? rawView : "all") as
    | "all"
    | "unread"
    | "read";
  const rawType = typeof sp.type === "string" ? sp.type : "ALL";
  const type = (TYPES.includes(rawType as NotificationType) ? rawType : "ALL") as
    | NotificationType
    | "ALL";

  const data = await listNotifications(user.id, { page, view, type });

  const rows: NotificationRow[] = data.items.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mes notifications</h1>
        <p className="text-sm text-muted-foreground">
          Suivi de vos commandes, de vos gains et de vos retraits.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Affichage</label>
              <NativeSelect name="view" defaultValue={view}>
                {VIEWS.map((v) => (
                  <option key={v.key} value={v.key}>{v.label}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <NativeSelect name="type" defaultValue={type}>
                <option value="ALL">Tous les types</option>
                {TYPES.map((t) => (
                  <option key={t} value={t}>{NOTIFICATION_TYPE_LABELS[t]}</option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit" variant="secondary" size="sm">Filtrer</Button>
          </form>
        </CardContent>
      </Card>

      {data.unread > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <BellRing className="h-4 w-4 text-primary" />
          {data.unread} notification(s) non lue(s)
        </p>
      )}

      <NotificationFeed items={rows} now={new Date().toISOString()} unread={data.unread} />

      {data.total > 0 && (
        <Pagination page={data.page} totalPages={data.totalPages} searchParams={sp} />
      )}
    </div>
  );
}

