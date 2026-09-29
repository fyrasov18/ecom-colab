/**
 * Every page opens with the same three questions: where am I, what is this,
 * what can I do. This component answers all three in one consistent block.
 */
export function PageHeader({
  title,
  description,
  action,
  meta,
}: {
  title: string;
  description?: React.ReactNode;
  /** Primary action rendered on the right (desktop) / below (mobile). */
  action?: React.ReactNode;
  /** Optional counts or context line under the title. */
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
        {meta && <div className="text-xs text-muted-foreground">{meta}</div>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
