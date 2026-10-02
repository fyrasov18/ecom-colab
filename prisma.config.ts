import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration.
 *
 * This REPLACES the deprecated `package.json#prisma` key, which Prisma 6 warns
 * about ("will be removed in Prisma 7"). Moving the seed command here keeps the
 * project ready for Prisma 7 without changing how anything behaves today.
 *
 * Environment loading: unlike the old behaviour, the Prisma CLI does NOT
 * automatically read `.env` once a config file exists. We load it explicitly
 * with Node's built-in `process.loadEnvFile()` (Node >= 20.12), so we do not
 * need to add the `dotenv` package. Variables already present in the real
 * environment (CI, Vercel, Docker) take precedence — `loadEnvFile` never
 * overwrites them — so production secrets are never shadowed by a stray `.env`.
 */
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No `.env` on this machine (CI/CD and serverless set real env vars) —
    // nothing to load, and that is not an error.
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // `npx prisma db seed` — development only; refuses to run on production.
    seed: "tsx prisma/seed.ts",
  },
});