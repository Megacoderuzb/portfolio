import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { nextOccurrence, parse, parseWhen, type Recurrence } from "../worker/bot/parse";

// now = Wednesday 21.10.2026 12:00 in Tashkent (07:00 UTC)
const NOW = new Date("2026-10-21T07:00:00Z");
const local = (d: Date | null) =>
  d ? DateTime.fromJSDate(d).setZone("Asia/Tashkent").toFormat("yyyy-MM-dd HH:mm") : null;

type Ok = { at: string | null; text: string; rec?: Recurrence; rolled?: boolean };
type Case = [input: string, expected: Ok | RegExp, mode?: "remind" | "task"];

const cases: Case[] = [
  // bare time: later today, or rolled over to tomorrow
  ["15:00 Ali bilan qo'ng'iroq", { at: "2026-10-21 15:00", text: "Ali bilan qo'ng'iroq" }],
  ["09:00 hisobot", { at: "2026-10-22 09:00", text: "hisobot", rolled: true }],
  ["12:00 aynan hozir", { at: "2026-10-22 12:00", text: "aynan hozir", rolled: true }],
  ["12:01 bir daqiqadan keyin", { at: "2026-10-21 12:01", text: "bir daqiqadan keyin" }],
  ["9:05 bir xonali soat", { at: "2026-10-22 09:05", text: "bir xonali soat", rolled: true }],
  ["0:00 yarim tun", { at: "2026-10-22 00:00", text: "yarim tun", rolled: true }],
  ["23:59 kun oxiri", { at: "2026-10-21 23:59", text: "kun oxiri" }],
  // day words
  ["bugun 18:00 sport", { at: "2026-10-21 18:00", text: "sport" }],
  ["bugun 10:00 kech qoldi", /o'tib ketgan/],
  ["bugun hech narsa", /o'tib ketgan/], // bugun without a time = 09:00, already passed
  ["ertaga 09:30 hisobot yuborish", { at: "2026-10-22 09:30", text: "hisobot yuborish" }],
  ["ertaga hisobot", { at: "2026-10-22 09:00", text: "hisobot" }],
  ["indin 18:00 kino", { at: "2026-10-23 18:00", text: "kino" }],
  ["15:00 ertaga avval vaqt", { at: "2026-10-22 15:00", text: "avval vaqt" }],
  // weekdays: next occurrence (today only if the time is still ahead)
  ["juma 10:00 jamoa yig'ilishi", { at: "2026-10-23 10:00", text: "jamoa yig'ilishi" }],
  ["chorshanba 15:00 bugungi kun", { at: "2026-10-21 15:00", text: "bugungi kun" }],
  ["chorshanba 09:00 keyingi hafta", { at: "2026-10-28 09:00", text: "keyingi hafta" }],
  ["dushanba 10:00 reja", { at: "2026-10-26 10:00", text: "reja" }],
  ["yakshanba 20:00 dam", { at: "2026-10-25 20:00", text: "dam" }],
  ["seshanba vaqtsiz", { at: "2026-10-27 09:00", text: "vaqtsiz" }],
  // dates
  ["25.10 18:00 Dormix demo", { at: "2026-10-25 18:00", text: "Dormix demo" }],
  ["21.10 13:00 bugun sana bilan", { at: "2026-10-21 13:00", text: "bugun sana bilan" }],
  ["20.10 18:00 o'tgan sana", { at: "2027-10-20 18:00", text: "o'tgan sana" }], // no year → next year
  ["1.1 10:00 yangi yil", { at: "2027-01-01 10:00", text: "yangi yil" }],
  ["29.02 10:00 kabisa", { at: "2028-02-29 10:00", text: "kabisa" }],
  ["25.10.2027 10:00 aniq yil", { at: "2027-10-25 10:00", text: "aniq yil" }],
  ["01.01.2020 10:00 eski", /o'tib ketgan/],
  ["31.02 10:00 yo'q kun", /Sana noto'g'ri/],
  ["29.02.2027 10:00 kabisa emas", /Sana noto'g'ri/],
  ["32.10 10:00 x", /Sana noto'g'ri/],
  ["25.13 10:00 x", /Sana noto'g'ri/],
  ["25.10.26 10:00 qisqa yil", /Yilni to'liq/],
  // relative
  ["+45m choyni o'chir", { at: "2026-10-21 12:45", text: "choyni o'chir" }],
  ["+2h qo'ng'iroq", { at: "2026-10-21 14:00", text: "qo'ng'iroq" }],
  ["+1d ertaga shu vaqt", { at: "2026-10-22 12:00", text: "ertaga shu vaqt" }],
  ["+720m kechasi", { at: "2026-10-22 00:00", text: "kechasi" }],
  ["+0m x", /Nisbiy vaqt/],
  ["+400d x", /Nisbiy vaqt/],
  // recurrence
  [
    "har kuni 08:00 dori ichish",
    { at: "2026-10-22 08:00", text: "dori ichish", rec: { type: "daily", time: "08:00" } },
  ],
  ["har kuni 13:00 tushlik", { at: "2026-10-21 13:00", text: "tushlik", rec: { type: "daily", time: "13:00" } }],
  ["har kuni vitamin", { at: "2026-10-22 09:00", text: "vitamin", rec: { type: "daily", time: "09:00" } }],
  [
    "har dushanba 10:00 haftalik reja",
    { at: "2026-10-26 10:00", text: "haftalik reja", rec: { type: "weekly", weekday: 1, time: "10:00" } },
  ],
  [
    "har juma ish yakuni",
    { at: "2026-10-23 09:00", text: "ish yakuni", rec: { type: "weekly", weekday: 5, time: "09:00" } },
  ],
  [
    "har oy 1 09:00 hisobotlar",
    { at: "2026-11-01 09:00", text: "hisobotlar", rec: { type: "monthly", dayOfMonth: 1, time: "09:00" } },
  ],
  [
    "har oy 31 09:00 oy oxiri",
    { at: "2026-10-31 09:00", text: "oy oxiri", rec: { type: "monthly", dayOfMonth: 31, time: "09:00" } },
  ],
  [
    "har oy 21 11:00 o'tib ketdi",
    { at: "2026-11-21 11:00", text: "o'tib ketdi", rec: { type: "monthly", dayOfMonth: 21, time: "11:00" } },
  ],
  ["har oy 32 09:00 x", /Oyning kunini/],
  ["har oy 09:00 x", /Oyning kunini/],
  // text first, spec at the end
  ["hisobot yuborish ertaga 09:30", { at: "2026-10-22 09:30", text: "hisobot yuborish" }],
  [
    "dori ichish har kuni 08:00",
    { at: "2026-10-22 08:00", text: "dori ichish", rec: { type: "daily", time: "08:00" } },
  ],
  ["choy +30m", { at: "2026-10-21 12:30", text: "choy" }],
  // case, apostrophes
  ["ERTAGA 09:30 Katta Harf", { at: "2026-10-22 09:30", text: "Katta Harf" }],
  ["Juma 10:00 bosh harf", { at: "2026-10-23 10:00", text: "bosh harf" }],
  ["15:00 Ali bilan qoʻngʻiroq", { at: "2026-10-21 15:00", text: "Ali bilan qoʻngʻiroq" }],
  ["15:00 Ali bilan qo’ng’iroq", { at: "2026-10-21 15:00", text: "Ali bilan qo’ng’iroq" }],
  // malformed
  ["25:00 x", /Vaqt noto'g'ri/],
  ["12:60 x", /Vaqt noto'g'ri/],
  ["1.2.3 x", /Yilni to'liq/],
  ["ertaga 09:30", /matnini yozing/],
  ["", /Vaqtni tushunmadim/],
  ["salom dunyo", /Vaqtni tushunmadim/],
  ["Ali bilan 15:00 qo'ng'iroq", /Vaqtni tushunmadim/], // a time in the middle is text, not a spec
  // /task: date optional, no repeats
  ["Resume'ni yangilash ertaga", { at: "2026-10-22 09:00", text: "Resume'ni yangilash" }, "task"],
  ["Resume'ni yangilash", { at: null, text: "Resume'ni yangilash" }, "task"],
  ["har bir mijozga xat", { at: null, text: "har bir mijozga xat" }, "task"],
  ["juma 15:00 portfolio deploy", { at: "2026-10-23 15:00", text: "portfolio deploy" }, "task"],
  ["har kuni 08:00 sport", /takrorlanmaydi/, "task"],
  ["ertaga", /Vazifa matnini/, "task"],
];

describe("parse (now = Wed 21.10.2026 12:00 Tashkent)", () => {
  it.each(cases)("%j", (input, expected, mode = "remind") => {
    const result = parse(input, NOW, mode);
    if (expected instanceof RegExp) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(expected);
      return;
    }
    expect(result).toMatchObject({ ok: true, text: expected.text, rolledOver: expected.rolled ?? false });
    if (!result.ok) return;
    expect(local(result.remindAt)).toBe(expected.at);
    expect(result.recurrence).toEqual(expected.rec ?? null);
  });

  it("errors are Uzbek and carry an example", () => {
    for (const input of ["salom", "25:00 x", "31.02 10:00 x", "har oy 0 x"]) {
      const result = parse(input, NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/Masalan|masalan/);
    }
  });

  it("is DST-free: Tashkent is always UTC+5, whatever the date", () => {
    const winter = parse("ertaga 09:30 x", new Date("2026-01-10T07:00:00Z"));
    const summer = parse("ertaga 09:30 x", new Date("2026-07-10T07:00:00Z"));
    const europeDst = parse("ertaga 09:30 x", new Date("2026-03-28T07:00:00Z")); // Europe switches on 29.03
    expect(winter.ok && winter.remindAt!.toISOString()).toBe("2026-01-11T04:30:00.000Z");
    expect(summer.ok && summer.remindAt!.toISOString()).toBe("2026-07-11T04:30:00.000Z");
    expect(europeDst.ok && europeDst.remindAt!.toISOString()).toBe("2026-03-29T04:30:00.000Z");
  });

  it("works across the UTC date line (Tashkent is already tomorrow)", () => {
    const lateUtc = new Date("2026-10-21T20:00:00Z"); // 22.10 01:00 in Tashkent
    const result = parse("bugun 10:00 x", lateUtc);
    expect(result.ok && local(result.remindAt)).toBe("2026-10-22 10:00");
  });

  it("parseWhen accepts only a date/time", () => {
    expect(parseWhen("ertaga 15:00", NOW)).toMatchObject({ ok: true, text: "." });
    expect(local((parseWhen("+2h", NOW) as { remindAt: Date }).remindAt)).toBe("2026-10-21 14:00");
    expect(parseWhen("ertaga soat 15:00", NOW)).toMatchObject({ ok: false });
    expect(parseWhen("qachondir", NOW)).toMatchObject({ ok: false });
  });
});

describe("nextOccurrence", () => {
  const at = (iso: string) => DateTime.fromISO(iso, { zone: "Asia/Tashkent" }).toJSDate();
  const table: [Recurrence, after: string, expected: string][] = [
    [{ type: "daily", time: "08:00" }, "2026-10-21T07:59", "2026-10-21 08:00"],
    [{ type: "daily", time: "08:00" }, "2026-10-21T08:00", "2026-10-22 08:00"], // strictly after
    [{ type: "daily", time: "00:00" }, "2026-12-31T23:30", "2027-01-01 00:00"],
    [{ type: "weekly", weekday: 1, time: "10:00" }, "2026-10-26T10:00", "2026-11-02 10:00"],
    [{ type: "weekly", weekday: 7, time: "20:00" }, "2026-10-21T12:00", "2026-10-25 20:00"],
    [{ type: "weekly", weekday: 3, time: "15:00" }, "2026-10-21T12:00", "2026-10-21 15:00"],
    [{ type: "monthly", dayOfMonth: 31, time: "09:00" }, "2027-01-31T09:00", "2027-02-28 09:00"], // clamp
    [{ type: "monthly", dayOfMonth: 31, time: "09:00" }, "2028-02-01T00:00", "2028-02-29 09:00"], // leap
    [{ type: "monthly", dayOfMonth: 31, time: "09:00" }, "2027-02-28T09:00", "2027-03-31 09:00"], // back to 31
    [{ type: "monthly", dayOfMonth: 30, time: "09:00" }, "2027-02-15T12:00", "2027-02-28 09:00"],
    [{ type: "monthly", dayOfMonth: 1, time: "09:00" }, "2026-12-01T09:30", "2027-01-01 09:00"], // year rollover
  ];
  it.each(table)("%j after %s → %s", (rec, after, expected) => {
    expect(local(nextOccurrence(rec, at(after)))).toBe(expected);
  });

  it("a daily reminder repeats at the same UTC instant (no DST)", () => {
    const rec: Recurrence = { type: "daily", time: "08:00" };
    let t = new Date("2026-03-27T00:00:00Z");
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      t = nextOccurrence(rec, t);
      seen.push(t.toISOString().slice(11));
    }
    expect(new Set(seen)).toEqual(new Set(["03:00:00.000Z"]));
  });
});
