"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import type { SearchResults } from "@/modules/search/service";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Header search. Results are fetched from /api/search, which derives its scope
 * from the session server-side — this component never asks for a wider scope.
 */
export function GlobalSearch() {
  const router = useRouter();
  const { t, isRtl } = useI18n();
  const [query, setQuery] = useState("");
  // The last query that finished loading, plus its data (null on failure).
  // `loading`/`results` are derived from it during render instead of being
  // set inside the effect, which avoids a cascading render per keystroke.
  const [settled, setSettled] = useState<{
    query: string;
    data: SearchResults | null;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const q = query.trim();
  const active = q.length >= 2;
  // Still loading whenever the visible query differs from the last one settled.
  const loading = active && settled?.query !== q;
  const results = !active || settled?.query !== q ? null : settled.data;

  // Debounced fetch. State is only updated from the timer callback, i.e. in
  // response to the network — never synchronously in the effect body.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = (await res.json()) as SearchResults;
          if (!cancelled) setSettled({ query: q, data });
        } else if (!cancelled) {
          setSettled({ query: q, data: null });
        }
      } catch {
        // Search is best-effort: a failure must not break the header.
        if (!cancelled) setSettled({ query: q, data: null });
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, active]);

  // Close on outside click.
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Escape closes the dropdown (keyboard accessibility).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <div ref={boxRef} className="relative hidden w-full max-w-md md:block">
      <Search
        className={cn(
          "pointer-events-none absolute top-2.5 h-4 w-4 text-muted-foreground",
          isRtl ? "right-2.5" : "left-2.5",
        )}
      />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results?.groups[0]?.hits[0]) {
            go(results.groups[0].hits[0].href);
          }
        }}
        placeholder={t("nav.searchPlaceholder")}
        aria-label="Recherche globale"
        role="combobox"
        aria-expanded={open}
        aria-controls="global-search-results"
        className={cn(
          "h-9 w-full rounded-md border border-input bg-card text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isRtl ? "pr-8 pl-3 text-right" : "pl-8 pr-3 text-left",
        )}
      />

      {open && query.trim().length >= 2 && (
        <div
          id="global-search-results"
          className="absolute left-0 right-0 top-11 z-50 max-h-96 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lift"
        >
          {loading && (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
            </div>
          )}

          {!loading && results && results.total === 0 && (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              {t("common.noData")}
            </p>
          )}

          {!loading &&
            results?.groups.map((group) => (
              <div key={group.key} className="py-1">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.hits.map((hit) => (
                    <button
                      key={hit.id}
                      type="button"
                      onClick={() => go(hit.href)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-sm px-3 py-1.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground",
                        isRtl ? "text-right" : "text-left",
                      )}
                    >
                      <span className="font-medium">{hit.title}</span>
                      {hit.subtitle && (
                        <span className="text-[11px] text-muted-foreground">
                          {hit.subtitle}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
