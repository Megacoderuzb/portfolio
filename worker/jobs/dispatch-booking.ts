import type { Job, Worker } from "bullmq";
import { db } from "@/lib/db";
import type { BookingJob } from "@/lib/queue/jobs";
import { cancelledPayload, createdPayload, postToN8n } from "../lib/n8n";

type Deps = { baseUrl: string; secret?: string; appUrl: string; adminUrl?: string; fetchImpl?: typeof fetch };

/**
 * Consumer for the `booking` queue:
 * - dispatch-booking → POST /webhook/booking-created (skipped once the booking is no longer PENDING_MEET,
 *   e.g. n8n already confirmed it or the visitor cancelled before a retry)
 * - cancel-booking   → POST /webhook/booking-cancelled
 * Retries/backoff come from the job options + the worker's custom backoff strategy.
 */
export function createBookingProcessor(deps: Deps) {
  return async (job: Job<BookingJob>) => {
    const booking = await db.booking.findUnique({
      where: { id: job.data.bookingId },
      include: { service: { select: { slug: true, content: true } } },
    });
    if (!booking) return "missing";

    if (job.name === "dispatch-booking") {
      if (booking.status !== "PENDING_MEET") return "skipped";
      await postToN8n({ ...deps, path: "booking-created", body: createdPayload(booking, deps.appUrl, deps.adminUrl) });
      return "sent";
    }
    await postToN8n({ ...deps, path: "booking-cancelled", body: cancelledPayload(booking, job.data.cancelledBy ?? "visitor") });
    return "sent";
  };
}

/** True once BullMQ will not retry again (attempts used up, or an UnrecoverableError). */
export const isFinalFailure = (job: Job, err: Error) =>
  err.name === "UnrecoverableError" || job.attemptsMade >= (job.opts.attempts ?? 1);

/** Uzbek owner alert after the last failed attempt. The booking simply stays PENDING_MEET. */
/** `adminBase`: where the admin panel lives (ADMIN_URL, or the site URL when it is not split). */
export const failureAlert = (job: Job<BookingJob>, adminBase: string) =>
  job.name === "dispatch-booking"
    ? `⚠️ Yangi yozilish n8n'ga yuborilmadi (${job.attemptsMade} urinish).\nGoogle Calendar/Meet yaratilmadi.\nAdmin → Bookings → "Retry dispatch": ${adminBase}/admin/bookings`
    : `⚠️ Bekor qilingan yozilish n8n'ga yuborilmadi: Calendar tadbirini qo'lda o'chiring.\n${adminBase}/admin/bookings`;

/** Logs every failure (ids only) and calls `alert` once a job has failed for good. */
export function onFinalFailure(worker: Worker<BookingJob>, alert: (job: Job<BookingJob>, err: Error) => Promise<unknown>) {
  worker.on("failed", (job, err) => {
    if (!job) return;
    console.error(`[worker] ${job.name} booking=${job.data.bookingId} attempt ${job.attemptsMade}: ${err.message}`);
    if (isFinalFailure(job, err)) void alert(job, err);
  });
}
