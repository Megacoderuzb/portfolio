# Phase 06 — Personal assistant bot, reminders, meeting briefs

Prerequisite: phases 00–05 done and committed. `TELEGRAM_BOT_TOKEN` and `OWNER_TELEGRAM_ID` are set (new, separate bot created via @BotFather).

---

Read `CLAUDE.md`, `docs/BOT.md` (full), `docs/MEETING-QUESTIONS.md`, `prisma/schema.prisma` (Task, Reminder), `docs/SPEC.md` §5.

## Tasks

1. **Worker bootstrap** (`worker/index.ts`): env validation, Prisma + Redis, BullMQ queues/workers, grammY bot with **long polling**, graceful shutdown (stop polling, close queues), Redis heartbeat `worker:heartbeat` every 30 s, and `/api/health` reporting db, redis and worker status.
2. **Owner-only guard:** middleware allowing only `OWNER_TELEGRAM_ID`; others get a single short reply "Bu shaxsiy bot." then are ignored (rate limited).
3. **Parser** `worker/bot/parse.ts` implementing the exact grammar in `docs/BOT.md` (times, `bugun/ertaga/indin`, weekdays, `DD.MM[.YYYY]`, `+30m/+2h/+1d`, recurrence `har kuni / har <weekday> / har oy N`), Asia/Tashkent, apostrophe variants, friendly Uzbek errors with an example. **Table-driven Vitest tests** with at least 40 cases including past-time rollover, month-end clamping, DST-free timezone math and malformed input.
4. **Commands & flows** per the doc: `/start /help /today /tomorrow /week /task /tasks /remind /reminders /done /del /bookings /stats /settings`, plus the quick-add menu for plain messages (buttons for Vazifa/Eslatma and time presets, "Boshqa vaqt" asks for typed time). Inline buttons for ✅ done and 🗑 delete. All text in Uzbek (Latin).
5. **Reminder engine:** Postgres is the source of truth; BullMQ delayed jobs with deterministic ids; on worker start re-enqueue every `PENDING` reminder (idempotent); delivery message with buttons **[✅ Bajarildi] [⏰ +15 daq] [⏰ +1 soat] [⏰ Ertaga 09:00]**; snooze updates `remindAt`; recurring reminders schedule the next occurrence after each send; one gentle repeat after 30 min without acknowledgement, never more.
6. **Digests:** morning 08:30 (default on) and evening 21:00 (default off) built from bookings, tasks and reminders; toggles in `/settings` (store in `Setting` key `bot`).
7. **Meeting briefs:** convert `docs/MEETING-QUESTIONS.md` into `worker/lib/meeting-questions.ts` (static map: `general`, `purpose.*`, `service.<slug>`); consumers for `brief60` and `brief15` jobs scheduled in phase 05: 60-minute message with name/company, purpose, service, time (Tashkent), contacts, note, Meet link and **3–6 questions** (1–2 general + purpose + service, deterministic selection); 15-minute message shorter. Cancelled bookings remove their jobs and nothing is sent; sending is skipped if the booking is no longer `CONFIRMED`.
8. **`/bookings` and `/stats`** read from the DB (upcoming bookings; last 7 days bookings, resume downloads, top services).
9. **Tests:** parser (above), reminder recurrence math, brief selection, owner guard, and an integration test that a restart re-enqueues pending reminders (use an in-memory/test Redis or mock the queue).

## Rules

No AI APIs · single worker instance (document it) · no personal data in logs · every message Uzbek · times always shown in Toshkent vaqti.

## Acceptance criteria

- Owner can create tasks/reminders by command and by buttons; reminders fire on time, can be snoozed/done; recurring ones repeat correctly; restart loses nothing.
- A confirmed booking produces the 60- and 15-minute briefs with relevant questions; cancel removes them.
- Lint/typecheck/tests/build pass.

## Final report

Command cheat-sheet (Uzbek) for the owner, what was verified automatically, and what to test manually in Telegram.
