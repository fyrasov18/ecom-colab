import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface EcomPartnerLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "horizontal" | "compact" | "mark" | "wordmark";
  theme?: "light" | "dark" | "auto";
  showTagline?: boolean;
  href?: string;
  iconOnly?: boolean;
}

/**
 * Official EcomPartner Vector Logo System
 * Complies with EcomPartner Brand & Visual Guidelines v1.0
 * Tagline: "Together, We Grow."
 */
export function EcomPartnerLogo({
  variant = "horizontal",
  theme = "auto",
  showTagline = true,
  href,
  iconOnly = false,
  className,
  ...props
}: EcomPartnerLogoProps) {
  // If iconOnly is specified, default to "mark"
  const actualVariant = iconOnly ? "mark" : variant;

  const content = (
    <div
      className={cn(
        "inline-flex items-center gap-3 select-none",
        theme === "dark" && "dark text-white",
        theme === "light" && "text-slate-900",
        className
      )}
      {...props}
    >
      {/* ── Standalone Mark ── */}
      {actualVariant === "mark" && (
        <svg
          viewBox="0 0 110 110"
          className="h-9 w-9 shrink-0 transition-transform duration-200"
          aria-label="EcomPartner"
        >
          <defs>
            <linearGradient id="ep-gradient-mark" x1="12" y1="24" x2="92" y2="84" gradientUnits="userSpaceOnUse">
              <stop stopColor="#A3E635" />
              <stop offset="0.48" stopColor="#10B981" />
              <stop offset="1" stopColor="#0F766E" />
            </linearGradient>
          </defs>
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path
              d="M18 29H68C82 29 91 38 91 51C91 64 82 73 68 73H48"
              stroke="url(#ep-gradient-mark)"
              strokeWidth="15"
            />
            <path d="M18 48H53" stroke="url(#ep-gradient-mark)" strokeWidth="12" />
            <path d="M18 67H43" stroke="url(#ep-gradient-mark)" strokeWidth="12" />
            <path
              d="M49 48H68C74 48 78 52 78 58C78 64 74 68 68 68H49"
              stroke="url(#ep-gradient-mark)"
              strokeWidth="12"
            />
            <path d="M48 48L40 82" stroke="url(#ep-gradient-mark)" strokeWidth="12" />
          </g>
          <circle cx="39" cy="96" r="6.5" fill="#10B981" />
          <circle cx="68" cy="96" r="6.5" fill="#10B981" />
        </svg>
      )}

      {/* ── Compact & Horizontal Logos ── */}
      {(actualVariant === "horizontal" || actualVariant === "compact") && (
        <div className="flex items-center gap-2.5">
          {/* Logo Symbol */}
          <svg
            viewBox="0 0 110 110"
            className="h-9 w-9 shrink-0"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="ep-gradient-h" x1="12" y1="24" x2="92" y2="84" gradientUnits="userSpaceOnUse">
                <stop stopColor="#A3E635" />
                <stop offset="0.48" stopColor="#10B981" />
                <stop offset="1" stopColor="#0F766E" />
              </linearGradient>
            </defs>
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path
                d="M18 29H68C82 29 91 38 91 51C91 64 82 73 68 73H48"
                stroke="url(#ep-gradient-h)"
                strokeWidth="15"
              />
              <path d="M18 48H53" stroke="url(#ep-gradient-h)" strokeWidth="12" />
              <path d="M18 67H43" stroke="url(#ep-gradient-h)" strokeWidth="12" />
              <path
                d="M49 48H68C74 48 78 52 78 58C78 64 74 68 68 68H49"
                stroke="url(#ep-gradient-h)"
                strokeWidth="12"
              />
              <path d="M48 48L40 82" stroke="url(#ep-gradient-h)" strokeWidth="12" />
            </g>
            <circle cx="39" cy="96" r="6.5" fill="#10B981" />
            <circle cx="68" cy="96" r="6.5" fill="#10B981" />
          </svg>

          {/* Wordmark & Tagline */}
          <div className="flex flex-col">
            <div className="flex items-baseline tracking-tight font-black leading-none">
              <span
                className={cn(
                  "text-lg transition-colors",
                  theme === "dark"
                    ? "text-white"
                    : theme === "light"
                    ? "text-slate-900"
                    : "text-slate-900 dark:text-white"
                )}
              >
                Ecom
              </span>
              <span className="text-lg text-emerald-500 font-bold ml-0.5">
                Partner
              </span>
            </div>
            {actualVariant === "horizontal" && showTagline && (
              <span
                className={cn(
                  "text-[9px] font-medium tracking-widest uppercase mt-0.5",
                  theme === "dark"
                    ? "text-slate-400"
                    : theme === "light"
                    ? "text-slate-500"
                    : "text-slate-500 dark:text-slate-400"
                )}
              >
                Together, We Grow.
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Wordmark Only ── */}
      {actualVariant === "wordmark" && (
        <div className="flex flex-col">
          <div className="flex items-baseline tracking-tight font-black leading-none">
            <span
              className={cn(
                "text-lg",
                theme === "dark"
                  ? "text-white"
                  : theme === "light"
                  ? "text-slate-900"
                  : "text-slate-900 dark:text-white"
              )}
            >
              Ecom
            </span>
            <span className="text-lg text-emerald-500 font-bold ml-0.5">
              Partner
            </span>
          </div>
          {showTagline && (
            <span
              className={cn(
                "text-[9px] font-medium tracking-widest uppercase mt-0.5",
                theme === "dark"
                  ? "text-slate-400"
                  : theme === "light"
                  ? "text-slate-500"
                  : "text-slate-500 dark:text-slate-400"
              )}
            >
              Together, We Grow.
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-md">
        {content}
      </Link>
    );
  }

  return content;
}
