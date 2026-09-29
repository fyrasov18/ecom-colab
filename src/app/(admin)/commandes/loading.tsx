import { Skeleton } from "@/components/ui/skeleton";

/**
 * Orders list loading state. Mirrors the real table + filter bar so the layout
 * does not jump when rows arrive.
 */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement des commandes…</span>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-40" />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-4 border-b bg-ink-50 px-4 py-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 w-24" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, row) => (
          <div
            key={row}
            className="flex items-center gap-4 border-b px-4 last:border-b-0"
            style={{ minHeight: 56 }}
          >
            {Array.from({ length: 7 }).map((_, col) => (
              <Skeleton
                key={col}
                className="h-3.5"
                style={{ width: col === 0 ? 56 : 96 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}