import { z } from "zod";
import type { BookingStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { fromOwnerLocal, OWNER_ZONE } from "@/lib/time";
import { PURPOSES } from "./index";
import { availabilitySchema } from "./slots";

// Owner-side booking data access (admin pages and Server Actions). Inputs validated with zod.

export const STATUSES = ["PENDING_MEET", "CONFIRMED", "CANCELLED", "DONE", "NO_SHOW"] as const;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Filters from the bookings page query string; anything invalid is ignored. */
export const bookingFilters = z.object({
  status: z.enum(STATUSES).optional().catch(undefined),
  purpose: z.enum(PURPOSES).optional().catch(undefined),
  service: z.string().regex(/^[a-z0-9-]{1,64}$/).optional().catch(undefined),
  from: date.optional().catch(undefined),
  to: date.optional().catch(undefined),
});
export type BookingFilters = z.output<typeof bookingFilters>;

export function listBookings(f: BookingFilters) {
  return db.booking.findMany({
    where: {
      status: f.status,
      purpose: f.purpose,
      service: f.service ? { slug: f.service } : undefined,
      startsAt: {
        gte: f.from ? fromOwnerLocal(`${f.from}T00:00`) : undefined,
        lt: f.to ? fromOwnerLocal(`${f.to}T24:00`) : undefined,
      },
    },
    orderBy: { startsAt: "desc" },
    take: 200,
    include: { service: { select: { slug: true, content: true } } },
  });
}

export async function setBookingStatus(id: string, status: BookingStatus) {
  return db.booking.update({
    where: { id },
    data: { status, cancelledAt: status === "CANCELLED" ? new Date() : undefined },
    select: { id: true, status: true },
  });
}

export const saveOwnerNotes = (id: string, ownerNotes: string) =>
  db.booking.update({ where: { id }, data: { ownerNotes: ownerNotes || null } });

// ---------------------------------------------------------------- availability

const num = (v: FormDataEntryValue | null) => Number(typeof v === "string" ? v : NaN);

export function availabilityFromForm(fd: FormData) {
  return {
    timezone: OWNER_ZONE,
    workDays: fd.getAll("workDays").map(Number).sort(),
    workStart: fd.get("workStart"),
    workEnd: fd.get("workEnd"),
    slotMinutes: num(fd.get("slotMinutes")),
    bufferMinutes: num(fd.get("bufferMinutes")),
    minNoticeHours: num(fd.get("minNoticeHours")),
    maxDaysAhead: num(fd.get("maxDaysAhead")),
  };
}

export const saveAvailability = (value: z.output<typeof availabilitySchema>) =>
  db.setting.upsert({ where: { key: "availability" }, create: { key: "availability", value }, update: { value } });

// ---------------------------------------------------------------- blocked slots (owner-local wall clock input)

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "pick a date and time");

export const blockedInput = z
  .object({ from: localDateTime, to: localDateTime, reason: z.string().trim().max(200) })
  .transform((b) => ({ startsAt: fromOwnerLocal(b.from), endsAt: fromOwnerLocal(b.to), reason: b.reason || null }))
  .refine((b) => b.endsAt > b.startsAt, { message: "the end must be after the start", path: ["to"] });

export const listBlocked = () =>
  db.blockedSlot.findMany({ where: { endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" } });
export const createBlocked = (b: z.output<typeof blockedInput>) => db.blockedSlot.create({ data: b });
export const deleteBlocked = (id: string) => db.blockedSlot.delete({ where: { id } });

/** Bookings per service slug over the last `days` (dashboard "service interest", together with clicks). */
export async function bookingsByService(days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.booking.groupBy({ by: ["serviceId"], where: { createdAt: { gte: since } }, _count: { _all: true } });
  const services = await db.service.findMany({ select: { id: true, slug: true } });
  const slugOf = new Map(services.map((s) => [s.id, s.slug]));
  return new Map(rows.flatMap((r) => (r.serviceId && slugOf.has(r.serviceId) ? [[slugOf.get(r.serviceId)!, r._count._all] as const] : [])));
}
