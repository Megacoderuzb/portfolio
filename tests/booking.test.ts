import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { availableDays, bookingInput, cancelBookingByToken, createBooking, type BookingInput } from "@/lib/booking";
import { db } from "@/lib/db";
import { addDays, todayIn } from "@/lib/time";

// Integration tests against the dev database (seeded default availability: Mon–Sat 09:00–23:00, 30 min).
const run = randomBytes(4).toString("hex");
const email = (n: number | string) => `test-${run}-${n}@example.test`;
const input = (startsAt: string, n: number | string): BookingInput =>
  bookingInput.parse({ name: "Test", email: email(n), purpose: "OTHER", startsAt, timezone: "Europe/London", locale: "en" });

/** Free slots ~1–2 weeks ahead (on a working day), latest first so other data rarely collides. */
async function freeSlots() {
  const from = addDays(todayIn("Asia/Tashkent"), 8);
  const days = await availableDays(from, addDays(from, 2));
  return days.flatMap((d) => d.slots).reverse();
}

afterAll(async () => {
  await db.booking.deleteMany({ where: { email: { startsWith: `test-${run}-` } } });
});

describe("booking (dev database)", () => {
  it("lets exactly one of many parallel requests take the same slot", async () => {
    const [slot] = await freeSlots();
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => createBooking(input(slot.start, `p${i}`), "test")));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.error === "slot_taken")).toBe(true);
  });

  it("frees the slot on cancellation (idempotent) so it can be booked again", async () => {
    const [, slot] = await freeSlots();
    const first = await createBooking(input(slot.start, "c1"), "test");
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    expect((await freeSlots()).map((s) => s.start)).not.toContain(slot.start);
    expect(await cancelBookingByToken(first.booking.token)).toMatchObject({ changed: true, status: "CANCELLED" });
    expect(await cancelBookingByToken(first.booking.token)).toMatchObject({ changed: false, status: "CANCELLED" });
    expect((await freeSlots()).map((s) => s.start)).toContain(slot.start);
    expect((await createBooking(input(slot.start, "c2"), "test")).ok).toBe(true);
  });

  it("rejects slots that are not offered (outside hours, wrong grid)", async () => {
    const [slot] = await freeSlots();
    const offGrid = new Date(new Date(slot.start).getTime() + 7 * 60_000).toISOString();
    expect(await createBooking(input(offGrid, "g"), "test")).toEqual({ ok: false, error: "slot_taken" });
  });

  it("allows at most 2 upcoming bookings per email", async () => {
    const slots = await freeSlots();
    const same = "limit";
    expect((await createBooking(input(slots[4].start, same), "test")).ok).toBe(true);
    expect((await createBooking(input(slots[6].start, same), "test")).ok).toBe(true);
    expect(await createBooking(input(slots[8].start, same), "test")).toEqual({ ok: false, error: "too_many_bookings" });
  });
});

describe("bookingInput", () => {
  const base = { name: "Ali", email: "Ali@Example.com", purpose: "JOB_OFFER", startsAt: "2026-11-02T05:00:00.000Z", timezone: "Asia/Tashkent", locale: "uz" };

  it("normalises email and empty optionals", () => {
    const parsed = bookingInput.parse({ ...base, telegram: "", phone: "" });
    expect(parsed.email).toBe("ali@example.com");
    expect(parsed.telegram).toBeNull();
    expect(parsed.phone).toBeNull();
  });

  it("rejects bad input", () => {
    for (const bad of [
      { ...base, email: "nope" },
      { ...base, name: "" },
      { ...base, purpose: "SPAM" },
      { ...base, timezone: "Mars/Olympus" },
      { ...base, startsAt: "tomorrow" },
      { ...base, note: "x".repeat(1001) },
      { ...base, service: "../etc" },
    ]) {
      expect(bookingInput.safeParse(bad).success).toBe(false);
    }
  });
});
