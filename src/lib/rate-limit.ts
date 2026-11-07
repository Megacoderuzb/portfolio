import { RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible";
import { redis } from "@/lib/queue/redis";

const limiters = new Map<string, RateLimiterRedis>();

/** Redis-backed limiter (shared by app instances); falls back to in-memory if Redis is down. */
export function limiter(name: string, points: number, durationSeconds: number) {
  let l = limiters.get(name);
  if (!l) {
    l = new RateLimiterRedis({
      storeClient: redis(),
      keyPrefix: `rl:${name}`,
      points,
      duration: durationSeconds,
      insuranceLimiter: new RateLimiterMemory({ points, duration: durationSeconds }),
    });
    limiters.set(name, l);
  }
  return l;
}

/** Counts one hit for `key`; false when the limit is exhausted. */
export async function allow(l: RateLimiterRedis, key: string) {
  try {
    await l.consume(key);
    return true;
  } catch (e) {
    if (e instanceof RateLimiterRes) return false;
    throw e;
  }
}
