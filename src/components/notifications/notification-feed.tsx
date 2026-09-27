import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  dayBucket,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_TONES,
} from "@/modules/notifications/labels";
import { cn } from "@/lib/utils";
import { MarkAllReadButton, MarkReadButton } from "./actions-buttons";
import type { NotificationType } from "@prisma/client";

export type NotificationRow = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

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
  if (items.length === 0) {
    return (
      <EmptyState
        title="Aucune notification"
        description="Vous serez informé ici de chaque événement important (commandes, gains, retraits)."
      />
    );
  }

  const nowDate = new Date(now);
  let currentBucket: string | null = null;

  return (
    <div className="space-y-6">
      {unread > 0 && (
        <div className="flex justify-end">
          <MarkAllReadButton />
        </div>
      )}

      <ul className="space-y-2">
        {items.map((n) => {
          const created = new Date(n.createdAt);
          const bucket = dayBucket(created, nowDate);
          const showHeading = bucket !== currentBucket;
          currentBucket = bucket;
          const isUnread = n.readAt === null;

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
                  {NOTIFICATION_TYPE_LABELS[n.type] ?? n.type}
                </Badge>

                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", isUnread ? "font-semibold" : "font-medium")}>
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{time(n.createdAt)}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {n.link && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={n.link}>Ouvrir</Link>
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
