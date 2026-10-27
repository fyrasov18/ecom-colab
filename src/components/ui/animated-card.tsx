"use client";

/**
 * AnimatedCard — agency-level KPI card with:
 *   • scale-in entrance on first mount (CSS only, no JS)
 *   • CSS hover-glow effect
 *   • optional animated number counter (Framer Motion)
 *   • prefers-reduced-motion aware
 *
 * Usage:
 *   <AnimatedCard delay={0}>…children…</AnimatedCard>
 *   <AnimatedKpiValue value={1234} suffix=" DT" />
 */

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/* ─── AnimatedCard ─────────────────────────────────────────────────────────── */

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger delay in ms (0, 75, 150, 225 …) */
  delay?: number;
  /** Disable hover glow (e.g. non-interactive cards) */
  noGlow?: boolean;
}

export function AnimatedCard({
  children,
  className,
  delay = 0,
  noGlow = false,
}: AnimatedCardProps) {
  return (
    <div
      className={cn(
        "animate-scale-in rounded-xl border bg-card text-card-foreground shadow-card",
        !noGlow && "hover-glow",
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── AnimatedKpiValue ─────────────────────────────────────────────────────── */

interface AnimatedKpiValueProps {
  /** Target number to count up to */
  value: number;
  /** Text appended after the number (e.g. " DT", "%") */
  suffix?: string;
  /** Text prepended before (e.g. "+") */
  prefix?: string;
  /** Decimal places to show */
  decimals?: number;
  className?: string;
  /** Delay start in ms to align with card stagger */
  delay?: number;
}

/**
 * Counts from 0 → value over ~900 ms using requestAnimationFrame.
 * Falls back to static display when prefers-reduced-motion is set.
 */
export function AnimatedKpiValue({
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
  className,
  delay = 0,
}: AnimatedKpiValueProps) {
  const reducedMotion = useReducedMotion();
  const [displayed, setDisplayed] = useState(reducedMotion ? value : 0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const DURATION = 900; // ms

  useEffect(() => {
    if (reducedMotion) {
      setDisplayed(value);
      return;
    }

    const timer = setTimeout(() => {
      function tick(now: number) {
        if (startRef.current === null) startRef.current = now;
        const elapsed = now - startRef.current;
        const progress = Math.min(elapsed / DURATION, 1);
        // ease-out-quart
        const eased = 1 - Math.pow(1 - progress, 4);
        setDisplayed(parseFloat((eased * value).toFixed(decimals)));
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setDisplayed(value);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      startRef.current = null;
    };
  }, [value, delay, decimals, reducedMotion]);

  const formatted =
    decimals > 0
      ? displayed.toFixed(decimals)
      : Math.round(displayed).toLocaleString("fr-TN");

  return (
    <span
      className={cn(
        "tabular-nums animate-fade-up",
        className,
      )}
      style={{ animationDelay: `${delay + 80}ms` }}
      aria-label={`${prefix}${value}${suffix}`}
    >
      {prefix}{formatted}{suffix}
    </span>
  );
}

/* ─── SkeletonCard ─────────────────────────────────────────────────────────── */

/** Shimmer skeleton — drop-in while data is loading */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card shadow-card overflow-hidden",
        className,
      )}
      aria-hidden="true"
    >
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-3 w-24 rounded animate-shimmer" />
          <div className="h-4 w-4 rounded-full animate-shimmer" />
        </div>
        <div className="h-7 w-20 rounded animate-shimmer" />
        <div className="h-2.5 w-32 rounded animate-shimmer" />
      </div>
    </div>
  );
}
