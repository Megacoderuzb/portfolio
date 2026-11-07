import { DateTime } from "luxon";

// Owner time: Asia/Tashkent (UTC+5, no DST). Instants are stored and exchanged as UTC; always pass the zone
// explicitly — containers set TZ=Asia/Tashkent but dev machines may not.
export const OWNER_ZONE = "Asia/Tashkent";

/** "HH:mm" → minutes since midnight. */
export function minutesOf(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const at = (iso: string, zone: string) => DateTime.fromISO(iso, { zone: "utc" }).setZone(zone);

/** Calendar date (YYYY-MM-DD) of a UTC instant in a zone. */
export const dateIn = (iso: string, zone: string) => at(iso, zone).toISODate()!;

/** Wall-clock time (HH:mm) of a UTC instant in a zone. */
export const timeIn = (iso: string, zone: string) => at(iso, zone).toFormat("HH:mm");

/** Today's date (YYYY-MM-DD) in a zone. */
export const todayIn = (zone: string, now = new Date()) => DateTime.fromJSDate(now).setZone(zone).toISODate()!;

/** `date` + `days` (YYYY-MM-DD arithmetic). */
export const addDays = (date: string, days: number) => DateTime.fromISO(date).plus({ days }).toISODate()!;

/** Number of days from `from` to `to` (YYYY-MM-DD), inclusive of both. */
export const daySpan = (from: string, to: string) =>
  Math.round(DateTime.fromISO(to).diff(DateTime.fromISO(from), "days").days) + 1;

export const isValidZone = (zone: string) => DateTime.local().setZone(zone).isValid;

/** Wall-clock "YYYY-MM-DDTHH:mm" in the owner zone → UTC Date (admin inputs). */
export const fromOwnerLocal = (local: string) => DateTime.fromISO(local, { zone: OWNER_ZONE }).toUTC().toJSDate();

/** UTC Date → "YYYY-MM-DDTHH:mm" in the owner zone (for <input type="datetime-local">). */
export const toOwnerLocal = (d: Date) => DateTime.fromJSDate(d).setZone(OWNER_ZONE).toFormat("yyyy-MM-dd'T'HH:mm");
