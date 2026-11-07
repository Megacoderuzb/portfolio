import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// One client per process; reuse it across Next dev hot reloads.
// Reads DATABASE_URL directly (not serverEnv()): importing this module must not throw during `next build`,
// which runs with NODE_ENV=production but without the runtime secrets. The adapter connects on first query;
// the env itself is validated at server start (src/instrumentation.ts).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
