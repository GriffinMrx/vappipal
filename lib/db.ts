import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { PrismaClient } from "./generated/prisma/client";

/**
 * Server-only Prisma client on Neon's POOLED connection (DATABASE_URL, host
 * with `-pooler`). One pg Pool per server instance; on Vercel Fluid compute
 * `attachDatabasePool` closes idle connections before the instance suspends.
 * Every query must be scoped to the signed-in Clerk user (AGENTS.md §5).
 */
function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({
    connectionString,
    max: 5,
    // Neon scales to zero; the first query after idle can take a few seconds.
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
  });
  attachDatabasePool(pool);

  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

// Reuse one client across hot reloads in development. If `prisma generate`
// produced a new client (schema changed), the class identity changes: drop
// the stale cached client instead of serving a client without the new models.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaClass?: typeof PrismaClient;
};

if (globalForPrisma.prisma && globalForPrisma.prismaClass !== PrismaClient) {
  void globalForPrisma.prisma.$disconnect();
  globalForPrisma.prisma = undefined;
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaClass = PrismaClient;
}
