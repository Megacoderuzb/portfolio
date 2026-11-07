import { InlineKeyboard } from "grammy";
import { DateTime } from "luxon";
import { OWNER_ZONE } from "@/lib/time";
import { parseRecurrence, shortId, type Agenda, type BotSettings } from "../lib/reminders";
import { WEEKDAYS, type Recurrence } from "./parse";

// Every text the bot sends (Uzbek, Latin, plain text: no parse_mode, so nothing needs escaping) and its keyboards.

const local = (d: Date) => DateTime.fromJSDate(d).setZone(OWNER_ZONE);
export const hm = (d: Date) => local(d).toFormat("HH:mm");

/** "bugun 15:00", "ertaga 09:30", "25.10 (yakshanba) 18:00"; the year only when it differs. */
export function when(d: Date, now: Date) {
  const day = local(d).startOf("day");
  const days = Math.round(day.diff(local(now).startOf("day"), "days").days);
  if (days === 0) return `bugun ${hm(d)}`;
  if (days === 1) return `ertaga ${hm(d)}`;
  if (days === -1) return `kecha ${hm(d)}`;
  const date = day.year === local(now).year ? day.toFormat("dd.MM") : day.toFormat("dd.MM.yyyy");
  return `${date} (${WEEKDAYS[day.weekday - 1]}) ${hm(d)}`;
}

export function repeatLabel(r: Recurrence) {
  if (r.type === "daily") return `har kuni ${r.time}`;
  if (r.type === "weekly") return `har ${WEEKDAYS[r.weekday! - 1]} ${r.time}`;
  return `har oyning ${r.dayOfMonth}-kuni ${r.time}`;
}

export const PURPOSE: Record<string, string> = {
  JOB_OFFER: "Ish taklifi",
  FREELANCE: "Bir martalik loyiha",
  NETWORKING: "Networking",
  OTHER: "Boshqa",
};

type ServiceRef = { slug: string; content: unknown } | null;
export function serviceTitle(service: ServiceRef) {
  if (!service) return null;
  const c = service.content as { uz?: { title?: string }; en?: { title?: string } } | null;
  return c?.uz?.title || c?.en?.title || service.slug;
}

type BookingView = {
  name: string;
  company: string | null;
  email: string;
  telegram: string | null;
  phone: string | null;
  note: string | null;
  purpose: string;
  startsAt: Date;
  meetUrl: string | null;
  service: ServiceRef;
};

const who = (b: BookingView) => (b.company ? `${b.name} (${b.company})` : b.name);
const topic = (b: BookingView) =>
  [PURPOSE[b.purpose] ?? b.purpose, serviceTitle(b.service)].filter(Boolean).join(" · ");

export const HELP = `👋 Shaxsiy yordamchi. Barcha vaqtlar Toshkent vaqtida.

/today, /tomorrow, /week: uchrashuvlar, vazifalar, eslatmalar
/task <matn> [sana] [vaqt]: vazifa qo'shish
/tasks: ochiq vazifalar
/remind <vaqt> <matn>: eslatma qo'shish
/reminders: kelgusi eslatmalar
/done <kod>, /del <kod>: bajarildi / o'chirish (kod: #abc12)
/bookings: kelgusi konsultatsiyalar
/stats: oxirgi 7 kun
/settings: xulosalar va brif

Vaqt misollari:
/remind 15:00 Ali bilan qo'ng'iroq
/remind ertaga 09:30 hisobot yuborish
/remind 25.10 18:00 Dormix demo
/remind juma 10:00 jamoa yig'ilishi
/remind +45m choyni o'chir
/remind har kuni 08:00 dori ichish
/remind har dushanba 10:00 haftalik reja
/remind har oy 1 09:00 hisobotlar
/task Resume'ni yangilash ertaga

Buyruqsiz matn yozsangiz, uni vazifa yoki eslatma qilishni taklif qilaman.`;

export const COMMANDS = [
  { command: "today", description: "Bugungi reja" },
  { command: "tomorrow", description: "Ertangi reja" },
  { command: "week", description: "7 kunlik reja" },
  { command: "task", description: "Vazifa qo'shish" },
  { command: "tasks", description: "Ochiq vazifalar" },
  { command: "remind", description: "Eslatma qo'shish" },
  { command: "reminders", description: "Kelgusi eslatmalar" },
  { command: "bookings", description: "Konsultatsiyalar" },
  { command: "stats", description: "Oxirgi 7 kun" },
  { command: "settings", description: "Sozlamalar" },
  { command: "help", description: "Yordam" },
];

const ROLLED = "\nℹ️ Bugun bu vaqt o'tib ketgan, ertaga qo'ydim.";

export const taskAdded = (t: { id: string; title: string; dueAt: Date | null }, now: Date, rolledOver = false) =>
  `📝 Vazifa qo'shildi #${shortId(t.id)}\n${t.title}` +
  (t.dueAt ? `\n⏰ ${when(t.dueAt, now)} (Toshkent) eslataman` : "") +
  (rolledOver ? ROLLED : "");

export const reminderAdded = (
  r: { id: string; text: string; remindAt: Date },
  recurrence: Recurrence | null,
  now: Date,
  rolledOver = false,
) =>
  `⏰ Eslatma qo'shildi #${shortId(r.id)}\n${r.text}\n🕒 ` +
  (recurrence ? `${repeatLabel(recurrence)}, birinchisi: ` : "") +
  `${when(r.remindAt, now)} (Toshkent)` +
  (rolledOver ? ROLLED : "");

/** The delivered reminder (and its one gentle repeat). */
export const reminderMessage = (text: string, recurrence: Recurrence | null, repeat = false) =>
  `${repeat ? "🔁 " : ""}⏰ ${text}` + (recurrence ? `\n(${repeatLabel(recurrence)})` : "");

export const deliveryKeyboard = (id: string) =>
  new InlineKeyboard()
    .text("✅ Bajarildi", `rd:${id}`)
    .row()
    .text("⏰ +15 daq", `rs:${id}:15m`)
    .text("⏰ +1 soat", `rs:${id}:1h`)
    .text("⏰ Ertaga 09:00", `rs:${id}:tomorrow`);

/** ✅ / 🗑 under a single new task or reminder. */
export const itemKeyboard = (kind: "t" | "r", id: string) =>
  new InlineKeyboard().text("✅ Bajarildi", `${kind}d:${id}`).text("🗑 O'chirish", `${kind}x:${id}`);

export function tasksView(tasks: { id: string; title: string; dueAt: Date | null }[], now: Date) {
  if (!tasks.length) return { text: "📝 Ochiq vazifa yo'q 🎉", keyboard: undefined };
  const keyboard = new InlineKeyboard();
  const lines = tasks.map((t, i) => {
    keyboard
      .text(`✅ ${i + 1}`, `tdl:${t.id}`)
      .text(`🗑 ${i + 1}`, `txl:${t.id}`)
      .row();
    const due = t.dueAt ? ` · ${t.dueAt < now ? "⚠️ " : ""}${when(t.dueAt, now)}` : "";
    return `${i + 1}. ${t.title}${due} #${shortId(t.id)}`;
  });
  return { text: `📝 Ochiq vazifalar (${tasks.length}):\n\n${lines.join("\n")}`, keyboard };
}

export function remindersView(
  reminders: { id: string; text: string; remindAt: Date; recurrence: unknown }[],
  now: Date,
) {
  if (!reminders.length) return { text: "⏰ Kelgusi eslatma yo'q.", keyboard: undefined };
  const keyboard = new InlineKeyboard();
  const lines = reminders.map((r, i) => {
    keyboard.text(`🗑 ${i + 1}`, `rxl:${r.id}`);
    if (i % 4 === 3) keyboard.row();
    const rec = parseRecurrence(r.recurrence);
    return `${i + 1}. ${when(r.remindAt, now)}: ${r.text}${rec ? ` (${repeatLabel(rec)})` : ""} #${shortId(r.id)}`;
  });
  return { text: `⏰ Kelgusi eslatmalar (${reminders.length}):\n\n${lines.join("\n")}`, keyboard };
}

export function agendaText(title: string, a: Agenda, now: Date) {
  const sections = [
    a.bookings.length &&
      `🗓 Uchrashuvlar:\n${a.bookings.map((b) => `• ${when(b.startsAt, now)} ${who(b)}: ${topic(b)}`).join("\n")}`,
    a.tasks.length &&
      `📝 Vazifalar:\n${a.tasks.map((t) => `• ${t.title} (${t.dueAt && t.dueAt < now ? "⚠️ muddati o'tgan, " : ""}${when(t.dueAt!, now)}) #${shortId(t.id)}`).join("\n")}`,
    a.reminders.length &&
      `⏰ Eslatmalar:\n${a.reminders.map((r) => `• ${when(r.remindAt, now)} ${r.text}`).join("\n")}`,
  ].filter(Boolean);
  return `${title}\n\n${sections.length ? sections.join("\n\n") : "Hech narsa rejalashtirilmagan."}`;
}

export function bookingsText(bookings: (BookingView & { status: string })[], now: Date) {
  if (!bookings.length) return "🗓 Kelgusi uchrashuvlar yo'q.";
  const items = bookings.map(
    (b) =>
      `🗓 ${when(b.startsAt, now)}: ${who(b)}\n🎯 ${topic(b)}\n🔗 ${b.meetUrl ?? (b.status === "PENDING_MEET" ? "Meet hali tayyor emas" : "—")}`,
  );
  return `Kelgusi uchrashuvlar (Toshkent vaqti):\n\n${items.join("\n\n")}`;
}

export function statsText(s: {
  bookings: number;
  cancelled: number;
  resumeDownloads: number;
  topServices: { slug: string; clicks: number }[];
}) {
  const top = s.topServices.map((t) => `${t.slug} (${t.clicks})`).join(", ") || "—";
  return [
    "📊 Oxirgi 7 kun",
    `🗓 Yangi yozilishlar: ${s.bookings} (bekor qilingan: ${s.cancelled})`,
    `📄 Rezyume yuklab olindi: ${s.resumeDownloads}`,
    `🧩 Ko'p bosilgan xizmatlar: ${top}`,
  ].join("\n");
}

const SETTING_LABELS: Record<keyof BotSettings, string> = {
  morningDigest: "Ertalabki xulosa (08:30)",
  eveningDigest: "Kechki xulosa (21:00)",
  briefs: "Uchrashuv brifi (60/15 daq)",
};
export function settingsView(s: BotSettings) {
  const keyboard = new InlineKeyboard();
  for (const key of Object.keys(SETTING_LABELS) as (keyof BotSettings)[]) {
    keyboard.text(`${s[key] ? "✅" : "❌"} ${SETTING_LABELS[key]}`, `st:${key}`).row();
  }
  return { text: "⚙️ Sozlamalar: yoqish/o'chirish uchun bosing.", keyboard };
}

/** 60-minute brief (docs/BOT.md): everything needed for the meeting plus 3–6 preparation questions. */
export function briefText(b: BookingView, minutesLeft: number, questions: string[]) {
  const contacts = [b.email, b.telegram, b.phone].filter(Boolean).join(" · ");
  return [
    `🔔 ${minutesLeft} daqiqadan keyin uchrashuv`,
    `👤 ${who(b)}`,
    `🎯 ${topic(b)}`,
    `🕒 ${hm(b.startsAt)} (Toshkent)`,
    `📧 ${contacts}`,
    `📝 Izoh: ${b.note || "—"}`,
    `🔗 ${b.meetUrl ?? "—"}`,
    "",
    "❓ Tayyorlanish savollari:",
    ...questions.map((q) => `• ${q}`),
  ].join("\n");
}

/** 15-minute brief: short. */
export const shortBriefText = (b: BookingView, minutesLeft: number) =>
  [
    `🔔 ${minutesLeft} daqiqadan keyin: ${b.name}`,
    `🎯 ${PURPOSE[b.purpose] ?? b.purpose}`,
    `🕒 ${hm(b.startsAt)} (Toshkent)`,
    `🔗 ${b.meetUrl ?? "—"}`,
  ].join("\n");

export const QUICK_ADD = (text: string) => `«${text}»\nNima qilamiz?`;
export const quickAddKeyboard = () =>
  new InlineKeyboard().text("📝 Vazifa", "qa:task").text("⏰ Eslatma", "qa:rem").row().text("✖️ Bekor", "qa:cancel");

export const quickTimeKeyboard = (kind: "task" | "rem") => {
  const kb = new InlineKeyboard()
    .text("Bugun 20:00", "qt:p20")
    .text("Ertaga 09:00", "qt:tm9")
    .row()
    .text("Hafta oxiri", "qt:we")
    .text("Boshqa vaqt", "qt:other");
  return kind === "task" ? kb.row().text("Muddatsiz", "qt:none") : kb;
};
