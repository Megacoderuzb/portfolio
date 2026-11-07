import { DateTime } from "luxon";
import { z } from "zod";
import { OWNER_ZONE } from "@/lib/time";

// Uzbek date/time grammar of the bot (docs/BOT.md). Pure: `now` is passed in, the zone is always Asia/Tashkent.
//
//   time      HH:mm (24h)                       15:00, 9:05
//   day       bugun | ertaga | indin | <weekday> | DD.MM | DD.MM.YYYY
//   relative  +30m | +2h | +1d
//   repeat    har kuni [time] | har <weekday> [time] | har oy <N> [time]
//
// The spec goes before the text ("ertaga 09:30 hisobot") or after it ("hisobot ertaga 09:30").
// A missing time means 09:00. A bare time that already passed today rolls over to tomorrow (rolledOver: true).

export const WEEKDAYS = ["dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba", "yakshanba"]; // Luxon 1..7
export const DEFAULT_TIME = "09:00";
const MAX_RELATIVE_MINUTES = 365 * 24 * 60;

export const recurrenceSchema = z.object({
  type: z.enum(["daily", "weekly", "monthly"]),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  weekday: z.number().int().min(1).max(7).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
});
export type Recurrence = z.infer<typeof recurrenceSchema>;

export type Parsed = {
  ok: true;
  remindAt: Date | null;
  recurrence: Recurrence | null;
  text: string;
  rolledOver: boolean;
};
export type ParseError = { ok: false; error: string };

export const EXAMPLES = "Masalan: 15:00, ertaga 09:30, juma 10:00, 25.10 18:00, +45m, har kuni 08:00";

type Time = { hour: number; minute: number };
type Day =
  | { kind: "today" | "tomorrow" | "dayAfter" }
  | { kind: "weekday"; weekday: number }
  | { kind: "date"; day: number; month: number; year?: number; raw: string };
type Spec =
  | { kind: "relative"; minutes: number }
  | { kind: "repeat"; recurrence: Recurrence }
  | { kind: "at"; day?: Day; time?: Time };

class Fail extends Error {}
const fail = (message: string): never => {
  throw new Fail(message);
};

const normalize = (token: string) => token.toLowerCase().replace(/[ʻʼ’‘`´]/g, "'");
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (t: Time) => `${pad(t.hour)}:${pad(t.minute)}`;

function readTime(token: string | undefined): Time | null {
  const m = token && /^(\d{1,2}):(\d{2})$/.exec(token);
  if (!m) return null;
  const time = { hour: Number(m[1]), minute: Number(m[2]) };
  if (time.hour > 23 || time.minute > 59)
    fail(`Vaqt noto'g'ri: ${token}. Soat 00:00–23:59 oralig'ida bo'lsin, masalan 09:30.`);
  return time;
}

function readDay(token: string | undefined): Day | null {
  if (!token) return null;
  if (token === "bugun") return { kind: "today" };
  if (token === "ertaga") return { kind: "tomorrow" };
  if (token === "indin") return { kind: "dayAfter" };
  const weekday = WEEKDAYS.indexOf(token);
  if (weekday >= 0) return { kind: "weekday", weekday: weekday + 1 };

  const m = /^(\d{1,2})\.(\d{1,2})(?:\.(\d+))?$/.exec(token);
  if (!m) return null;
  if (m[3] !== undefined && m[3].length !== 4) fail(`Yilni to'liq yozing: ${token}. Masalan: 25.10.2026.`);
  const [day, month, year] = [Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : undefined];
  // 2028 is a leap year: 29.02 without a year is a real date
  if (!DateTime.fromObject({ year: year ?? 2028, month, day }).isValid) {
    fail(`Sana noto'g'ri: ${token}. Masalan: 25.10 yoki 25.10.2026.`);
  }
  return { kind: "date", day, month, year, raw: token };
}

function readRelative(token: string | undefined): number | null {
  const m = token && /^\+(\d+)(m|h|d)$/.exec(token);
  if (!m) return null;
  const minutes = Number(m[1]) * { m: 1, h: 60, d: 24 * 60 }[m[2] as "m" | "h" | "d"];
  if (minutes < 1 || minutes > MAX_RELATIVE_MINUTES)
    fail("Nisbiy vaqt 1 daqiqadan 365 kungacha bo'lsin. Masalan: +30m, +2h, +1d.");
  return minutes;
}

/** Reads a spec starting at tokens[start]; null when the token there is not a date/time. */
function readSpec(tokens: string[], start: number): { spec: Spec; used: number } | null {
  const t = (k: number) => tokens[start + k];

  if (t(0) === "har") {
    const timeOf = (k: number) => hhmm(readTime(t(k)) ?? { hour: 9, minute: 0 });
    const used = (k: number) => (readTime(t(k)) ? k + 1 : k);
    if (t(1) === "kuni")
      return { spec: { kind: "repeat", recurrence: { type: "daily", time: timeOf(2) } }, used: used(2) };
    const weekday = WEEKDAYS.indexOf(t(1) ?? "");
    if (weekday >= 0) {
      return {
        spec: { kind: "repeat", recurrence: { type: "weekly", weekday: weekday + 1, time: timeOf(2) } },
        used: used(2),
      };
    }
    if (t(1) === "oy") {
      const dayOfMonth = Number(t(2));
      if (!/^\d{1,2}$/.test(t(2) ?? "") || dayOfMonth < 1 || dayOfMonth > 31) {
        fail("Oyning kunini 1–31 oralig'ida yozing. Masalan: har oy 1 09:00 hisobotlar");
      }
      return { spec: { kind: "repeat", recurrence: { type: "monthly", dayOfMonth, time: timeOf(3) } }, used: used(3) };
    }
    return null; // "har" is also an ordinary word ("har bir mijoz")
  }

  const minutes = readRelative(t(0));
  if (minutes) return { spec: { kind: "relative", minutes }, used: 1 };

  const day = readDay(t(0));
  if (day) {
    const time = readTime(t(1));
    return { spec: { kind: "at", day, time: time ?? undefined }, used: time ? 2 : 1 };
  }
  const time = readTime(t(0));
  if (time) {
    const after = readDay(t(1));
    return { spec: { kind: "at", time, day: after ?? undefined }, used: after ? 2 : 1 };
  }
  return null;
}

/** First occurrence strictly after `after` (Asia/Tashkent wall clock; monthly clamps to the month's last day). */
export function nextOccurrence(rec: Recurrence, after: Date): Date {
  const base = DateTime.fromJSDate(after).setZone(OWNER_ZONE);
  const [hour, minute] = rec.time.split(":").map(Number);
  const at = (d: DateTime) => d.set({ hour, minute, second: 0, millisecond: 0 });

  let next: DateTime;
  if (rec.type === "daily") {
    next = at(base);
    if (next <= base) next = next.plus({ days: 1 });
  } else if (rec.type === "weekly") {
    next = at(base.plus({ days: (rec.weekday! - base.weekday + 7) % 7 }));
    if (next <= base) next = next.plus({ weeks: 1 });
  } else {
    const inMonth = (month: DateTime) => at(month.set({ day: Math.min(rec.dayOfMonth!, month.daysInMonth!) }));
    next = inMonth(base.startOf("month"));
    if (next <= base) next = inMonth(base.startOf("month").plus({ months: 1 }));
  }
  return next.toJSDate();
}

function resolve(spec: Spec, now: Date): { at: Date; recurrence: Recurrence | null; rolledOver: boolean } {
  const base = DateTime.fromJSDate(now).setZone(OWNER_ZONE);
  if (spec.kind === "relative")
    return { at: base.plus({ minutes: spec.minutes }).toJSDate(), recurrence: null, rolledOver: false };
  if (spec.kind === "repeat")
    return { at: nextOccurrence(spec.recurrence, now), recurrence: spec.recurrence, rolledOver: false };

  const time = spec.time ?? { hour: 9, minute: 0 };
  const on = (d: DateTime) => d.set({ ...time, second: 0, millisecond: 0 });
  const done = (at: DateTime, rolledOver = false) => ({ at: at.toJSDate(), recurrence: null, rolledOver });
  const passed = (label: string): never =>
    fail(`Bu vaqt o'tib ketgan: ${label} ${hhmm(time)}. Kelajakdagi vaqtni yozing, masalan: ertaga ${hhmm(time)}.`);

  const day = spec.day;
  if (!day) {
    const today = on(base);
    return today > base ? done(today) : done(today.plus({ days: 1 }), true);
  }
  switch (day.kind) {
    case "today": {
      const at = on(base);
      return at > base ? done(at) : passed("bugun");
    }
    case "tomorrow":
      return done(on(base.plus({ days: 1 })));
    case "dayAfter":
      return done(on(base.plus({ days: 2 })));
    case "weekday": {
      const at = on(base.plus({ days: (day.weekday - base.weekday + 7) % 7 }));
      return done(at > base ? at : at.plus({ weeks: 1 }));
    }
    case "date": {
      if (day.year) {
        const at = DateTime.fromObject(
          { year: day.year, month: day.month, day: day.day, ...time },
          { zone: OWNER_ZONE },
        );
        return at > base ? done(at) : passed(day.raw);
      }
      // no year: the next time this date comes (29.02 waits for a leap year)
      for (let year = base.year; year <= base.year + 4; year++) {
        const at = DateTime.fromObject({ year, month: day.month, day: day.day, ...time }, { zone: OWNER_ZONE });
        if (at.isValid && at > base) return done(at);
      }
      return passed(day.raw);
    }
  }
}

/**
 * Parses "<spec> <text>" or "<text> <spec>".
 * - mode "remind": a date/time is required.
 * - mode "task": the date/time is optional (remindAt null) and repeats are not allowed.
 */
export function parse(input: string, now: Date, mode: "remind" | "task" = "remind"): Parsed | ParseError {
  try {
    const raw = input.trim().split(/\s+/).filter(Boolean);
    const tokens = raw.map(normalize);

    let found: { spec: Spec; text: string[] } | null = null;
    const lead = readSpec(tokens, 0);
    if (lead) found = { spec: lead.spec, text: raw.slice(lead.used) };
    for (let k = Math.min(4, tokens.length); !found && k >= 1; k--) {
      const tail = readSpec(tokens, tokens.length - k);
      if (tail?.used === k) found = { spec: tail.spec, text: raw.slice(0, -k) };
    }

    const text = (found?.text ?? raw).join(" ");
    if (mode === "task") {
      if (!text) fail("Vazifa matnini yozing. Masalan: /task Resume'ni yangilash ertaga");
      if (!found) return { ok: true, remindAt: null, recurrence: null, text, rolledOver: false };
      if (found.spec.kind === "repeat")
        fail("Vazifa takrorlanmaydi. Takroriy eslatma uchun: /remind har kuni 08:00 dori ichish");
    } else {
      if (!found) fail(`Vaqtni tushunmadim. ${EXAMPLES}`);
      if (!text) fail("Eslatma matnini yozing. Masalan: /remind ertaga 09:30 hisobot yuborish");
    }
    const { at, recurrence, rolledOver } = resolve(found!.spec, now);
    return { ok: true, remindAt: at, recurrence, text, rolledOver };
  } catch (e) {
    if (e instanceof Fail) return { ok: false, error: e.message };
    throw e;
  }
}

/** Only a date/time, nothing else (the typed answer to "Boshqa vaqt"; the text comes from the quick-add draft). */
export function parseWhen(input: string, now: Date): Parsed | ParseError {
  const result = parse(`${input} .`, now, "remind");
  if (result.ok && result.text !== ".") return { ok: false, error: `Faqat vaqtni yozing. ${EXAMPLES}` };
  return result;
}
