import { randomBytes } from "node:crypto";
import { DateTime } from "luxon";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { localize, type LocalizedContent, type ServiceText } from "@/lib/content";
import { isValidZone } from "@/lib/time";
import { availabilitySchema, DEFAULT_AVAILABILITY, slotsForDate, type Availability, type Interval } from "./slots";

// Server side of booking (docs/SPEC.md §5, §9). The client is never trusted for slot validity: every booking
// re-runs the slot rules, and the booking_no_overlap exclusion constraint is the final guard.

export async function getAvailability(): Promise<Availability> {
  const row = await db.setting.findUnique({ where: { key: "availability" } });
  const parsed = availabilitySchema.safeParse(row?.value);
  return parsed.success ? parsed.data : DEFAULT_AVAILABILITY;
}

/** Non-cancelled bookings and blocked ranges overlapping [from, to). */
async function busyBetween(from: Date, to: Date): Promise<Interval[]> {
  const overlapping = { startsAt: { lt: to }, endsAt: { gt: from } };
  const [bookings, blocked] = await Promise.all([
    db.booking.findMany({
      where: { ...overlapping, status: { not: "CANCELLED" } },
      select: { startsAt: true, endsAt: true },
    }),
    db.blockedSlot.findMany({ where: overlapping, select: { startsAt: true, endsAt: true } }),
  ]);
  return [...bookings, ...blocked].map((b) => ({ start: b.startsAt, end: b.endsAt }));
}

/** Free slots for owner-calendar dates from…to (YYYY-MM-DD, inclusive). */
export async function availableDays(from: string, to: string, now = new Date()) {
  const a = await getAvailability();
  const first = DateTime.fromISO(from, { zone: a.timezone });
  const last = DateTime.fromISO(to, { zone: a.timezone }).plus({ days: 1 });
  const busy = await busyBetween(
    first.minus({ minutes: a.bufferMinutes }).toJSDate(),
    last.plus({ minutes: a.bufferMinutes }).toJSDate(),
  );
  const days = [];
  for (let d = first; d < last; d = d.plus({ days: 1 })) {
    const date = d.toISODate()!;
    days.push({ date, ...slotsForDate(date, a, now, busy) });
  }
  return days;
}

// ---------------------------------------------------------------- create

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

export const PURPOSES = ["JOB_OFFER", "FREELANCE", "NETWORKING", "OTHER"] as const;

export const bookingInput = z.object({
  name: z.string().trim().min(1).max(100),
  email: z
    .email()
    .max(254)
    .transform((e) => e.toLowerCase()),
  telegram: optionalText(64),
  phone: z
    .string()
    .trim()
    .max(32)
    .regex(/^$|^[+\d\s()-]{5,32}$/)
    .optional()
    .transform((v) => v || null),
  company: optionalText(120),
  note: optionalText(1000),
  purpose: z.enum(PURPOSES),
  service: z
    .string()
    .regex(/^[a-z0-9-]{1,64}$/)
    .optional(),
  startsAt: z.iso.datetime({ offset: true }),
  timezone: z.string().max(64).refine(isValidZone, "unknown time zone"),
  locale: z.enum(["uz", "ru", "en"]),
});
export type BookingInput = z.output<typeof bookingInput>;

/** SQLSTATE 23P01 from booking_no_overlap, as surfaced by Prisma + @prisma/adapter-pg. */
export function isOverlapViolation(e: unknown) {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const cause = (e.meta?.driverAdapterError as { cause?: { originalCode?: string } } | undefined)?.cause;
  return cause?.originalCode === "23P01";
}

export type BookingResult =
  { ok: true; booking: { id: string; token: string } } | { ok: false; error: "slot_taken" | "too_many_bookings" };

/** Max 2 future active bookings per email. */
const MAX_ACTIVE_PER_EMAIL = 2;

export async function createBooking(input: BookingInput, ipHash: string, now = new Date()): Promise<BookingResult> {
  const a = await getAvailability();
  const start = DateTime.fromISO(input.startsAt).toUTC();
  const end = start.plus({ minutes: a.slotMinutes });

  // re-run the slot rules (hours, notice, horizon, overlaps incl. buffer) for the requested start
  const busy = await busyBetween(
    start.minus({ minutes: a.bufferMinutes }).toJSDate(),
    end.plus({ minutes: a.bufferMinutes }).toJSDate(),
  );
  const { slots } = slotsForDate(start.setZone(a.timezone).toISODate()!, a, now, busy);
  if (!slots.some((s) => DateTime.fromISO(s.start).toMillis() === start.toMillis())) {
    return { ok: false, error: "slot_taken" };
  }

  const service = input.service
    ? await db.service.findFirst({ where: { slug: input.service, visible: true }, select: { id: true } })
    : null;

  // Soft limit (two simultaneous requests from one email could both pass); the slot itself is guarded by the
  // atomic INSERT + exclusion constraint. No interactive transaction: under bursts those time out waiting to start.
  const active = await db.booking.count({
    where: { email: input.email, status: { in: ["PENDING_MEET", "CONFIRMED"] }, startsAt: { gt: now } },
  });
  if (active >= MAX_ACTIVE_PER_EMAIL) return { ok: false, error: "too_many_bookings" };

  try {
    const booking = await db.booking.create({
      data: {
        token: randomBytes(32).toString("base64url"),
        name: input.name,
        email: input.email,
        telegram: input.telegram,
        phone: input.phone,
        company: input.company,
        note: input.note,
        purpose: input.purpose,
        serviceId: service?.id,
        locale: input.locale,
        visitorTimezone: input.timezone,
        startsAt: start.toJSDate(),
        endsAt: end.toJSDate(),
        ipHash,
      },
      select: { id: true, token: true },
    });
    return { ok: true, booking };
  } catch (e) {
    if (isOverlapViolation(e)) return { ok: false, error: "slot_taken" };
    throw e;
  }
}

// ---------------------------------------------------------------- visitor's own booking (by secret token)

/** 32 random bytes, base64url. */
export const isBookingToken = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);

export async function getPublicBooking(token: string, locale: "uz" | "ru" | "en") {
  if (!isBookingToken(token)) return null;
  const b = await db.booking.findUnique({
    where: { token },
    select: {
      name: true,
      status: true,
      startsAt: true,
      endsAt: true,
      meetUrl: true,
      purpose: true,
      service: { select: { slug: true, content: true } },
    },
  });
  if (!b) return null;
  return {
    name: b.name,
    status: b.status,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    meetUrl: b.meetUrl,
    purpose: b.purpose,
    service: b.service && {
      slug: b.service.slug,
      title: localize(b.service.content as LocalizedContent<ServiceText>, locale).title,
    },
  };
}
export type PublicBooking = NonNullable<Awaited<ReturnType<typeof getPublicBooking>>>;

/** Idempotent: cancelling twice is fine. Returns null for an unknown token. */
export async function cancelBookingByToken(token: string) {
  if (!isBookingToken(token)) return null;
  const booking = await db.booking.findUnique({ where: { token }, select: { id: true } });
  if (!booking) return null;
  const { count } = await db.booking.updateMany({
    where: { id: booking.id, status: { in: ["PENDING_MEET", "CONFIRMED"] } },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  const { status } = await db.booking.findUniqueOrThrow({ where: { id: booking.id }, select: { status: true } });
  return { id: booking.id, changed: count === 1, status };
}
