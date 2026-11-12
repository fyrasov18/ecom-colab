"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

/** Prev/Next pagination preserving current query string. */
export function Pagination({
  page,
  totalPages,
  searchParams,
}: {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { dict, isRtl } = useI18n();

  if (totalPages <= 1) return null;

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (typeof v === "string" && k !== "page") params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `?${qs}`;
  };

  const base =
    "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";

  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <nav className="flex items-center justify-between pt-4" aria-label="Pagination">
      <Link
        href={hrefFor(page - 1)}
        aria-disabled={page <= 1}
        className={cn(base, page <= 1 && "pointer-events-none opacity-50")}
      >
        <PrevIcon className="h-4 w-4" /> {dict.common?.previous ?? "Précédent"}
      </Link>
      <span className="text-sm tabular-nums text-muted-foreground font-medium">
        {dict.common?.page ?? "Page"} {page} / {totalPages}
      </span>
      <Link
        href={hrefFor(page + 1)}
        aria-disabled={page >= totalPages}
        className={cn(base, page >= totalPages && "pointer-events-none opacity-50")}
      >
        {dict.common?.next ?? "Suivant"} <NextIcon className="h-4 w-4" />
      </Link>
    </nav>
  );
}
