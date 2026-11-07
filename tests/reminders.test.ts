import { Queue, type Job } from "bullmq";
import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { cancelBriefs, scheduleBriefs } from "@/lib/n8n";
import { REMINDER_QUEUE, redisConnection, reminderJobId, repeatJobId, type ReminderJob } from "@/lib/queue/jobs";
import { nextOccurrence, type Recurrence } from "../worker/bot/parse";
import { createReminderProcessor } from "../worker/jobs/reminders";
import { pickQuestions, QUESTIONS } from "../worker/lib/meeting-questions";
import {
  addReminder,
  addTask,
  completeReminder,
  restorePending,
  snoozeReminder,
  type BotSettings,
} from "../worker/lib/reminders";

// Reminder engine against real Postgres + Redis (an isolated queue). Dates are in 2099 so a running dev
// worker could never deliver these rows.

const run = randomBytes(4).toString("hex");
const tag = `[test ${run}]`;
const connection = { ...redisConnection(process.env.REDIS_URL!), maxRetriesPerRequest: null };
const queue = new Queue<ReminderJob>(`test-reminders-${run}`, { connection });
const appQueue = new Queue<ReminderJob>(REMINDER_QUEUE, { connection });
const NOW = new Date("2099-03-10T07:00:00Z");
const MIN = 60_000;
const bookingIds: string[] = [];

const job = (name: string, data: ReminderJob) => ({ name, data }) as Job<ReminderJob>;
const deliver = (r: { id: string; remindAt: Date }) => job("deliver", { reminderId: r.id, at: r.remindAt.getTime() });

function rig(settings: Partial<BotSettings> = {}, now = NOW) {
  const sent: { text: string; buttons: string }[] = [];
  const process = createReminderProcessor({
    queue,
    now: () => now,
    settings: async () => ({ morningDigest: true, eveningDigest: false, briefs: true, ...settings }),
    send: async (text, keyboard) => sent.push({ text, buttons: JSON.stringify(keyboard?.inline_keyboard ?? []) }),
  });
  return { sent, process };
}

let slot = 0;
async function makeBooking(status: "CONFIRMED" | "CANCELLED" = "CONFIRMED") {
  slot += 1;
  const service = await db.service.findUnique({ where: { slug: "crm-pms" } });
  const startsAt = new Date(Date.UTC(2099, 5, 1 + Math.floor(Math.random() * 300), 4, slot * 30));
  const booking = await db.booking.create({
    data: {
      token: randomBytes(32).toString("base64url"),
      name: "Brief Test",
      company: "Acme",
      email: `brief-${run}@example.test`,
      telegram: "@brief",
      purpose: "JOB_OFFER",
      serviceId: service?.id,
      note: "NestJS",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * MIN),
      status,
      meetUrl: "https://meet.google.com/abc-defg-hij",
    },
    include: { service: true },
  });
  bookingIds.push(booking.id);
  return booking;
}

afterAll(async () => {
  await db.reminder.deleteMany({ where: { OR: [{ text: { startsWith: tag } }, { bookingId: { in: bookingIds } }] } });
  await db.task.deleteMany({ where: { title: { startsWith: tag } } });
  await db.booking.deleteMany({ where: { id: { in: bookingIds } } });
  await queue.obliterate({ force: true });
  await Promise.all([queue.close(), appQueue.close()]);
});

describe("meeting questions", () => {
  const services = [...Object.keys(QUESTIONS.service), null, "unknown-service"];
  const purposes = ["JOB_OFFER", "FREELANCE", "NETWORKING", "OTHER"] as const;

  it("always 3–6, deterministic, general first", () => {
    for (const purpose of purposes) {
      for (const service of services) {
        const picked = pickQuestions(purpose, service);
        expect(picked.length).toBeGreaterThanOrEqual(3);
        expect(picked.length).toBeLessThanOrEqual(6);
        expect(new Set(picked).size).toBe(picked.length);
        expect(picked[0]).toBe(QUESTIONS.general[0]);
        expect(pickQuestions(purpose, service)).toEqual(picked);
      }
    }
  });

  it("mixes general + purpose + service", () => {
    expect(pickQuestions("JOB_OFFER", "crm-pms")).toEqual([
      QUESTIONS.general[0],
      ...QUESTIONS.purpose.JOB_OFFER.slice(0, 3),
      ...QUESTIONS.service["crm-pms"].slice(0, 2),
    ]);
    expect(pickQuestions("OTHER", null)).toEqual([...QUESTIONS.general, ...QUESTIONS.purpose.OTHER]);
    expect(pickQuestions("FREELANCE", "unknown-service")).toEqual([
      ...QUESTIONS.general,
      ...QUESTIONS.purpose.FREELANCE.slice(0, 4),
    ]);
  });
});

describe("restart: pending reminders are re-enqueued", () => {
  it("restores every PENDING reminder with its deterministic id, idempotently, also after Redis loss", async () => {
    const pending = await Promise.all(
      [1, 2, 3].map((h) =>
        db.reminder.create({ data: { text: `${tag} restore ${h}`, remindAt: new Date(NOW.getTime() + h * 60 * MIN) } }),
      ),
    );
    const sent = await db.reminder.create({ data: { text: `${tag} already sent`, remindAt: NOW, status: "SENT" } });
    const ours = new Set(pending.map((r) => r.id));
    const ourJobs = async () =>
      (await queue.getDelayed(0, -1)).filter((j) => "reminderId" in j.data && ours.has(j.data.reminderId));

    await restorePending(queue);
    await restorePending(queue); // a second start adds nothing
    expect((await ourJobs()).map((j) => j.id).sort()).toEqual(
      pending.map((r) => reminderJobId(r.id, r.remindAt)).sort(),
    );
    expect(await queue.getJob(reminderJobId(sent.id, sent.remindAt))).toBeUndefined();

    await queue.obliterate({ force: true }); // Redis lost everything
    expect(await ourJobs()).toHaveLength(0);
    await restorePending(queue);
    expect(await ourJobs()).toHaveLength(3);
  });
});

describe("delivery", () => {
  it("one-off: sends ⏰ with buttons, marks SENT, schedules exactly one gentle repeat after 30 min", async () => {
    const { sent, process } = rig();
    const r = await addReminder(queue, { text: `${tag} hisobot`, remindAt: new Date(NOW.getTime() + MIN) });

    await expect(process(job("deliver", { reminderId: r.id, at: r.remindAt.getTime() - 1 }))).resolves.toBe("stale");
    await expect(process(deliver(r))).resolves.toBe("sent");
    expect(sent[0].text).toBe(`⏰ ${tag} hisobot`);
    expect(sent[0].buttons).toContain(`rd:${r.id}`);
    expect(sent[0].buttons).toContain(`rs:${r.id}:15m`);

    const saved = await db.reminder.findUniqueOrThrow({ where: { id: r.id } });
    expect(saved).toMatchObject({ status: "SENT", lastSentAt: NOW });
    const repeat = await queue.getJob(repeatJobId(r.id, NOW));
    expect(repeat?.opts.delay).toBe(30 * MIN);

    await expect(process(deliver(r))).resolves.toBe("stale"); // a retried job never sends twice
    await expect(process(job("repeat", { reminderId: r.id, sentAt: NOW.getTime() }))).resolves.toBe("sent");
    expect(sent[1].text).toBe(`🔁 ⏰ ${tag} hisobot`);
    expect(sent).toHaveLength(2);
  });

  it("✅ cancels the pending repeat; the repeat job then does nothing", async () => {
    const { sent, process } = rig();
    const r = await addReminder(queue, { text: `${tag} ack`, remindAt: new Date(NOW.getTime() + MIN) });
    await process(deliver(r));
    await completeReminder(queue, r.id);

    expect((await db.reminder.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("DONE");
    expect(await queue.getJob(repeatJobId(r.id, NOW))).toBeUndefined();
    await expect(process(job("repeat", { reminderId: r.id, sentAt: NOW.getTime() }))).resolves.toBe("stale");
    expect(sent).toHaveLength(1);
  });

  it("⏰ +15 daq: moves remindAt, counts the snooze, reschedules, drops the repeat", async () => {
    const { process } = rig();
    const r = await addReminder(queue, { text: `${tag} snooze`, remindAt: new Date(NOW.getTime() + MIN) });
    await process(deliver(r));

    const at = await snoozeReminder(queue, r.id, "15m", NOW);
    expect(at).toEqual(new Date(NOW.getTime() + 15 * MIN));
    expect(await db.reminder.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({
      status: "PENDING",
      remindAt: at,
      snoozeCount: 1,
    });
    expect(await queue.getJob(reminderJobId(r.id, at!))).toBeDefined();
    expect(await queue.getJob(repeatJobId(r.id, NOW))).toBeUndefined();

    const tomorrow = await snoozeReminder(queue, r.id, "tomorrow", NOW);
    expect(tomorrow!.toISOString()).toBe("2099-03-11T04:00:00.000Z"); // 09:00 Tashkent
  });

  it("recurring: after a send the next occurrence is scheduled; ✅ keeps the series; ⏰ snoozes a copy", async () => {
    const { sent, process } = rig();
    const rec: Recurrence = { type: "daily", time: "08:00" };
    const first = nextOccurrence(rec, NOW);
    const r = await addReminder(queue, { text: `${tag} dori`, remindAt: first, recurrence: rec });

    await expect(process(deliver(r))).resolves.toBe("sent");
    expect(sent[0].text).toBe(`⏰ ${tag} dori\n(har kuni 08:00)`);
    const next = new Date(first.getTime() + 24 * 60 * MIN);
    expect(await db.reminder.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({
      status: "PENDING",
      remindAt: next,
    });
    expect(await queue.getJob(reminderJobId(r.id, next))).toBeDefined();

    await completeReminder(queue, r.id);
    expect((await db.reminder.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("PENDING");
    expect(await queue.getJob(repeatJobId(r.id, NOW))).toBeUndefined();

    await snoozeReminder(queue, r.id, "1h", NOW);
    const copies = await db.reminder.findMany({ where: { text: `${tag} dori`, id: { not: r.id } } });
    expect(copies.map((c) => [c.remindAt, c.recurrence])).toEqual([[new Date(NOW.getTime() + 60 * MIN), null]]);
    expect((await db.reminder.findUniqueOrThrow({ where: { id: r.id } })).remindAt).toEqual(next);
  });

  it("✅ on a task's reminder completes the task", async () => {
    const task = await addTask(queue, { title: `${tag} resume`, dueAt: new Date(NOW.getTime() + 60 * MIN) });
    const reminder = await db.reminder.findFirstOrThrow({ where: { taskId: task.id } });
    await completeReminder(queue, reminder.id);
    expect((await db.task.findUniqueOrThrow({ where: { id: task.id } })).done).toBe(true);
  });
});

describe("meeting briefs", () => {
  const brief = (bookingId: string, kind: "brief60" | "brief15", startsAt: Date) =>
    db.reminder.create({
      data: {
        bookingId,
        kind,
        text: "",
        remindAt: new Date(startsAt.getTime() - (kind === "brief60" ? 60 : 15) * MIN),
      },
    });

  it("60 min: who, what, when (Tashkent), contacts, note, Meet and 3–6 questions", async () => {
    const b = await makeBooking();
    const r = await brief(b.id, "brief60", b.startsAt);
    const { sent, process } = rig({}, r.remindAt);
    await expect(process(deliver(r))).resolves.toBe("sent");

    const text = sent[0].text;
    expect(text).toMatch(/^🔔 60 daqiqadan keyin uchrashuv\n👤 Brief Test \(Acme\)\n🎯 Ish taklifi/);
    expect(text).toContain("(Toshkent)");
    expect(text).toContain(`brief-${run}@example.test · @brief`);
    expect(text).toContain("📝 Izoh: NestJS");
    expect(text).toContain("🔗 https://meet.google.com/abc-defg-hij");
    const questions = pickQuestions("JOB_OFFER", b.service?.slug);
    for (const q of questions) expect(text).toContain(`• ${q}`);
    expect(text.match(/^• /gm)).toHaveLength(questions.length);
    expect((await db.reminder.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("SENT");
  });

  it("15 min: short (no questions)", async () => {
    const b = await makeBooking();
    const r = await brief(b.id, "brief15", b.startsAt);
    const { sent, process } = rig({}, r.remindAt);
    await process(deliver(r));
    expect(sent[0].text).toMatch(
      /^🔔 15 daqiqadan keyin: Brief Test\n🎯 Ish taklifi\n🕒 \d\d:\d\d \(Toshkent\)\n🔗 https:/,
    );
    expect(sent[0].text).not.toContain("❓");
  });

  it("nothing is sent for a cancelled booking or with briefs turned off", async () => {
    const cancelled = await makeBooking("CANCELLED");
    const r1 = await brief(cancelled.id, "brief60", cancelled.startsAt);
    const off = await makeBooking();
    const r2 = await brief(off.id, "brief15", off.startsAt);

    const a = rig({}, r1.remindAt);
    await expect(a.process(deliver(r1))).resolves.toBe("skipped");
    const b = rig({ briefs: false }, r2.remindAt);
    await expect(b.process(deliver(r2))).resolves.toBe("skipped");
    expect([...a.sent, ...b.sent]).toHaveLength(0);
    expect((await db.reminder.findUniqueOrThrow({ where: { id: r1.id } })).status).toBe("CANCELLED");
  });

  it("confirm schedules both briefs; cancel removes their jobs", async () => {
    const b = await makeBooking();
    await scheduleBriefs(b.id, b.startsAt, NOW);
    const rows = await db.reminder.findMany({ where: { bookingId: b.id }, orderBy: { remindAt: "asc" } });
    expect(rows.map((r) => r.kind)).toEqual(["brief60", "brief15"]);
    for (const r of rows) expect(await appQueue.getJob(reminderJobId(r.id, r.remindAt))).toBeDefined();

    await cancelBriefs(b.id);
    for (const r of rows) expect(await appQueue.getJob(reminderJobId(r.id, r.remindAt))).toBeUndefined();
    expect(await db.reminder.count({ where: { bookingId: b.id, status: "PENDING" } })).toBe(0);
  });
});

describe("digests", () => {
  it("morning sends the day's plan; evening is off by default", async () => {
    const { sent, process } = rig();
    await expect(process(job("digest", { digest: "morning" }))).resolves.toBe("sent");
    expect(sent[0].text).toMatch(/^☀️ Xayrli tong! Bugungi reja:/);
    await expect(process(job("digest", { digest: "evening" }))).resolves.toBe("off");
    expect(sent).toHaveLength(1);
  });
});
