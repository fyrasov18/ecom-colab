import { cn } from "@/lib/utils";

export type TimelineEntry = {
  id: string;
  /** Title, e.g. "Livrée" or "Statut mis à jour". */
  title: string;
  /** When it happened. */
  at: Date | string;
  /** Who did it — omit when it is not useful. */
  actor?: string | null;
  /** Optional supporting detail. */
  detail?: React.ReactNode;
  /** Visual state of the dot. */
  tone?: "default" | "success" | "warning" | "destructive" | "muted";
};

const TONE_DOT: Record<NonNullable<TimelineEntry["tone"]>, string> = {
  default: "bg-primary",
  success: "bg-success-600",
  warning: "bg-warning-600",
  destructive: "bg-danger-600",
  muted: "bg-ink-300",
};

function formatAt(at: Date | string) {
  const date = typeof at === "string" ? new Date(at) : at;
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Vertical event history. Entries are rendered newest-first by default, which
 * matches how operators read a case ("what just happened?").
 */
export function Timeline({
  entries,
  className,
  emptyLabel = "Aucun événement pour l'instant.",
}: {
  entries: TimelineEntry[];
  className?: string;
  emptyLabel?: string;
}) {
  if (entries.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ol className={cn("relative space-y-4", className)}>
      {entries.map((entry, index) => {
        const isLast = index === entries.length - 1;
        const tone = entry.tone ?? "default";
        return (
          <li key={entry.id} className="relative flex gap-3 pb-1">
            {/* Rail + dot */}
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                  TONE_DOT[tone],
                )}
                aria-hidden="true"
              />
              {!isLast && (
                <span
                  className="mt-1 w-px flex-1 bg-border"
                  aria-hidden="true"
                />
              )}
            </div>

            <div className="min-w-0 flex-1 pb-2">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="text-sm font-medium text-foreground">{entry.title}</p>
                <time
                  className="text-xs text-muted-foreground"
                  dateTime={
                    typeof entry.at === "string" ? entry.at : entry.at.toISOString()
                  }
                >
                  {formatAt(entry.at)}
                </time>
              </div>
              {entry.actor && (
                <p className="text-xs text-muted-foreground">Par : {entry.actor}</p>
              )}
              {entry.detail && (
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {entry.detail}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
