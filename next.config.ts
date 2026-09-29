import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lint runs via `npm run lint` in CI/Phase 8; builds must not be blocked
  // by lint config timing during phased delivery.
  eslint: { ignoreDuringBuilds: true },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // Camera/microphone/geo are unused; payment and clipboard stay on.
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
