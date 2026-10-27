"use client";

/**
 * LoginBackground — animated mesh gradient background for the login page.
 *
 * Pure CSS — the mesh-drift keyframe runs entirely on the GPU compositor.
 * No JavaScript animation loop, safe on low-end mobile devices.
 *
 * Also renders a subtle noise texture overlay for the "premium dark" feel
 * using an inline SVG data-URI (zero network requests).
 */
export function LoginBackground() {
  return (
    <>
      {/* Mesh gradient layer */}
      <div
        className="fixed inset-0 -z-10 bg-mesh-animated"
        aria-hidden="true"
      />
      {/* Fine noise texture — adds depth without weight */}
      <div
        className="fixed inset-0 -z-10 opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
        aria-hidden="true"
      />
      {/* Top-right accent orb */}
      <div
        className="fixed -top-32 -right-32 -z-10 h-[500px] w-[500px] rounded-full opacity-20"
        style={{
          background:
            "radial-gradient(circle, rgba(37,99,235,0.6) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
        aria-hidden="true"
      />
      {/* Bottom-left accent orb */}
      <div
        className="fixed -bottom-32 -left-32 -z-10 h-[400px] w-[400px] rounded-full opacity-15"
        style={{
          background:
            "radial-gradient(circle, rgba(30,58,138,0.7) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
        aria-hidden="true"
      />
    </>
  );
}
