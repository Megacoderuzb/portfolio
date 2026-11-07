import { Redis } from "ioredis";
import { serverEnv } from "@/lib/env";

// One connection per process (reused across Next dev hot reloads). Created on first use, never at build time.
const globalForRedis = globalThis as unknown as { redis?: Redis };

export function redis() {
  globalForRedis.redis ??= new Redis(serverEnv().REDIS_URL, { maxRetriesPerRequest: 2 });
  return globalForRedis.redis;
}
