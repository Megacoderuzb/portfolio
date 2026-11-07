import { describe, expect, it } from "vitest";
import { DEFAULT_AVAILABILITY, slotsForDate, type Availability } from "@/lib/booking/slots";
import { dateIn, timeIn } from "@/lib/time";

// Tashkent is UTC+5 all year. Reference week: Sat 2026-10-24, Sun 25 (closed), Mon 26.
const SAT_MORNING = new Date("2026-10-24T03:00:00Z"); // 08:00 Tashkent
const MONDAY = "2026-10-26";
const a = (patch: Partial<Availability> = {}): Availability => ({ ...DEFAULT_AVAILABILITY, ...patch });
const tashkent = (iso: string) => timeIn(iso, "Asia/Tashkent");
const busy = (from: string, to: string) => ({ start: new Date(from), end: new Date(to) });

describe("slotsForDate", () => {
  it("closes Sunday", () => {
    expect(slotsForDate("2026-10-25", a(), SAT_MORNING, [])).toEqual({ closed: true, slots: [] });
  });

  it("offers Mon–Sat 09:00–23:00 in 30-min slots, the last ending at 23:00", () => {
    const { closed, slots } = slotsForDate(MONDAY, a(), SAT_MORNING, []);
    expect(closed).toBe(false);
    expect(slots).toHaveLength(28);
    expect(tashkent(slots[0].start)).toBe("09:00");
    expect(slots[0].start).toBe("2026-10-26T04:00:00.000Z"); // UTC instants
    expect(tashkent(slots.at(-1)!.end)).toBe("23:00");
  });

  it.each([
    [15, 56, "22:45"],
    [30, 28, "22:30"],
    [45, 18, "21:45"], // 09:00 + 18×45 min = 22:30; the next slot would end 23:15
    [60, 14, "22:00"],
  ] as const)("supports %i-minute slots (%i slots, last starts %s)", (slotMinutes, count, lastStart) => {
    const { slots } = slotsForDate(MONDAY, a({ slotMinutes }), SAT_MORNING, []);
    expect(slots).toHaveLength(count);
    expect(tashkent(slots.at(-1)!.start)).toBe(lastStart);
    for (const s of slots) expect(tashkent(s.end) <= "23:00").toBe(true);
  });

  it("respects the minimum notice boundary (now + 3 h is bookable, earlier is not)", () => {
    const now = new Date("2026-10-26T04:00:00Z"); // Monday 09:00 Tashkent
    const { slots } = slotsForDate(MONDAY, a(), now, []);
    expect(tashkent(slots[0].start)).toBe("12:00");
    const justAfter = new Date("2026-10-26T04:00:01Z");
    expect(tashkent(slotsForDate(MONDAY, a(), justAfter, []).slots[0].start)).toBe("12:30");
  });

  it("respects the horizon (today + 30 days yes, +31 no)", () => {
    expect(slotsForDate("2026-11-23", a(), SAT_MORNING, []).slots.length).toBeGreaterThan(0);
    expect(slotsForDate("2026-11-24", a(), SAT_MORNING, [])).toEqual({ closed: false, slots: [] });
  });

  it("removes slots overlapping a booking", () => {
    const { slots } = slotsForDate(MONDAY, a(), SAT_MORNING, [busy("2026-10-26T05:00:00Z", "2026-10-26T05:30:00Z")]);
    expect(slots.map((s) => tashkent(s.start))).not.toContain("10:00");
    expect(slots).toHaveLength(27);
  });

  it("applies the buffer on both sides of a booking", () => {
    const { slots } = slotsForDate(MONDAY, a({ bufferMinutes: 15 }), SAT_MORNING, [
      busy("2026-10-26T05:00:00Z", "2026-10-26T05:30:00Z"), // 10:00–10:30
    ]);
    const starts = slots.map((s) => tashkent(s.start));
    expect(starts).not.toContain("09:30");
    expect(starts).not.toContain("10:30");
    expect(starts).toContain("09:00");
    expect(starts).toContain("11:00");
  });

  it("removes slots inside a blocked range", () => {
    const { slots } = slotsForDate(MONDAY, a(), SAT_MORNING, [busy("2026-10-26T08:00:00Z", "2026-10-26T10:00:00Z")]); // 13:00–15:00
    const starts = slots.map((s) => tashkent(s.start));
    expect(starts).not.toContain("13:00");
    expect(starts).not.toContain("14:30");
    expect(starts).toContain("12:30");
    expect(starts).toContain("15:00");
    expect(slots).toHaveLength(24);
  });

  it("follows custom work days and hours", () => {
    expect(slotsForDate(MONDAY, a({ workDays: [6] }), SAT_MORNING, []).closed).toBe(true);
    const { slots } = slotsForDate(MONDAY, a({ workStart: "10:00", workEnd: "12:00", slotMinutes: 60 }), SAT_MORNING, []);
    expect(slots.map((s) => tashkent(s.start))).toEqual(["10:00", "11:00"]);
  });

  it("converts to visitor time zones, including a different calendar date", () => {
    const { slots } = slotsForDate(MONDAY, a(), SAT_MORNING, []);
    const first = slots[0].start; // Mon 09:00 Tashkent
    const last = slots.at(-1)!.start; // Mon 22:30 Tashkent
    expect([dateIn(first, "America/Los_Angeles"), timeIn(first, "America/Los_Angeles")]).toEqual(["2026-10-25", "21:00"]);
    expect([dateIn(last, "Pacific/Auckland"), timeIn(last, "Pacific/Auckland")]).toEqual(["2026-10-27", "06:30"]);
    expect([dateIn(first, "Asia/Tashkent"), timeIn(first, "Asia/Tashkent")]).toEqual([MONDAY, "09:00"]);
  });
});
