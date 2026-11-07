import { connection } from "next/server";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { HEARTBEAT_KEY } from "@/lib/queue/jobs";
import { redis } from "@/lib/queue/redis";

// The worker refreshes its heartbeat every 30 s; older than this means it is down or stuck.
const WORKER_STALE_MS = 90_000;

const within = <T>(promise: Promise<T>, ms = 2000) =>
  Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

/** { ok, db, redis, worker }. 503 when the app itself can't work (db or redis down); the worker is reported, not required. */
export const GET = route("api/health", async () => {
  await connection();
  const [dbOk, heartbeat] = await Promise.all([
    within(db.$queryRaw`SELECT 1`).then(
      () => true,
      () => false,
    ),
    within(redis().get(HEARTBEAT_KEY)).then(
      (lastBeat) => ({ redis: true, lastBeat }),
      () => ({ redis: false, lastBeat: null }),
    ),
  ]);
  const { lastBeat } = heartbeat;
  const worker = { ok: lastBeat !== null && Date.now() - Date.parse(lastBeat) < WORKER_STALE_MS, lastBeat };
  const ok = dbOk && heartbeat.redis;
  return Response.json(
    { ok, db: dbOk, redis: heartbeat.redis, worker },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
});
