"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import type { SearchResults } from "@/modules/search/service";

/**
 * Header search. Results are fetched from /api/search, which derives its scope
 * from the session server-side — this component never asks for a wider scope.
 */
export function GlobalSearch() {
  const router = useRouter();
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
      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
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
        placeholder="Rechercher commande, client, produit…"
        aria-label="Recherche globale"
        role="combobox"
        aria-expanded={open}
        aria-controls="global-search-results"
        className="h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {open && query.trim().length >= 2 && (
        <div
          id="global-search-results"
          className="absolute left-0 right-0 top-11 z-50 max-h-96 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
        >
          {loading && (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Recherche…
            </div>
          )}

          {!loading && results && results.total === 0 && (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Aucun résultat pour « {results.query} ».
            </p>
          )}

          {!loading &&
            results?.groups.map((group) => (
              <div key={group.key} className="py-1">
                <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                {group.hits.map((hit) => (
                  <button
                    key={`${group.key}-${hit.id}`}
                    type="button"
                    onClick={() => go(hit.href)}
                    className="block w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="block truncate text-sm font-medium">
                      {hit.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {hit.subtitle}
                    </span>
                  </button>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
