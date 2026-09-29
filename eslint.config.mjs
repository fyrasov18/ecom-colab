import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * ESLint 9 flat config — the single lint entry point for local runs and CI
 * (`npm run lint`). Next.js 16's shared configs are already flat arrays, so
 * they are spread directly instead of going through the legacy compat layer.
 */
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
      "public/uploads/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Architecture guard (Phase 1): the app shell composes domain modules, it
    // never talks to the database directly. Data access lives in
    // `src/modules/**` (and `src/lib/prisma.ts`), which also keeps every query
    // testable and permission-scoped.
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/prisma",
              message:
                "Import a domain module query/service instead (src/modules/**). Routes and components must not use Prisma directly.",
            },
          ],
        },
      ],
    },
  },
  {
    // The codebase marks intentionally unused values with a leading underscore
    // (e.g. the `_prev` argument `useActionState` requires server actions to
    // accept). Honour that convention instead of warning on every action.
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // CLI scripts and seeds intentionally print to stdout.
    files: ["scripts/**/*.{ts,mjs}", "prisma/seed.ts"],
    rules: { "no-console": "off" },
  },
];

export default eslintConfig;
