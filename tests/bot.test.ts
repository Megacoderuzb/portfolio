import type { Context } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createBot } from "../worker/bot";
import { ownerGuard } from "../worker/bot/guard";
import { parse } from "../worker/bot/parse";
import { getSettings, shortId, type ReminderQueue } from "../worker/lib/reminders";

const OWNER = 1001;
const STRANGER = 2002;
const DAY = 24 * 60 * 60 * 1000;

describe("ownerGuard", () => {
  const ctx = (id: number, type = "private") =>
    ({
      from: { id },
      chat: { type },
      reply: vi.fn(async () => {}),
      answerCallbackQuery: vi.fn(async () => {}),
    }) as unknown as Context & {
      reply: ReturnType<typeof vi.fn>;
    };

  it("lets the owner through in a private chat only", async () => {
    const guard = ownerGuard(OWNER);
    const next = vi.fn(async () => {});
    await guard(ctx(OWNER), next);
    expect(next).toHaveBeenCalledOnce();
    await guard(ctx(OWNER, "group"), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("answers a stranger once a day, then ignores them", async () => {
    let now = 0;
    const guard = ownerGuard(OWNER, () => now);
    const next = vi.fn(async () => {});
    const first = ctx(STRANGER);
    await guard(first, next);
    expect(first.reply).toHaveBeenCalledWith("Bu shaxsiy bot.");

    const again = ctx(STRANGER);
    now = DAY - 1;
    await guard(again, next);
    expect(again.reply).not.toHaveBeenCalled();

    const other = ctx(STRANGER + 1);
    await guard(other, next);
    expect(other.reply).toHaveBeenCalledOnce();

    const nextDay = ctx(STRANGER);
    now = DAY;
    await guard(nextDay, next);
    expect(nextDay.reply).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
  });
});

describe("bot commands and buttons (fake Telegram API, real DB)", () => {
  const run = randomBytes(4).toString("hex");
  const tag = `[test ${run}]`;
  const NOW = new Date("2099-03-10T07:00:00Z"); // far future: a running dev worker can't deliver these rows
  const queue = { add: vi.fn(async () => ({})), remove: vi.fn(async () => 1) } as unknown as ReminderQueue & {
    add: ReturnType<typeof vi.fn>;
  };
  const bot = createBot({
    token: "1:test",
    ownerId: OWNER,
    queue,
    now: () => NOW,
    botInfo: { id: 42, is_bot: true, first_name: "Test", username: "test_bot" } as UserFromGetMe,
  });

  const calls: { method: string; payload: Record<string, unknown> }[] = [];
  let messageId = 500;
  bot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> });
    const result =
      method === "sendMessage" ? { message_id: ++messageId, date: 0, chat: { id: OWNER, type: "private" } } : true;
    return { ok: true, result } as never;
  });

  let updateId = 0;
  const user = (id: number) => ({ id, is_bot: false, first_name: "U" });
  const chat = (id: number) => ({ id, type: "private" as const, first_name: "U" });
  const say = (text: string, from = OWNER) => {
    const command = /^\/\w+/.exec(text);
    return bot.handleUpdate({
      update_id: ++updateId,
      message: {
        message_id: ++updateId,
        date: 0,
        chat: chat(from),
        from: user(from),
        text,
        ...(command && { entities: [{ type: "bot_command", offset: 0, length: command[0].length }] }),
      },
    } as Update);
  };
  const press = (data: string, onMessage: number) =>
    bot.handleUpdate({
      update_id: ++updateId,
      callback_query: {
        id: String(updateId),
        from: user(OWNER),
        chat_instance: "c",
        data,
        message: { message_id: onMessage, date: 0, chat: chat(OWNER), text: "…" },
      },
    } as Update);
  const last = (method = "sendMessage") => calls.filter((c) => c.method === method).at(-1)!.payload;
  const buttons = (payload: Record<string, unknown>) => JSON.stringify(payload.reply_markup ?? {});
  const at = (spec: string) => (parse(`${spec} x`, NOW) as { remindAt: Date }).remindAt;

  afterAll(async () => {
    await db.reminder.deleteMany({ where: { text: { startsWith: tag } } });
    await db.task.deleteMany({ where: { title: { startsWith: tag } } });
  });

  it("strangers get one short answer and nothing else", async () => {
    await say("/tasks", STRANGER);
    await say("salom", STRANGER);
    const toStranger = calls.filter((c) => c.payload.chat_id === STRANGER);
    expect(toStranger.map((c) => c.payload.text)).toEqual(["Bu shaxsiy bot."]);
  });

  it("/remind creates and schedules a reminder; bad input gets an Uzbek example", async () => {
    await say(`/remind ertaga 09:30 ${tag} hisobot`);
    const r = await db.reminder.findFirstOrThrow({ where: { text: `${tag} hisobot` } });
    expect(r.remindAt).toEqual(at("ertaga 09:30"));
    expect(queue.add).toHaveBeenLastCalledWith(
      "deliver",
      { reminderId: r.id, at: r.remindAt.getTime() },
      expect.objectContaining({ jobId: `reminder:${r.id}:${r.remindAt.getTime()}` }),
    );
    expect(last().text).toContain(`⏰ Eslatma qo'shildi #${shortId(r.id)}`);
    expect(buttons(last())).toContain(`rx:${r.id}`);

    await say("/remind qachondir nimadir");
    expect(last().text).toMatch(/^❗ Vaqtni tushunmadim\. Masalan:/);
  });

  it("/task with a date also creates its reminder; /done <kod> completes it", async () => {
    await say(`/task ${tag} resume ertaga`);
    const task = await db.task.findFirstOrThrow({ where: { title: `${tag} resume` } });
    expect(task.dueAt).toEqual(at("ertaga"));
    expect(await db.reminder.count({ where: { taskId: task.id, status: "PENDING" } })).toBe(1);
    expect(last().text).toContain("📝 Vazifa qo'shildi");

    await say(`/done ${shortId(task.id)}`);
    expect(last().text).toBe(`✅ Bajarildi: ${tag} resume`);
    expect((await db.task.findUniqueOrThrow({ where: { id: task.id } })).done).toBe(true);
    expect(await db.reminder.count({ where: { taskId: task.id, status: "PENDING" } })).toBe(0);
  });

  it("plain text → [Eslatma] → [Ertaga 09:00] creates a reminder", async () => {
    await say(`${tag} Ali ga qo'ng'iroq`);
    const menu = messageId;
    expect(last().text).toBe(`«${tag} Ali ga qo'ng'iroq»\nNima qilamiz?`);
    expect(buttons(last())).toContain("qa:rem");

    await press("qa:rem", menu);
    expect(buttons(last("editMessageText"))).toContain("qt:tm9");
    expect(buttons(last("editMessageText"))).not.toContain("qt:none"); // "Muddatsiz" is for tasks only
    await press("qt:tm9", menu);
    const r = await db.reminder.findFirstOrThrow({ where: { text: `${tag} Ali ga qo'ng'iroq` } });
    expect(r.remindAt).toEqual(at("ertaga 09:00"));
    expect(last("editMessageText").text).toContain("⏰ Eslatma qo'shildi");
  });

  it("plain text → [Vazifa] → [Boshqa vaqt] → typed time creates a task", async () => {
    await say(`${tag} portfolio deploy`);
    const menu = messageId;
    await press("qa:task", menu);
    await press("qt:other", menu);
    expect(last("editMessageText").text).toContain("Vaqtni yozing");

    await say("ertaga soat 10");
    expect(last().text).toMatch(/^❗ /); // not a time: still waiting
    await say("juma 10:00");
    const task = await db.task.findFirstOrThrow({ where: { title: `${tag} portfolio deploy` } });
    expect(task.dueAt).toEqual(at("juma 10:00"));
    expect(last().text).toContain("📝 Vazifa qo'shildi");
  });

  it("delivery buttons: ✅ completes, ⏰ snoozes", async () => {
    await say(`/remind +2h ${tag} tugma`);
    const r = await db.reminder.findFirstOrThrow({ where: { text: `${tag} tugma` } });
    await press(`rs:${r.id}:1h`, 1);
    expect((await db.reminder.findUniqueOrThrow({ where: { id: r.id } })).remindAt).toEqual(
      new Date(NOW.getTime() + 60 * 60_000),
    );
    expect(last("editMessageText").text).toContain("⏰ Qoldirildi: bugun");

    await press(`rd:${r.id}`, 1);
    expect((await db.reminder.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("DONE");
    expect(last("answerCallbackQuery").text).toBe("✅ Bajarildi");
  });

  it("/settings toggles are saved (toggled twice: back to the original)", async () => {
    const before = await getSettings();
    await say("/settings");
    expect(buttons(last())).toContain("st:eveningDigest");
    await press("st:eveningDigest", messageId);
    expect((await getSettings()).eveningDigest).toBe(!before.eveningDigest);
    await press("st:eveningDigest", messageId);
    expect(await getSettings()).toEqual(before);
  });

  it("read-only commands answer in Uzbek", async () => {
    for (const command of ["/start", "/today", "/tomorrow", "/week", "/tasks", "/reminders", "/bookings", "/stats"]) {
      await say(command);
      expect(String(last().text).length).toBeGreaterThan(5);
    }
    await say("/stats");
    expect(last().text).toMatch(/^📊 Oxirgi 7 kun\n🗓 Yangi yozilishlar: \d+/);
    await say("/nimadir");
    expect(last().text).toBe("Noma'lum buyruq. /help");
  });
});
