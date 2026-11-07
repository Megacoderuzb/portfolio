# BOT — personal assistant (Telegram)

A **new, separate** bot for the owner only. No AI APIs: everything is deterministic (commands, a small Uzbek date parser, inline buttons). Runs inside the `worker` process with grammY long polling + BullMQ for scheduling. Language: **Uzbek (Latin)**.

## Security

- Allow only `ctx.from.id === OWNER_TELEGRAM_ID`; everyone else gets one short "Bu shaxsiy bot." reply and is ignored afterwards (rate limited).
- Token only from env. Never echo secrets.

## Time handling

Owner timezone `Asia/Tashkent` (UTC+5). Store instants in UTC. Use Luxon.

## Commands

| Command | Action |
|---|---|
| `/start`, `/help` | short guide with examples |
| `/today`, `/tomorrow`, `/week` | meetings (from `Booking`), tasks and reminders for the period |
| `/task <matn> [sana] [vaqt]` | add a task; with date/time it also creates a reminder |
| `/tasks` | open tasks, each with ✅ / 🗑 buttons |
| `/remind <vaqt> <matn>` | add a reminder (grammar below) |
| `/reminders` | upcoming reminders with 🗑 buttons |
| `/done <id>`, `/del <id>` | complete / delete a task or reminder |
| `/bookings` | upcoming consultation bookings (time, name, purpose, service, Meet link) |
| `/stats` | last 7 days: bookings, resume downloads, top services |
| `/settings` | toggle morning digest / evening digest / meeting briefs |

A plain text message (no command) opens a quick-add menu: **[📝 Vazifa] [⏰ Eslatma]** → then time buttons **[Bugun 20:00] [Ertaga 09:00] [Hafta oxiri] [Boshqa vaqt]**; "Boshqa vaqt" asks the owner to type a time using the grammar.

## Date/time grammar (`worker/bot/parse.ts`, fully unit-tested)

Time: `HH:mm` (24h). Date words: `bugun`, `ertaga`, `indin`, weekdays (`dushanba, seshanba, chorshanba, payshanba, juma, shanba, yakshanba`, next occurrence), `DD.MM`, `DD.MM.YYYY`. Relative: `+30m`, `+2h`, `+1d`.

Examples:
```
/remind 15:00 Ali bilan qo'ng'iroq            → today 15:00 (if passed → tomorrow, and the bot says so)
/remind ertaga 09:30 hisobot yuborish
/remind 25.10 18:00 Dormix demo
/remind juma 10:00 jamoa yig'ilishi
/remind +45m choyni o'chir
/remind har kuni 08:00 dori ichish            → recurring daily
/remind har dushanba 10:00 haftalik reja      → weekly
/remind har oy 1 09:00 hisobotlar              → monthly (day-of-month; clamp to last day if shorter)
/task Resume'ni yangilash ertaga
```
Parser returns `{ remindAt: Date | null, recurrence: Recurrence | null, text: string }` or a friendly Uzbek error with an example. Accept case-insensitive input and both `'`/`ʻ`/`’` apostrophes.

`Recurrence = { type: "daily" | "weekly" | "monthly"; time: "HH:mm"; weekday?: 1..7; dayOfMonth?: 1..31 }`.

## Reminder delivery

- Source of truth = Postgres (`Reminder`, `Task`). BullMQ delayed jobs with deterministic `jobId = reminder:{id}:{remindAt}`; on worker start, re-enqueue every `PENDING` reminder (idempotent) so Redis loss/restart can't lose anything.
- Message: `⏰ {text}` with buttons **[✅ Bajarildi] [⏰ +15 daq] [⏰ +1 soat] [⏰ Ertaga 09:00]**. Snooze creates/updates the next `remindAt`. Recurring reminders compute the next occurrence after each send.
- Not acknowledged after 30 minutes → one gentle repeat; never more than one repeat.

## Digests

- **Morning digest 08:30** (if enabled): today's meetings (time, name, purpose, service), tasks due today, reminders for the day.
- **Evening digest 21:00** (optional, default off): tomorrow's meetings + open tasks.

## Meeting briefs (the "all info I need for client meetings" feature)

For every `CONFIRMED` booking the app schedules two jobs: **60 minutes** and **15 minutes** before `startsAt`. Message (Uzbek):

```
🔔 {60|15} daqiqadan keyin uchrashuv
👤 {name} {company}
🎯 {purposeLabel} · {serviceTitle}
🕒 {HH:mm} (Toshkent)
📧 {email} · {telegram} · {phone}
📝 Izoh: {note}
🔗 {meetUrl}

❓ Tayyorlanish savollari:
• ...{3–6 questions chosen by purpose + service from docs/MEETING-QUESTIONS.md}
```
Questions are a static map in `worker/lib/meeting-questions.ts` generated from `docs/MEETING-QUESTIONS.md` (no AI). The 15-minute message is shorter (time, Meet link, name, purpose). Cancelled bookings remove their jobs; rescheduling = cancel + new booking.

## Data model

`Task { id, title, notes?, dueAt?, done, createdAt }`, `Reminder { id, text, remindAt, recurrence Json?, status, taskId?, bookingId?, snoozeCount, lastSentAt? }` (see `prisma/schema.prisma`).

## Operational notes

- Single worker instance only (long polling must not run twice).
- Graceful shutdown: stop polling, close queues.
- Health: worker updates a Redis key `worker:heartbeat` every 30 s; `/api/health` reports it.
- Errors in handlers are caught and answered with a short Uzbek message; details logged without personal data.
