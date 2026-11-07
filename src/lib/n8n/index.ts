import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { enqueueBookingJob, enqueueReminder, removeReminderJob } from "@/lib/queue";

// App side of the n8n contract (docs/BOOKING-N8N.md): n8n → app callbacks and the meeting briefs they schedule.

const digest = (s: string) => createHash("sha256").update(s).digest();

/** X-Callback-Secret check, constant time (hashing first makes the lengths equal). */
export function hasCallbackSecret(req: Request) {
  const expected = serverEnv().N8N_CALLBACK_SECRET;
  const given = req.headers.get("x-callback-secret");
  return Boolean(expected && given && timingSafeEqual(digest(given), digest(expected)));
}

const id = z.string().min(1).max(40);
export const confirmedSchema = z.object({
  bookingId: id,
  calendarEventId: z.string().min(1).max(1024),
  meetUrl: z.url({ protocol: /^https$/ }).max(300),
});
export const failedSchema = z.object({ bookingId: id, error: z.string().max(500).optional() });

const BRIEFS = [
  { kind: "brief60", minutes: 60 },
  { kind: "brief15", minutes: 15 },
] as const;

/** Creates the 60/15-minute brief reminders (rows are the source of truth) and their delayed jobs. Idempotent. */
export async function scheduleBriefs(bookingId: string, startsAt: Date, now = new Date()) {
  for (const { kind, minutes } of BRIEFS) {
    const remindAt = new Date(startsAt.getTime() - minutes * 60_000);
    if (remindAt <= now) continue;
    const existing = await db.reminder.findFirst({ where: { bookingId, kind, status: "PENDING" } });
    const reminder = existing ?? (await db.reminder.create({ data: { bookingId, kind, remindAt, text: "" } }));
    await enqueueReminder(reminder.id, reminder.remindAt);
  }
}

/** Cancelled booking: its briefs must never be sent. */
export async function cancelBriefs(bookingId: string) {
  const reminders = await db.reminder.findMany({ where: { bookingId, status: "PENDING" } });
  await db.reminder.updateMany({ where: { bookingId, status: "PENDING" }, data: { status: "CANCELLED" } });
  for (const r of reminders) await removeReminderJob(r.id, r.remindAt);
}

export type ConfirmResult = "confirmed" | "unchanged" | "ignored_cancelled" | "not_found";

/**
 * booking-confirmed: idempotent (same payload twice = same result). A booking cancelled while n8n was working
 * keeps its CANCELLED status; its fresh Calendar event is removed through the normal cancel path.
 */
export async function confirmBooking(input: z.output<typeof confirmedSchema>): Promise<ConfirmResult> {
  const booking = await db.booking.findUnique({ where: { id: input.bookingId } });
  if (!booking) return "not_found";

  if (booking.status === "CANCELLED") {
    if (booking.calendarEventId !== input.calendarEventId) {
      await db.booking.update({ where: { id: booking.id }, data: { calendarEventId: input.calendarEventId } });
      await enqueueBookingJob("cancel-booking", booking.id, { cancelledBy: "visitor" });
    }
    return "ignored_cancelled";
  }
  if (booking.status !== "PENDING_MEET" && booking.status !== "CONFIRMED") return "unchanged"; // DONE / NO_SHOW

  const same =
    booking.status === "CONFIRMED" &&
    booking.meetUrl === input.meetUrl &&
    booking.calendarEventId === input.calendarEventId;
  if (!same) {
    await db.booking.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED", meetUrl: input.meetUrl, calendarEventId: input.calendarEventId },
    });
  }
  await scheduleBriefs(booking.id, booking.startsAt);
  return same ? "unchanged" : "confirmed";
}
