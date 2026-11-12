"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  formatRelativeTime,
  isReferralOrPartnerNotification,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_TONES,
} from "@/modules/notifications/labels";
import { cn } from "@/lib/utils";
import { MarkAllReadButton, MarkReadButton } from "./actions-buttons";
import type { NotificationType } from "@prisma/client";
import { useI18n } from "@/lib/i18n";
import {
  Bell,
  Package,
  TrendingUp,
  Receipt,
  ArrowUpRight,
  Boxes,
  Megaphone,
  UserPlus,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

function getFeedIcon(n: { type: NotificationType; title: string; body: string }): {
  Icon: LucideIcon;
  bgColor: string;
  textColor: string;
} {
  const isReferral = isReferralOrPartnerNotification(n);

  if (isReferral) {
    const text = `${n.title} ${n.body}`.toLowerCase();
    if (text.includes("validé") || text.includes("approved") || text.includes("موافقة")) {
      return { Icon: UserCheck, bgColor: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400", textColor: "text-emerald-600" };
    }
    return { Icon: UserPlus, bgColor: "bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400", textColor: "text-violet-600" };
  }

  switch (n.type) {
    case "ORDER_STATUS":
      return { Icon: Package, bgColor: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400", textColor: "text-blue-600" };
    case "EARNING":
      return { Icon: TrendingUp, bgColor: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400", textColor: "text-emerald-600" };
    case "SETTLEMENT":
      return { Icon: Receipt, bgColor: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400", textColor: "text-indigo-600" };
    case "WITHDRAWAL":
      return { Icon: ArrowUpRight, bgColor: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400", textColor: "text-amber-600" };
    case "STOCK":
      return { Icon: Boxes, bgColor: "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400", textColor: "text-rose-600" };
    case "ANNOUNCEMENT":
      return { Icon: Megaphone, bgColor: "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400", textColor: "text-purple-600" };
    case "SYSTEM":
    default:
      return { Icon: Bell, bgColor: "bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400", textColor: "text-sky-600" };
  }
}

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
          const { Icon, bgColor } = getFeedIcon(n);
          const relTime = formatRelativeTime(n.createdAt, nowDate, locale);

          return (
            <li key={n.id}>
              {showHeading && (
                <h2 className="pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {bucket}
                </h2>
              )}
              <div
                className={cn(
                  "flex items-start gap-3.5 rounded-xl border bg-card p-4 transition-all duration-150",
                  isUnread
                    ? "border-primary/40 bg-primary/[0.04] shadow-xs"
                    : "border-border/60 hover:bg-muted/30",
                )}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    bgColor,
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={NOTIFICATION_TYPE_TONES[n.type]} className="text-[11px] font-medium">
                      {typeLabel}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {relTime} · {formatTime(n.createdAt)}
                    </span>
                    {isUnread && (
                      <span className="h-2 w-2 rounded-full bg-primary" aria-label="Non lue" />
                    )}
                  </div>

                  <p className={cn("mt-1.5 text-sm", isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">{n.body}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2 self-center sm:self-start">
                  {n.link && (
                    <Button asChild variant="outline" size="sm" className="h-8 text-xs font-medium">
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
