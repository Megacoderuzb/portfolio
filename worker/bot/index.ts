import { Bot, type Context, type InlineKeyboard } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import { weeklyStats } from "@/lib/stats";
import { errorLabel } from "../lib/log";
import {
  addReminder,
  addTask,
  agenda,
  cancelReminder,
  completeReminder,
  completeTask,
  dayRange,
  deleteTask,
  findByCode,
  getSettings,
  openTasks,
  snoozeReminder,
  toggleSetting,
  upcomingBookings,
  upcomingReminders,
  type BotSettings,
  type ReminderQueue,
  type Snooze,
} from "../lib/reminders";
import { ownerGuard } from "./guard";
import { EXAMPLES, parse, parseWhen, type Parsed } from "./parse";
import {
  agendaText,
  bookingsText,
  HELP,
  itemKeyboard,
  QUICK_ADD,
  quickAddKeyboard,
  quickTimeKeyboard,
  reminderAdded,
  remindersView,
  settingsView,
  statsText,
  taskAdded,
  tasksView,
  when,
} from "./ui";

type Options = { token: string; ownerId: number; queue: ReminderQueue; now?: () => Date; botInfo?: UserFromGetMe };
type Draft = { text: string; kind?: "task" | "rem" };

// Quick-add presets → the same grammar the commands use
const PRESETS: Record<string, string> = { p20: "20:00", tm9: "ertaga 09:00", we: "shanba 10:00" };
const MAX_DRAFTS = 50;

/** The owner's assistant bot (docs/BOT.md). Long polling is started by worker/index.ts. */
export function createBot({ token, ownerId, queue, now = () => new Date(), botInfo }: Options) {
  const bot = new Bot(token, { botInfo });
  bot.use(ownerGuard(ownerId));

  // quick-add state, keyed by the bot message that shows the buttons. ponytail: in memory, lost on restart.
  const drafts = new Map<number, Draft>();
  let awaitingTime: number | null = null; // draft whose time the owner is typing ("Boshqa vaqt")

  const send = (ctx: Context, text: string, keyboard?: InlineKeyboard) =>
    ctx.reply(text, { reply_markup: keyboard, link_preview_options: { is_disabled: true } });
  /** Replaces the message the button was on (dropping the buttons unless new ones are given). */
  const edit = (ctx: Context, text: string, keyboard?: InlineKeyboard) =>
    ctx.editMessageText(text, { reply_markup: keyboard, link_preview_options: { is_disabled: true } }).catch(() => {});
  const closeWith = (ctx: Context, status: string) =>
    edit(ctx, `${ctx.callbackQuery?.message?.text ?? ""}\n\n${status}`);

  // ------------------------------------------------------------ commands
  bot.command(["start", "help"], (ctx) => send(ctx, HELP));
  bot.command("today", async (ctx) =>
    send(ctx, agendaText("📅 Bugun", await agenda(dayRange(now(), 0), { overdue: true }), now())),
  );
  bot.command("tomorrow", async (ctx) => send(ctx, agendaText("📅 Ertaga", await agenda(dayRange(now(), 1)), now())));
  bot.command("week", async (ctx) =>
    send(ctx, agendaText("📅 7 kun", await agenda(dayRange(now(), 0, 7), { overdue: true }), now())),
  );

  bot.command("task", async (ctx) => {
    const p = parse(ctx.match, now(), "task");
    if (!p.ok) return send(ctx, `❗ ${p.error}`);
    const task = await addTask(queue, { title: p.text, dueAt: p.remindAt });
    return send(ctx, taskAdded(task, now(), p.rolledOver), itemKeyboard("t", task.id));
  });

  bot.command("remind", async (ctx) => {
    const p = parse(ctx.match, now(), "remind");
    if (!p.ok) return send(ctx, `❗ ${p.error}`);
    const r = await addReminder(queue, { text: p.text, remindAt: p.remindAt!, recurrence: p.recurrence });
    return send(ctx, reminderAdded(r, p.recurrence, now(), p.rolledOver), itemKeyboard("r", r.id));
  });

  bot.command("tasks", async (ctx) => {
    const view = tasksView(await openTasks(), now());
    return send(ctx, view.text, view.keyboard);
  });
  bot.command("reminders", async (ctx) => {
    const view = remindersView(await upcomingReminders(), now());
    return send(ctx, view.text, view.keyboard);
  });

  for (const action of ["done", "del"] as const) {
    bot.command(action, async (ctx) => {
      const found = await findByCode(ctx.match);
      if (found.kind === "invalid")
        return send(ctx, `Kodni yozing: /${action} abc12 (kodlar /tasks va /reminders da #abc12 ko'rinishida).`);
      if (found.kind === "none") return send(ctx, "Topilmadi: ochiq vazifa yoki faol eslatma shu kod bilan yo'q.");
      if (found.kind === "many") return send(ctx, "Bir nechta topildi: uzunroq kod yozing.");
      const { kind, item } = found;
      if (kind === "task") await (action === "done" ? completeTask(queue, item.id) : deleteTask(queue, item.id));
      else await (action === "done" ? completeReminder(queue, item.id) : cancelReminder(queue, item.id));
      const title = kind === "task" ? item.title : item.text;
      return send(ctx, `${action === "done" ? "✅ Bajarildi" : "🗑 O'chirildi"}: ${title}`);
    });
  }

  bot.command("bookings", async (ctx) => send(ctx, bookingsText(await upcomingBookings(now()), now())));
  bot.command("stats", async (ctx) => send(ctx, statsText(await weeklyStats(now()))));
  bot.command("settings", async (ctx) => {
    const view = settingsView(await getSettings());
    return send(ctx, view.text, view.keyboard);
  });

  // ------------------------------------------------------------ buttons
  // t = task, r = reminder; d = done, x = delete; trailing "l" = the button sits under a list (re-render the list)
  bot.callbackQuery(/^([tr])([dx])(l?):(\w+)$/, async (ctx) => {
    const [, kind, action, inList, id] = ctx.match;
    const result =
      kind === "t"
        ? await (action === "d" ? completeTask(queue, id) : deleteTask(queue, id))
        : await (action === "d" ? completeReminder(queue, id) : cancelReminder(queue, id));
    const status = !result ? "Topilmadi" : action === "d" ? "✅ Bajarildi" : "🗑 O'chirildi";
    await ctx.answerCallbackQuery(status);
    if (!inList) return closeWith(ctx, status);
    const view = kind === "t" ? tasksView(await openTasks(), now()) : remindersView(await upcomingReminders(), now());
    return edit(ctx, view.text, view.keyboard);
  });

  bot.callbackQuery(/^rs:(\w+):(15m|1h|tomorrow)$/, async (ctx) => {
    const at = await snoozeReminder(queue, ctx.match[1], ctx.match[2] as Snooze, now());
    const status = at ? `⏰ Qoldirildi: ${when(at, now())}` : "Topilmadi";
    await ctx.answerCallbackQuery(status);
    return closeWith(ctx, status);
  });

  bot.callbackQuery(/^st:(morningDigest|eveningDigest|briefs)$/, async (ctx) => {
    const view = settingsView(await toggleSetting(ctx.match[1] as keyof BotSettings));
    await ctx.answerCallbackQuery("Saqlandi");
    return edit(ctx, view.text, view.keyboard);
  });

  // ------------------------------------------------------------ quick-add: plain text → [Vazifa] [Eslatma] → time
  async function finish(
    ctx: Context,
    draft: Draft,
    p: Parsed | null,
    reply: (text: string, kb?: InlineKeyboard) => Promise<unknown>,
  ) {
    if (draft.kind === "task") {
      const task = await addTask(queue, { title: draft.text, dueAt: p?.remindAt ?? null });
      return reply(taskAdded(task, now(), p?.rolledOver), itemKeyboard("t", task.id));
    }
    const r = await addReminder(queue, { text: draft.text, remindAt: p!.remindAt!, recurrence: p!.recurrence });
    return reply(reminderAdded(r, p!.recurrence, now(), p!.rolledOver), itemKeyboard("r", r.id));
  }

  bot.callbackQuery(/^qa:(task|rem|cancel)$/, async (ctx) => {
    const messageId = ctx.callbackQuery.message?.message_id ?? 0;
    const draft = drafts.get(messageId);
    await ctx.answerCallbackQuery();
    if (!draft) return closeWith(ctx, "Eskirgan: matnni qayta yuboring.");
    if (ctx.match[1] === "cancel") {
      drafts.delete(messageId);
      return edit(ctx, `«${draft.text}»\n✖️ Bekor qilindi`);
    }
    draft.kind = ctx.match[1] as "task" | "rem";
    return edit(
      ctx,
      `«${draft.text}»\n${draft.kind === "task" ? "📝 Vazifa" : "⏰ Eslatma"}: qachon?`,
      quickTimeKeyboard(draft.kind),
    );
  });

  bot.callbackQuery(/^qt:(p20|tm9|we|other|none)$/, async (ctx) => {
    const messageId = ctx.callbackQuery.message?.message_id ?? 0;
    const draft = drafts.get(messageId);
    await ctx.answerCallbackQuery();
    if (!draft?.kind) return closeWith(ctx, "Eskirgan: matnni qayta yuboring.");
    const choice = ctx.match[1];
    if (choice === "other") {
      awaitingTime = messageId;
      return edit(ctx, `«${draft.text}»\nVaqtni yozing. ${EXAMPLES}`);
    }
    drafts.delete(messageId);
    const p = choice === "none" ? null : parseWhen(PRESETS[choice], now());
    if (p && !p.ok) return edit(ctx, `❗ ${p.error}`);
    return finish(ctx, draft, p, (text, kb) => edit(ctx, text, kb));
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return send(ctx, "Noma'lum buyruq. /help");

    const waiting = awaitingTime !== null ? drafts.get(awaitingTime) : undefined;
    if (waiting) {
      const p = parseWhen(text, now());
      if (!p.ok) return send(ctx, `❗ ${p.error}`);
      if (waiting.kind === "task" && p.recurrence)
        return send(ctx, "❗ Vazifa takrorlanmaydi: sana va vaqt yozing, masalan: juma 10:00.");
      drafts.delete(awaitingTime!);
      awaitingTime = null;
      return finish(ctx, waiting, p, (t, kb) => send(ctx, t, kb));
    }

    const menu = await send(ctx, QUICK_ADD(text), quickAddKeyboard());
    if (drafts.size >= MAX_DRAFTS) drafts.delete(drafts.keys().next().value!);
    drafts.set(menu.message_id, { text });
  });

  // Errors: a short Uzbek answer; the log gets the error class only (no message text, no personal data).
  bot.catch(async (err) => {
    console.error(
      `[bot] ${err.ctx.update.callback_query ? "button" : "message"} handler failed: ${errorLabel(err.error)}`,
    );
    await err.ctx.reply("⚠️ Xatolik yuz berdi. Birozdan keyin qayta urinib ko'ring.").catch(() => {});
  });

  return bot;
}
