# BOOKING + n8n — flow, contracts, workflows

## Responsibility split

| Part | Does |
|---|---|
| **Next.js app** | Source of truth for slots and bookings (Postgres). Validates, saves the booking, enqueues a BullMQ job `dispatch-booking`. |
| **Worker (BullMQ)** | Calls the n8n webhook with retries (5 attempts, exponential backoff). Schedules the 60/15-minute meeting reminders. Sends a Telegram alert if n8n keeps failing. |
| **n8n (self-hosted)** | Creates/deletes the **Google Calendar** event with a **Google Meet** link and the visitor as attendee; appends/updates a row in **Google Sheets**; sends the **Telegram** notification to the owner; calls the app back with the Meet link. |
| **Google Calendar invite** | Emails the visitor (no separate email service). |

n8n **only sends** Telegram messages (Telegram node "Send Message"). It must **not** use a Telegram Trigger on the same bot, because the worker long-polls that bot and two consumers conflict.

## Sequence (create)

```
Visitor → POST /api/bookings
  app: validate → transaction insert Booking(status=PENDING_MEET) → enqueue dispatch-booking → 201 {token}
Worker: POST {N8N_BASE_URL}/webhook/booking-created   (header X-Webhook-Secret)
n8n:    validate secret → Google Calendar: create event (+Meet, attendee) → HTTP POST app /api/n8n/booking-confirmed
        → Google Sheets: append row → Telegram: notify owner
App:    set status=CONFIRMED, store meetUrl + calendarEventId → schedule reminders (60m, 15m)
Visitor page polls GET /api/bookings/{token} → shows Meet link
```

If n8n fails permanently: Booking stays `PENDING_MEET`; the worker alerts the owner on Telegram; admin shows a **Retry** button.

## Contracts

All JSON, UTF-8. Times are ISO-8601 UTC strings.

### App → n8n: `POST /webhook/booking-created`
Header: `X-Webhook-Secret: ${N8N_WEBHOOK_SECRET}`
```json
{
  "bookingId": "ckx...",
  "startsAt": "2026-10-24T05:00:00.000Z",
  "endsAt": "2026-10-24T05:30:00.000Z",
  "ownerTimezone": "Asia/Tashkent",
  "visitor": { "name": "Ali Valiyev", "email": "ali@example.com", "telegram": "@ali", "phone": "+998...", "company": "Acme", "timezone": "Europe/London", "locale": "en" },
  "purpose": "JOB_OFFER",
  "service": { "slug": "crm-pms", "title": "CRM / PMS / admin systems" },
  "note": "We are hiring a NestJS developer",
  "manageUrl": "https://abduvaxobov.uz/en/booking/<token>",
  "adminUrl": "https://abduvaxobov.uz/admin/bookings/ckx..."
}
```

### App → n8n: `POST /webhook/booking-cancelled`
Header: `X-Webhook-Secret`
```json
{ "bookingId": "ckx...", "calendarEventId": "abc123", "cancelledBy": "visitor", "visitor": { "name": "Ali Valiyev", "email": "ali@example.com" }, "startsAt": "2026-10-24T05:00:00.000Z" }
```

### n8n → App: `POST {APP_URL}/api/n8n/booking-confirmed`
Header: `X-Callback-Secret: ${N8N_CALLBACK_SECRET}`
```json
{ "bookingId": "ckx...", "calendarEventId": "abc123", "meetUrl": "https://meet.google.com/xxx-xxxx-xxx" }
```

### n8n → App: `POST {APP_URL}/api/n8n/booking-failed`
```json
{ "bookingId": "ckx...", "error": "short message" }
```
Both callbacks must be idempotent (same payload twice = same result) and compare secrets in constant time.

## Workflows to build (export JSON into `n8n/workflows/`)

### 1. `booking-created`
1. **Webhook** (POST, path `booking-created`, response: "When last node finishes" or immediate 200).
2. **IF** header `x-webhook-secret` equals the secret (store it as an n8n credential/env; otherwise respond 401 and stop).
3. **Google Calendar → Create event** on the owner's primary calendar:
   - Summary: `Consultation: {{visitor.name}} ({{purpose}})`
   - Start/End from `startsAt`/`endsAt`, timezone `Asia/Tashkent`
   - Attendees: `{{visitor.email}}`
   - Description: purpose, service, company, Telegram, phone, note, `manageUrl`
   - **Conference solution: Google Meet** (node's additional field). If the node version lacks it, use an **HTTP Request** node with the Google OAuth2 credential: `POST https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all` with `conferenceData.createRequest = { requestId: <bookingId>, conferenceSolutionKey: { type: "hangoutsMeet" } }`.
   - Send updates to attendees: **all** (this is the visitor's email confirmation).
   - Reminders: popup 30 and 10 minutes.
4. **HTTP Request** → app `/api/n8n/booking-confirmed` with `calendarEventId` and the Meet link from `hangoutLink`/`conferenceData.entryPoints[0].uri`.
5. **Google Sheets → Append row** (columns below).
6. **Telegram → Send message** to `OWNER_TELEGRAM_ID` (template below).
7. **Error workflow / error branch** on steps 3–4: HTTP Request → app `/api/n8n/booking-failed`, then Telegram alert.

### 2. `booking-cancelled`
Webhook → secret check → Google Calendar **Delete event** (`calendarEventId`, send updates to attendees) → Google Sheets **Update row** by `bookingId` (status = CANCELLED) → Telegram notify owner.

### 3. `weekly-summary` (optional)
Schedule every Sunday 20:00 Asia/Tashkent → HTTP GET app `/api/n8n/stats` (secret header; returns last-7-days bookings, resume downloads, top services) → Telegram message.

## Google Sheets columns (sheet "Bookings")

`bookingId | createdAt | status | startsAt (Tashkent) | name | email | telegram | phone | company | purpose | service | note | meetUrl | visitorTimezone | locale`

## Telegram notification template (Uzbek, sent to the owner)

```
🆕 Yangi uchrashuv
👤 {{name}} {{#company}}({{company}}){{/company}}
🎯 Maqsad: {{purposeLabel}}
🧩 Xizmat: {{serviceTitle || "—"}}
🕒 {{startsAt in Asia/Tashkent, "DD.MM.YYYY HH:mm"}} (Toshkent)
📧 {{email}}  {{telegram}}  {{phone}}
📝 {{note || "—"}}
🔗 {{meetUrl}}
Admin: {{adminUrl}}
```

## Setup checklist (manual, see README)

1. Google OAuth client with redirect `https://n8n.<domain>/rest/oauth2-credential/callback`; publish the consent screen to **production** so refresh tokens don't expire in 7 days.
2. In n8n: create credentials **Google Calendar OAuth2**, **Google Sheets OAuth2**, **Telegram API (bot token)**.
3. Import the workflow JSON files, set the Sheet ID, activate workflows.
4. Put the same secrets in `.env` (`N8N_WEBHOOK_SECRET`, `N8N_CALLBACK_SECRET`) and in n8n (as env vars or credential values).
5. n8n must be reachable by the worker over the Docker network (`http://n8n:5678`), and the app reachable by n8n at `APP_URL` (or `http://app:3000` inside Docker).
6. Test: book a slot → Calendar event with Meet, visitor invite email, Sheets row, Telegram message, callback sets `CONFIRMED`.
