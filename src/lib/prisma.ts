import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// Always cache the client — including production. On Vercel each serverless
// instance re-evaluates modules; without this every request creates a new
// PrismaClient with its own pool (limit 5), exhausting Postgres/Neon and
// surfacing as "Timed out fetching a new connection from the connection pool"
// in layouts (PartnerLayout → requireSession → getPartnerStatus).
if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;
