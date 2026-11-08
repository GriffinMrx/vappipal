// Prisma CLI config (migrate, generate, studio).
// Loads env the same way Next.js does (.env.local, .env, …).
import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // CLI uses the DIRECT (non-pooled) connection: migrations need session
    // features that the PgBouncer pooler doesn't support. The app itself uses
    // the pooled DATABASE_URL (see lib/db.ts).
    url: process.env.DATABASE_URL_UNPOOLED ?? "",
  },
});
