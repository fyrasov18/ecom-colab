import { defineConfig } from "vitest/config";
import path from "node:path";

/** Integration tests — run against the dev DB with full cleanup.
 *  Usage: npm run test:int */
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.int.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Sequential: they share the database.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
