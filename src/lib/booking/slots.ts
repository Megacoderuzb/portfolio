import { DateTime } from "luxon";
import { z } from "zod";
import { minutesOf, OWNER_ZONE } from "@/lib/time";

// Pure slot math (docs/SPEC.md §5). No DB, no clock: callers pass `now` and the busy intervals.

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use HH:mm");

export const availabilitySchema = z
  .object({
    timezone: z.literal(OWNER_ZONE),
    workDays: z.array(z.number().int().min(1).max(7)).max(7), // ISO weekdays: 1 = Monday … 7 = Sunday
    workStart: hhmm,
    workEnd: hhmm,
    slotMinutes: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]),
    bufferMinutes: z.number().int().min(0).max(120),
    minNoticeHours: z.number().int().min(0).max(168),
    maxDaysAhead: z.number().int().min(1).max(90),
  })
  .refine((a) => minutesOf(a.workEnd) - minutesOf(a.workStart) >= a.slotMinutes, {
    message: "the working day must fit at least one slot",
    path: ["workEnd"],
  });

export type Availability = z.infer<typeof availabilitySchema>;

/** Defaults: Mon–Sat 09:00–23:00, 30-min slots, 3 h notice, 30 days ahead, Sunday closed. */
export const DEFAULT_AVAILABILITY: Availability = {
  timezone: OWNER_ZONE,
  workDays: [1, 2, 3, 4, 5, 6],
  workStart: "09:00",
  workEnd: "23:00",
  slotMinutes: 30,
  bufferMinutes: 0,
  minNoticeHours: 3,
  maxDaysAhead: 30,
};

export type Interval = { start: Date; end: Date };
export type Slot = { start: string; end: string }; // UTC ISO

/**
 * Free slots of one owner-calendar day (YYYY-MM-DD in Asia/Tashkent).
 * A slot is offered when it fits inside working hours, starts ≥ now + minNotice, the day is ≤ today + maxDaysAhead,
 * and [start − buffer, end + buffer) overlaps no busy interval (non-cancelled bookings, blocked ranges).
 */
export function slotsForDate(date: string, a: Availability, now: Date, busy: Interval[]): { closed: boolean; slots: Slot[] } {
  const day = DateTime.fromISO(date, { zone: a.timezone }).startOf("day");
  if (!day.isValid || !a.workDays.includes(day.weekday)) return { closed: true, slots: [] };

  const nowInZone = DateTime.fromJSDate(now).setZone(a.timezone);
  if (day > nowInZone.startOf("day").plus({ days: a.maxDaysAhead })) return { closed: false, slots: [] };

  const earliest = nowInZone.plus({ hours: a.minNoticeHours });
  const dayEnd = day.plus({ minutes: minutesOf(a.workEnd) });
  const buffer = a.bufferMinutes * 60_000;
  const slots: Slot[] = [];

  for (let start = day.plus({ minutes: minutesOf(a.workStart) }); ; start = start.plus({ minutes: a.slotMinutes })) {
    const end = start.plus({ minutes: a.slotMinutes });
    if (end > dayEnd) break;
    if (start < earliest) continue;
    const from = start.toMillis() - buffer;
    const to = end.toMillis() + buffer;
    if (busy.some((b) => from < b.end.getTime() && to > b.start.getTime())) continue;
    slots.push({ start: start.toUTC().toISO()!, end: end.toUTC().toISO()! });
  }
  return { closed: false, slots };
}
