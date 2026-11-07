import { Queue } from "bullmq";
import { serverEnv } from "@/lib/env";
import { errorLabel, log } from "@/lib/log";
import {
  BOOKING_QUEUE,
  deliverJob,
  DISPATCH_ATTEMPTS,
  redisConnection,
  REMINDER_QUEUE,
  reminderJobId,
  type BookingJob,
  type BookingJobName,
  type ReminderJob,
} from "./jobs";

let bookingQueue: Queue<BookingJob> | undefined;
let reminderQueue: Queue<ReminderJob> | undefined;
const connection = () => redisConnection(serverEnv().REDIS_URL);

/**
 * Adds a booking job (consumed by worker/). Never throws: a Redis outage must not fail the visitor's booking —
 * it stays PENDING_MEET and the owner can "Retry dispatch" in admin.
 */
export async function enqueueBookingJob(
  name: BookingJobName,
  bookingId: string,
  extra: Omit<BookingJob, "bookingId"> = {},
) {
  try {
    bookingQueue ??= new Queue<BookingJob>(BOOKING_QUEUE, { connection: connection() });
    await bookingQueue.add(
      name,
      { bookingId, ...extra },
      { attempts: DISPATCH_ATTEMPTS, backoff: { type: "custom" }, removeOnComplete: 500, removeOnFail: 1000 },
    );
    return true;
  } catch (e) {
    log.error("queue.enqueue_failed", { job: name, error: errorLabel(e) });
    return false;
  }
}

/** Schedules one reminder delivery at `remindAt` (deterministic jobId: safe to call twice). */
export async function enqueueReminder(id: string, remindAt: Date) {
  try {
    reminderQueue ??= new Queue<ReminderJob>(REMINDER_QUEUE, { connection: connection() });
    await reminderQueue.add(...deliverJob(id, remindAt));
  } catch (e) {
    // the worker re-enqueues every PENDING reminder on start (phase 06), so this is recoverable
    log.error("queue.enqueue_reminder_failed", { error: errorLabel(e) });
  }
}

export async function removeReminderJob(id: string, remindAt: Date) {
  try {
    reminderQueue ??= new Queue<ReminderJob>(REMINDER_QUEUE, { connection: connection() });
    await reminderQueue.remove(reminderJobId(id, remindAt));
  } catch (e) {
    log.error("queue.remove_reminder_failed", { error: errorLabel(e) });
  }
}
