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
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

const TYPES = Object.keys(NOTIFICATION_TYPE_LABELS) as NotificationType[];

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const sp = await searchParams;

  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.notifications;
  const c = dict.common;

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

  const views = [
    { key: "all", label: locale === "ar" ? "الكل" : locale === "en" ? "All" : "Toutes" },
    { key: "unread", label: locale === "ar" ? "غير مقروءة" : locale === "en" ? "Unread" : "Non lues" },
    { key: "read", label: locale === "ar" ? "مقروءة" : locale === "en" ? "Read" : "Lues" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">
          {locale === "ar"
            ? "مركز التنبيهات الداخلي: طلبات السحب، الأرباح المحررة ونفاد المخزون."
            : locale === "en"
            ? "Internal alert center: withdrawal requests, released earnings, out of stock."
            : "Centre d'alertes interne : demandes de retrait, gains débloqués, ruptures de stock."}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{locale === "ar" ? "العرض" : locale === "en" ? "View" : "Affichage"}</label>
              <NativeSelect name="view" defaultValue={view}>
                {views.map((v) => (
                  <option key={v.key} value={v.key}>{v.label}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{locale === "ar" ? "النوع" : locale === "en" ? "Type" : "Type"}</label>
              <NativeSelect name="type" defaultValue={type}>
                <option value="ALL">{locale === "ar" ? "جميع الأنواع" : locale === "en" ? "All types" : "Tous les types"}</option>
                {TYPES.map((tp) => (
                  <option key={tp} value={tp}>{NOTIFICATION_TYPE_LABELS[tp]}</option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit" variant="secondary" size="sm">{c.filter}</Button>
          </form>
        </CardContent>
      </Card>

      {data.unread > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <BellRing className="h-4 w-4 text-primary" />
          {data.unread} {locale === "ar" ? "إشعارات غير مقروءة" : locale === "en" ? "unread notification(s)" : "notification(s) non lue(s)"}
        </p>
      )}

      <NotificationFeed items={rows} now={new Date().toISOString()} unread={data.unread} />

      {data.total > 0 && (
        <Pagination page={data.page} totalPages={data.totalPages} searchParams={sp} />
      )}
    </div>
  );
}
