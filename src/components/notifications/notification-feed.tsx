"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_TONES,
} from "@/modules/notifications/labels";
import { cn } from "@/lib/utils";
import { MarkAllReadButton, MarkReadButton } from "./actions-buttons";
import type { NotificationType } from "@prisma/client";
import { useI18n } from "@/lib/i18n";

export type NotificationRow = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

/**
 * Shared by /notifications and /mes-notifications — the two pages only differ
 * by their heading and empty-state wording, not by the feed itself.
 */
export function NotificationFeed({
  items,
  now,
  unread,
}: {
  items: NotificationRow[];
  now: string;
  unread: number;
}) {
  const { dict, formatDate, locale } = useI18n();

  if (items.length === 0) {
    return (
      <EmptyState
        title={dict.notifications.emptyTitle}
        description={dict.notifications.emptyDesc}
      />
    );
  }

  const nowDate = new Date(now);

  const getBucketLabel = (date: Date) => {
    const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((startOf(nowDate) - startOf(date)) / 86_400_000);
    if (days <= 0) return dict.notifications.today;
    if (days === 1) return dict.notifications.yesterday;
    return formatDate(date, {
      day: "2-digit",
      month: "long",
      year: date.getFullYear() === nowDate.getFullYear() ? undefined : "numeric",
    });
  };

  const buckets = items.map((n) => getBucketLabel(new Date(n.createdAt)));
  const rows = items.map((item, i) => ({
    item,
    bucket: buckets[i],
    showHeading: i === 0 || buckets[i - 1] !== buckets[i],
  }));

  const formatTime = (iso: string) => {
    const intlLocale = locale === "ar" ? "ar-TN" : locale === "en" ? "en-US" : "fr-FR";
    return new Date(iso).toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" });
  };

  const typeMap: Record<NotificationType, keyof typeof dict.notifications.types> = {
    ANNOUNCEMENT: "announcement",
    ORDER_STATUS: "orderStatus",
    EARNING: "earning",
    SETTLEMENT: "settlement",
    WITHDRAWAL: "withdrawal",
    STOCK: "stock",
    SYSTEM: "system",
  };

  return (
    <div className="space-y-6">
      {unread > 0 && (
        <div className="flex justify-end">
          <MarkAllReadButton />
        </div>
      )}

      <ul className="space-y-2">
        {rows.map(({ item: n, bucket, showHeading }) => {
          const isUnread = n.readAt === null;
          const mappedKey = typeMap[n.type];
          const typeLabel = (mappedKey && dict.notifications.types[mappedKey]) || NOTIFICATION_TYPE_LABELS[n.type] || n.type;

          return (
            <li key={n.id}>
              {showHeading && (
                <h2 className="pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {bucket}
                </h2>
              )}
              <div
                className={cn(
                  "flex flex-wrap items-start gap-3 rounded-lg border bg-card p-3.5",
                  isUnread && "border-primary/40 bg-primary/[0.04]",
                )}
              >
                <Badge variant={NOTIFICATION_TYPE_TONES[n.type]} className="mt-0.5 shrink-0">
                  {typeLabel}
                </Badge>

                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", isUnread ? "font-semibold" : "font-medium")}>
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatTime(n.createdAt)}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {n.link && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={n.link}>{dict.common.view}</Link>
                    </Button>
                  )}
                  {isUnread && <MarkReadButton notificationId={n.id} />}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
