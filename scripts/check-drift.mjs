// Dev-only: verify prisma/schema.prisma matches the migrated database.
// Reads DATABASE_URL from .env and NEVER prints it.
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const envText = fs.readFileSync(".env", "utf8");
const match = envText.match(/^DATABASE_URL\s*=\s*["']?([^"'\r\n]+)/m);
if (!match) {
  console.error("DATABASE_URL not found in .env");
  process.exit(1);
}

try {
  execFileSync(
    process.execPath,
    [
      "node_modules/prisma/build/index.js",
      "migrate",
      "diff",
      "--from-url",
      match[1].trim(),
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--exit-code",
    ],
    { stdio: "inherit" },
  );
  console.log("NO DRIFT: schema matches migrations.");
} catch (e) {
  console.error("DRIFT DETECTED (exit code " + e.status + ")");
  process.exit(e.status ?? 1);
}
