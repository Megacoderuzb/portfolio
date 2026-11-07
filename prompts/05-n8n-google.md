# Phase 05 — n8n: Google Calendar + Meet, Google Sheets, Telegram notification

Prerequisite: phases 00–04 done and committed. The owner has completed the manual Google/Telegram setup from `README.md` (OAuth client, Sheet created, bot token). If something is missing, build everything that doesn't need it and list exactly what is blocked.

---

Read `CLAUDE.md`, `docs/BOOKING-N8N.md` (full), `docs/SPEC.md` §5 and §9.

## Tasks

1. **Dispatch consumer** in `worker/jobs/dispatch-booking.ts` (BullMQ): load the booking, POST to `{N8N_BASE_URL}/webhook/booking-created` with header `X-Webhook-Secret` and the payload contract from the doc; 5 attempts with exponential backoff (e.g. 10 s, 30 s, 2 min, 10 min, 30 min); a 4xx from n8n is not retried except 408/429. After the final failure keep the booking `PENDING_MEET` and send the owner a Telegram alert (plain Bot API `fetch` using `TELEGRAM_BOT_TOKEN`/`OWNER_TELEGRAM_ID`). Same pattern for `cancel-booking` → `/webhook/booking-cancelled`.
2. **Callbacks** in the app: `POST /api/n8n/booking-confirmed` and `POST /api/n8n/booking-failed` — zod validation, header `X-Callback-Secret` compared with constant-time equality, **idempotent**. On confirmed: set `status=CONFIRMED`, `meetUrl`, `calendarEventId`; enqueue the 60/15-minute brief jobs (producer only; consumers in phase 06). Ignore callbacks for cancelled bookings (and delete the created event via the cancel path if needed).
3. **n8n workflows** as importable JSON in `n8n/workflows/`:
   - `booking-created.json` (Webhook → secret check → Google Calendar create event with Google Meet + attendee + reminders → HTTP callback to the app → Google Sheets append → Telegram message to the owner; error branch → `booking-failed` callback + Telegram alert).
   - `booking-cancelled.json` (Webhook → secret check → delete Calendar event with updates to attendees → Sheets update row → Telegram notice).
   - `weekly-summary.json` (optional schedule workflow; add `GET /api/n8n/stats` guarded by the callback secret).
   Use credentials by **name placeholders** (`Google Calendar account`, `Google Sheets account`, `Telegram bot`) so the owner just re-selects them after import. Put the Sheet ID, owner Telegram ID and the app URL in n8n variables/env or in a clearly marked "Config" node. Follow the Telegram message template and Sheets columns from the doc. If the Calendar node cannot create Meet conferences in the installed n8n version, use the HTTP Request approach documented there.
4. **Docs:** write `docs/N8N-SETUP.md` — a numbered, copy-paste-friendly guide: starting n8n (dev compose), creating the three credentials, redirect URI, importing/activating workflows, setting secrets, running a test booking, and troubleshooting (OAuth "redirect_uri_mismatch", consent screen in Testing mode expiring tokens, webhook URL vs `WEBHOOK_URL`, timezone).
5. **Test mode:** a `scripts/test-dispatch.ts` that posts a sample payload to the webhook and a mock n8n server (tiny Node HTTP server) used by Vitest to prove retry/backoff, idempotent callbacks and secret checks without real Google access.

## Rules

n8n **only sends** Telegram messages — never a Telegram Trigger on the bot token (the worker long-polls it in phase 06). No secrets committed. Owner timezone Asia/Tashkent everywhere in the Sheet and messages.

## Acceptance criteria

- With a mock n8n: booking → dispatch → callback → `CONFIRMED` with Meet link; failures retry then alert.
- With real credentials (owner-run): a real booking creates a Calendar event with a Meet link and invites the visitor, appends a Sheets row and sends the Telegram message; cancel removes the event and updates the row.
- Lint/typecheck/tests/build pass.

## Final report

What is verified automatically vs. what requires the owner's real Google/Telegram credentials, plus the exact manual steps still pending.
