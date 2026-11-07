import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads .env itself. Missing file is fine (Docker passes real env vars).
try {
  process.loadEnvFile();
} catch {}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx seed/seed.ts",
  },
  // optional: `prisma generate` must work without a database URL (Docker build)
  datasource: { url: process.env.DATABASE_URL },
});
