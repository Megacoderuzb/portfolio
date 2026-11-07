import type { Job } from "bullmq";
import type { InlineKeyboard } from "grammy";
import { db } from "@/lib/db";
import { repeatJob, type ReminderJob } from "@/lib/queue/jobs";
import { nextOccurrence } from "../bot/parse";
import { agendaText, briefText, deliveryKeyboard, reminderMessage, shortBriefText, tasksView } from "../bot/ui";
import { pickQuestions } from "../lib/meeting-questions";
import {
  agenda,
  dayRange,
  getSettings,
  openTasks,
  parseRecurrence,
  schedule,
  type BotSettings,
  type ReminderQueue,
} from "../lib/reminders";

export type Send = (text: string, keyboard?: InlineKeyboard) => Promise<unknown>;
type Deps = { send: Send; queue: ReminderQueue; now?: () => Date; settings?: () => Promise<BotSettings> };

/**
 * Consumer for the `reminders` queue:
 * - deliver: a bot reminder (with ✅/⏰ buttons and one gentle repeat 30 min later) or a meeting brief
 * - repeat:  that one repeat, only if the reminder is still unacknowledged
 * - digest:  morning 08:30 / evening 21:00, if enabled in /settings
 * Messages are sent before the DB is updated: a retry may send twice, but a reminder is never lost.
 */
export function createReminderProcessor({ send, queue, now = () => new Date(), settings = getSettings }: Deps) {
  async function deliver(id: string, at: number) {
    const r = await db.reminder.findUnique({ where: { id } });
    // snoozed, done, cancelled or already advanced since this job was scheduled
    if (!r || r.status !== "PENDING" || r.remindAt.getTime() !== at) return "stale";
    if (r.kind === "brief60" || r.kind === "brief15") return brief(r.id, r.kind, r.bookingId);

    const recurrence = parseRecurrence(r.recurrence);
    await send(reminderMessage(r.text, recurrence), deliveryKeyboard(r.id));
    const sentAt = now();
    if (recurrence) {
      // after a long downtime, skip missed occurrences instead of firing them all
      const next = nextOccurrence(recurrence, new Date(Math.max(sentAt.getTime(), r.remindAt.getTime())));
      await db.reminder.update({ where: { id }, data: { remindAt: next, lastSentAt: sentAt } });
      await schedule(queue, { id, remindAt: next });
    } else {
      await db.reminder.update({ where: { id }, data: { status: "SENT", lastSentAt: sentAt } });
    }
    await queue.add(...repeatJob(id, sentAt));
    return "sent";
  }

  async function repeat(id: string, sentAt: number) {
    const r = await db.reminder.findUnique({ where: { id } });
    if (!r || r.lastSentAt?.getTime() !== sentAt) return "stale";
    const recurrence = parseRecurrence(r.recurrence);
    // one-off: ✅ makes it DONE, ⏰ makes it PENDING again; recurring: ✅/⏰ remove this job
    if (r.status !== (recurrence ? "PENDING" : "SENT")) return "stale";
    await send(reminderMessage(r.text, recurrence, true), deliveryKeyboard(r.id));
    return "sent";
  }

  async function brief(id: string, kind: "brief60" | "brief15", bookingId: string | null) {
    const booking = bookingId
      ? await db.booking.findUnique({
          where: { id: bookingId },
          include: { service: { select: { slug: true, content: true } } },
        })
      : null;
    const minutesLeft = booking ? Math.round((booking.startsAt.getTime() - now().getTime()) / 60_000) : 0;
    if (!booking || booking.status !== "CONFIRMED" || minutesLeft <= 0 || !(await settings()).briefs) {
      await db.reminder.update({ where: { id }, data: { status: "CANCELLED" } });
      return "skipped";
    }
    await send(
      kind === "brief60"
        ? briefText(booking, minutesLeft, pickQuestions(booking.purpose, booking.service?.slug))
        : shortBriefText(booking, minutesLeft),
    );
    await db.reminder.update({ where: { id }, data: { status: "SENT", lastSentAt: now() } });
    return "sent";
  }

  async function digest(kind: "morning" | "evening") {
    const s = await settings();
    if (!(kind === "morning" ? s.morningDigest : s.eveningDigest)) return "off";
    const at = now();
    if (kind === "morning") {
      await send(agendaText("☀️ Xayrli tong! Bugungi reja:", await agenda(dayRange(at, 0), { overdue: true }), at));
    } else {
      const tomorrow = agendaText("🌙 Ertangi reja:", await agenda(dayRange(at, 1)), at);
      await send(`${tomorrow}\n\n${tasksView(await openTasks(), at).text}`);
    }
    return "sent";
  }

  return async (job: Job<ReminderJob>) => {
    const data = job.data;
    if ("digest" in data) return digest(data.digest);
    if ("sentAt" in data) return repeat(data.reminderId, data.sentAt);
    return deliver(data.reminderId, data.at);
  };
}
