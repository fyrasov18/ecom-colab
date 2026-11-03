"use client";

/**
 * LoginBackground — Swiss Minimalism geometric grid background.
 * Clean, architectural 1px hairline grid matching the Swiss international style.
 */
export function LoginBackground() {
  return (
    <div
      className="fixed inset-0 -z-10 bg-background"
      aria-hidden="true"
    >
      {/* Subtle mathematical grid lines */}
      <div
        className="absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
        style={{
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />
      {/* Subtle radial falloff for focus */}
      <div
        className="absolute inset-0 bg-radial-gradient from-transparent via-background/40 to-background"
      />
    </div>
  );
}
