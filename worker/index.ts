import "@/lib/env/load"; // first: @/lib/db reads DATABASE_URL when imported
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { db } from "@/lib/db";
import {
  BOOKING_QUEUE,
  dispatchBackoff,
  HEARTBEAT_KEY,
  redisConnection,
  REMINDER_QUEUE,
  type BookingJob,
  type ReminderJob,
} from "@/lib/queue/jobs";
import { createBot } from "./bot";
import { COMMANDS } from "./bot/ui";
import { createBookingProcessor, failureAlert, onFinalFailure } from "./jobs/dispatch-booking";
import { createReminderProcessor, type Send } from "./jobs/reminders";
import { workerEnv } from "./lib/env";
import { errorLabel } from "./lib/log";
import { restorePending, scheduleDigests } from "./lib/reminders";
import { notifyOwner } from "./lib/telegram";

// The single worker process. Run exactly ONE replica: the bot long-polls Telegram and two pollers conflict
// (docker-compose.yml pins replicas: 1; n8n only sends messages with this token, never polls).
const env = workerEnv();
const connection = { ...redisConnection(env.REDIS_URL), maxRetriesPerRequest: null };
const RESTORE_EVERY_MS = 10 * 60_000;

async function main() {
  // booking → n8n (Calendar + Meet, Sheets, owner notification). 5 attempts: 10 s, 30 s, 2 min, 10 min.
  const bookings = new Worker<BookingJob>(
    BOOKING_QUEUE,
    createBookingProcessor({ baseUrl: env.N8N_BASE_URL, secret: env.N8N_WEBHOOK_SECRET, appUrl: env.APP_URL, adminUrl: env.ADMIN_URL }),
    { connection, settings: { backoffStrategy: (attemptsMade: number) => dispatchBackoff(attemptsMade) } },
  );
  onFinalFailure(bookings, (job) => notifyOwner(failureAlert(job, env.ADMIN_URL ?? env.APP_URL), env));

  // heartbeat for /api/health
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 });
  const beat = () =>
    redis
      .set(HEARTBEAT_KEY, new Date().toISOString(), "EX", 120)
      .catch(() => console.warn("[worker] heartbeat failed"));
  void beat();
  const timers = [setInterval(beat, 30_000)];

  // bot + reminders + meeting briefs + digests: all need the owner's bot
  const reminderQueue = new Queue<ReminderJob>(REMINDER_QUEUE, { connection });
  let reminders: Worker<ReminderJob> | undefined;
  let stopBot = async () => {};

  if (env.TELEGRAM_BOT_TOKEN && env.OWNER_TELEGRAM_ID) {
    const ownerId = env.OWNER_TELEGRAM_ID;
    const bot = createBot({ token: env.TELEGRAM_BOT_TOKEN, ownerId, queue: reminderQueue });
    const send: Send = (text, keyboard) =>
      bot.api.sendMessage(ownerId, text, { reply_markup: keyboard, link_preview_options: { is_disabled: true } });

    reminders = new Worker<ReminderJob>(REMINDER_QUEUE, createReminderProcessor({ send, queue: reminderQueue }), {
      connection,
    });
    reminders.on("failed", (job, err) =>
      console.error(`[worker] reminders/${job?.name} ${job?.id ?? ""}: ${errorLabel(err)}`),
    );

    // Postgres is the source of truth: put every PENDING reminder back on the queue now and every 10 minutes
    const restore = () =>
      restorePending(reminderQueue).catch((e) => {
        console.error(`[worker] restoring reminders failed: ${errorLabel(e)}`);
        return 0;
      });
    console.log(`[worker] ${await restore()} pending reminder(s) scheduled`);
    timers.push(setInterval(restore, RESTORE_EVERY_MS));
    await scheduleDigests(reminderQueue);

    await bot.api.setMyCommands(COMMANDS).catch((e) => console.warn(`[bot] setMyCommands: ${errorLabel(e)}`));
    bot
      .start({ onStart: (me) => console.log(`[bot] @${me.username} long polling`) })
      .catch((e) => console.error(`[bot] polling stopped: ${errorLabel(e)}`));
    stopBot = () => bot.stop();
  } else {
    console.warn("[worker] TELEGRAM_BOT_TOKEN / OWNER_TELEGRAM_ID not set: bot, reminders, briefs and digests are off");
  }

  console.log(`[worker] started (${env.NODE_ENV}), booking queue → ${env.N8N_BASE_URL}`);

  let stopping = false;
  async function shutdown() {
    if (stopping) return;
    stopping = true;
    console.log("[worker] shutting down");
    timers.forEach(clearInterval);
    await stopBot();
    await Promise.all([bookings.close(), reminders?.close()]);
    await reminderQueue.close();
    redis.disconnect();
    await db.$disconnect();
    process.exit(0);
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(`[worker] failed to start: ${errorLabel(e)}`);
  process.exit(1);
});
