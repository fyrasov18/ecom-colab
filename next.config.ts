import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lint runs via `npm run lint` in CI/Phase 8; builds must not be blocked
  // by lint config timing during phased delivery.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
