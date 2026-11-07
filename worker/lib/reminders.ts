import type { Queue } from "bullmq";
import { DateTime } from "luxon";
import { z } from "zod";
import { db } from "@/lib/db";
import { deliverJob, reminderJobId, repeatJobId, type ReminderJob } from "@/lib/queue/jobs";
import { OWNER_ZONE } from "@/lib/time";
import { recurrenceSchema, type Recurrence } from "../bot/parse";

// The bot's data: tasks, reminders, settings. Postgres is the source of truth; BullMQ only holds the timers.

export type ReminderQueue = Pick<Queue<ReminderJob>, "add" | "remove">;

/** (Re)schedules a delivery. Deterministic job id: calling it twice adds one job. */
export const schedule = (queue: ReminderQueue, r: { id: string; remindAt: Date }) =>
  queue.add(...deliverJob(r.id, r.remindAt));

const unschedule = async (queue: ReminderQueue, r: { id: string; remindAt: Date; lastSentAt: Date | null }) => {
  await queue.remove(reminderJobId(r.id, r.remindAt));
  if (r.lastSentAt) await queue.remove(repeatJobId(r.id, r.lastSentAt));
};

/** Worker start + periodic sweep: every PENDING reminder gets its job back, so Redis loss or a failed job loses nothing. */
export async function restorePending(queue: ReminderQueue) {
  const pending = await db.reminder.findMany({ where: { status: "PENDING" }, select: { id: true, remindAt: true } });
  for (const r of pending) await schedule(queue, r);
  return pending.length;
}

export const parseRecurrence = (value: unknown): Recurrence | null => recurrenceSchema.safeParse(value).data ?? null;

export async function addReminder(
  queue: ReminderQueue,
  input: { text: string; remindAt: Date; recurrence?: Recurrence | null; taskId?: string },
) {
  const reminder = await db.reminder.create({
    data: {
      text: input.text,
      remindAt: input.remindAt,
      recurrence: input.recurrence ?? undefined,
      taskId: input.taskId,
    },
  });
  await schedule(queue, reminder);
  return reminder;
}

/** A task; with a due time it also gets a reminder at that time. */
export async function addTask(queue: ReminderQueue, input: { title: string; dueAt: Date | null }) {
  const task = await db.task.create({ data: { title: input.title, dueAt: input.dueAt } });
  if (input.dueAt) await addReminder(queue, { text: input.title, remindAt: input.dueAt, taskId: task.id });
  return task;
}

async function closeTaskReminders(queue: ReminderQueue, taskId: string, status: "DONE" | "CANCELLED") {
  const open = await db.reminder.findMany({ where: { taskId, status: { in: ["PENDING", "SENT"] } } });
  await db.reminder.updateMany({ where: { id: { in: open.map((r) => r.id) } }, data: { status } });
  for (const r of open) await unschedule(queue, r);
}

export async function completeTask(queue: ReminderQueue, id: string) {
  const task = await db.task.findUnique({ where: { id } });
  if (!task) return null;
  if (!task.done) await db.task.update({ where: { id }, data: { done: true, doneAt: new Date() } });
  await closeTaskReminders(queue, id, "DONE");
  return task;
}

export async function deleteTask(queue: ReminderQueue, id: string) {
  const task = await db.task.findUnique({ where: { id } });
  if (!task) return null;
  await closeTaskReminders(queue, id, "CANCELLED");
  await db.task.delete({ where: { id } });
  return task;
}

/**
 * ✅ on a reminder. One-off: DONE (and its task too). Recurring: only this occurrence is acknowledged
 * (the gentle repeat is cancelled); the series keeps going.
 */
export async function completeReminder(queue: ReminderQueue, id: string) {
  const r = await db.reminder.findUnique({ where: { id } });
  if (!r) return null;
  if (parseRecurrence(r.recurrence)) {
    if (r.lastSentAt) await queue.remove(repeatJobId(r.id, r.lastSentAt));
    return r;
  }
  await db.reminder.update({ where: { id }, data: { status: "DONE" } });
  await unschedule(queue, r);
  if (r.taskId) await completeTask(queue, r.taskId);
  return r;
}

/** 🗑 / /del: stops the reminder (a recurring one stops for good). */
export async function cancelReminder(queue: ReminderQueue, id: string) {
  const r = await db.reminder.findUnique({ where: { id } });
  if (!r) return null;
  await db.reminder.update({ where: { id }, data: { status: "CANCELLED" } });
  await unschedule(queue, r);
  return r;
}

export type Snooze = "15m" | "1h" | "tomorrow";

export function snoozeTarget(snooze: Snooze, now: Date) {
  const t = DateTime.fromJSDate(now).setZone(OWNER_ZONE);
  if (snooze === "15m") return t.plus({ minutes: 15 }).toJSDate();
  if (snooze === "1h") return t.plus({ hours: 1 }).toJSDate();
  return t.plus({ days: 1 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 }).toJSDate();
}

/** ⏰ buttons. One-off: moves remindAt. Recurring: this occurrence becomes a one-off copy; the series is untouched. */
export async function snoozeReminder(queue: ReminderQueue, id: string, snooze: Snooze, now = new Date()) {
  const r = await db.reminder.findUnique({ where: { id } });
  if (!r || r.status === "DONE" || r.status === "CANCELLED") return null;
  const remindAt = snoozeTarget(snooze, now);
  if (r.lastSentAt) await queue.remove(repeatJobId(r.id, r.lastSentAt));

  if (parseRecurrence(r.recurrence)) {
    await addReminder(queue, { text: r.text, remindAt, taskId: r.taskId ?? undefined });
  } else {
    await queue.remove(reminderJobId(r.id, r.remindAt));
    await db.reminder.update({ where: { id }, data: { remindAt, status: "PENDING", snoozeCount: { increment: 1 } } });
    await schedule(queue, { id, remindAt });
  }
  return remindAt;
}

/** Short code shown as #abc12 (the cuid's random tail); /done and /del accept it or the full id. */
export const shortId = (id: string) => id.slice(-5);

export async function findByCode(input: string) {
  const code = input.trim().replace(/^#/, "").toLowerCase();
  if (!/^[a-z0-9]{4,40}$/.test(code)) return { kind: "invalid" as const };
  const [tasks, reminders] = await Promise.all([
    db.task.findMany({ where: { id: { endsWith: code }, done: false }, take: 2 }),
    db.reminder.findMany({ where: { id: { endsWith: code }, status: { in: ["PENDING", "SENT"] } }, take: 2 }),
  ]);
  if (tasks.length + reminders.length > 1) return { kind: "many" as const };
  if (tasks[0]) return { kind: "task" as const, item: tasks[0] };
  if (reminders[0]) return { kind: "reminder" as const, item: reminders[0] };
  return { kind: "none" as const };
}

// ---------------------------------------------------------------- reading

/** [start, end) of `days` Tashkent days, starting `offset` days from today. */
export function dayRange(now: Date, offset: number, days = 1) {
  const start = DateTime.fromJSDate(now).setZone(OWNER_ZONE).startOf("day").plus({ days: offset });
  return [start.toJSDate(), start.plus({ days }).toJSDate()] as const;
}

const bookingInclude = { service: { select: { slug: true, content: true } } } as const;

/** Meetings, open tasks due in the range (plus overdue ones if asked) and stand-alone reminders. */
export async function agenda([from, to]: readonly [Date, Date], { overdue = false } = {}) {
  const [bookings, tasks, reminders] = await Promise.all([
    db.booking.findMany({
      where: { startsAt: { gte: from, lt: to }, status: { in: ["PENDING_MEET", "CONFIRMED"] } },
      orderBy: { startsAt: "asc" },
      include: bookingInclude,
    }),
    db.task.findMany({
      where: { done: false, dueAt: overdue ? { lt: to } : { gte: from, lt: to } },
      orderBy: { dueAt: "asc" },
    }),
    db.reminder.findMany({
      where: { kind: "custom", taskId: null, status: "PENDING", remindAt: { gte: from, lt: to } },
      orderBy: { remindAt: "asc" },
    }),
  ]);
  return { bookings, tasks, reminders };
}
export type Agenda = Awaited<ReturnType<typeof agenda>>;

export const upcomingBookings = (now = new Date()) =>
  db.booking.findMany({
    where: { startsAt: { gte: new Date(now.getTime() - 30 * 60_000) }, status: { in: ["PENDING_MEET", "CONFIRMED"] } },
    orderBy: { startsAt: "asc" },
    take: 10,
    include: bookingInclude,
  });

export const openTasks = () =>
  db.task.findMany({
    where: { done: false },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 20,
  });

export const upcomingReminders = () =>
  db.reminder.findMany({ where: { kind: "custom", status: "PENDING" }, orderBy: { remindAt: "asc" }, take: 20 });

// ---------------------------------------------------------------- settings (Setting key "bot")

const settingsSchema = z.object({
  morningDigest: z.boolean().default(true),
  eveningDigest: z.boolean().default(false),
  briefs: z.boolean().default(true),
});
export type BotSettings = z.infer<typeof settingsSchema>;

export async function getSettings(): Promise<BotSettings> {
  const row = await db.setting.findUnique({ where: { key: "bot" } });
  return settingsSchema.safeParse(row?.value ?? {}).data ?? settingsSchema.parse({});
}

export async function toggleSetting(key: keyof BotSettings) {
  const current = await getSettings();
  const value = { ...current, [key]: !current[key] };
  await db.setting.upsert({ where: { key: "bot" }, create: { key: "bot", value }, update: { value } });
  return value;
}

/** Morning 08:30 and evening 21:00 digests (BullMQ job schedulers, idempotent; the job checks the toggles). */
export async function scheduleDigests(queue: Pick<Queue<ReminderJob>, "upsertJobScheduler">) {
  await queue.upsertJobScheduler(
    "digest-morning",
    { pattern: "30 8 * * *", tz: OWNER_ZONE },
    { name: "digest", data: { digest: "morning" } },
  );
  await queue.upsertJobScheduler(
    "digest-evening",
    { pattern: "0 21 * * *", tz: OWNER_ZONE },
    { name: "digest", data: { digest: "evening" } },
  );
}
