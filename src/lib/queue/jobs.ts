// Queue names, job payloads and the Redis connection shape: shared by the app (producer) and worker/ (consumer).
// No app imports here, so the worker can use it without pulling in the Next/env stack.

export const BOOKING_QUEUE = "booking";
export type BookingJobName = "dispatch-booking" | "cancel-booking";
export type BookingJob = { bookingId: string; cancelledBy?: "visitor" | "owner" };

/** Delayed reminder deliveries (bot reminders + meeting briefs) and the digests. Postgres is the source of truth. */
export const REMINDER_QUEUE = "reminders";
export type ReminderJob =
  | { reminderId: string; at: number } // "deliver": `at` = the remindAt (ms) this job was scheduled for
  | { reminderId: string; sentAt: number } // "repeat": the one gentle repeat 30 min after an unacknowledged send
  | { digest: "morning" | "evening" }; // "digest": job scheduler, 08:30 / 21:00 Tashkent
/** Deterministic id: re-enqueueing the same reminder (worker restart, retries) never duplicates it. */
export const reminderJobId = (id: string, remindAt: Date) => `reminder:${id}:${remindAt.getTime()}`;
export const repeatJobId = (id: string, sentAt: Date) => `repeat:${id}:${sentAt.getTime()}`;

// Finished jobs are removed so a deterministic id is free again; a reminder whose job failed for good is
// still PENDING in Postgres and gets re-enqueued by the worker's restore sweep.
const reminderJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 30_000 },
  removeOnComplete: true,
  removeOnFail: true,
};

/** Queue.add() arguments for delivering reminder `id` at `remindAt` (app and worker share this). */
export const deliverJob = (id: string, remindAt: Date, now = Date.now()) =>
  [
    "deliver",
    { reminderId: id, at: remindAt.getTime() },
    { ...reminderJobOptions, jobId: reminderJobId(id, remindAt), delay: Math.max(0, remindAt.getTime() - now) },
  ] as const;

export const repeatJob = (id: string, sentAt: Date, delayMs = 30 * 60_000) =>
  [
    "repeat",
    { reminderId: id, sentAt: sentAt.getTime() },
    { ...reminderJobOptions, jobId: repeatJobId(id, sentAt), delay: delayMs },
  ] as const;

/** Redis key the worker refreshes every 30 s; /api/health reports its age. */
export const HEARTBEAT_KEY = "worker:heartbeat";

/** n8n dispatch: 5 attempts; waits before retry 1…4 (custom backoff strategy in the worker). */
export const DISPATCH_ATTEMPTS = 5;
export const DISPATCH_RETRY_DELAYS_MS = [10_000, 30_000, 120_000, 600_000];
export const dispatchBackoff = (attemptsMade: number, delays = DISPATCH_RETRY_DELAYS_MS) =>
  delays[Math.min(attemptsMade, delays.length) - 1] ?? delays[0];

/** redis://user:pass@host:port/db → BullMQ connection options (BullMQ bundles its own ioredis). */
export function redisConnection(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username || undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: Number(u.pathname.slice(1) || 0),
  };
}
