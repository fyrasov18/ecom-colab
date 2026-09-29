import { cn } from "@/lib/utils";

/**
 * Loading placeholder. Skeletons mirror the real layout so the page does not
 * jump when data arrives (and never block the whole screen with a spinner).
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-ink-200 dark:bg-ink-800", className)}
      {...props}
    />
  );
}

/** A block of text lines, for "loading a paragraph" cases. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          style={{ width: i === lines - 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  );
}
