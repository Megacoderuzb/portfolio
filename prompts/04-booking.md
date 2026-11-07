# Phase 04 — Booking system

Prerequisite: phases 00–03 done and committed. Postgres and Redis running.

---

Read `CLAUDE.md`, `docs/SPEC.md` §5, §9, §11, `docs/BOOKING-N8N.md` (contracts only; the n8n side is phase 05), `messages/*.json`.

## Tasks

1. **Time library** (`src/lib/time`, `src/lib/booking`) using Luxon: owner timezone `Asia/Tashkent`; functions to generate slots for a date from the `availability` setting, filter by min notice and horizon, remove overlaps with non-cancelled bookings and blocked slots (including buffer), and convert to a visitor timezone. **Pure functions with exhaustive Vitest tests:** Sunday closed, Mon–Sat 09:00–23:00, last slot ends ≤ 23:00, 15/30/45/60-minute slot lengths, buffer, min notice boundary, max horizon boundary, blocked ranges, visitor timezones with a different date (e.g. Pacific/Auckland, America/Los_Angeles).
2. **API:**
   - `GET /api/availability?date=YYYY-MM-DD` (and `from`/`to` ≤ 31 days) → `{ slots: [{ start, end }], closed }`.
   - `POST /api/bookings` → zod validation (name, email, optional telegram/phone/company/note with length limits, purpose enum, optional service slug, `startsAt`, visitor timezone, locale), honeypot field, **Cloudflare Turnstile** verification (skip with a clear warning when keys are absent in development), Redis rate limit (5/IP/hour), max 2 future active bookings per email, server-side slot re-validation, transactional insert; map Postgres `23P01` to `409 { error: "slot_taken" }`. Generate the 32-byte base64url `token`. Store a salted hash of the IP. Status starts `PENDING_MEET`. Record `BOOKING_CREATED` event. Enqueue the BullMQ job `dispatch-booking` (queue producer in `src/lib/queue`; the consumer is built in phase 05/06 — for now the job may be a logged no-op consumer in `worker/`).
   - `GET /api/bookings/{token}` → public view (status, times, `meetUrl?`, service title, purpose; no PII of others).
   - `POST /api/bookings/{token}/cancel` → sets `CANCELLED` + `cancelledAt`, enqueues `cancel-booking`; idempotent.
3. **Booking UI** (section `#booking`): 3-step flow with a `Stepper` and direction-aware `AnimatePresence`: (1) purpose + optional service (preselected from `?service=`/store), (2) date strip + slot grid with the timezone label and the owner's time (Tashkent) shown on hover/selection, (3) details form with inline validation and translated errors. Success card with date/time (visitor tz + Tashkent), status, polling `GET /api/bookings/{token}` every 2 s for up to 30 s for the Meet link, link to the manage page. Prominent "Free · {minutes} min · Google Meet" label. Fire `BOOKING_STARTED` when step 2 is reached.
4. **Manage page** `/[locale]/booking/[token]`: details, Meet button when available, **Cancel** with a confirm dialog, cancelled state, "book again" link, graceful not-found. `noindex`.
5. **Admin:** 
   - **Availability** page: work days, start/end, slot length, buffer, min notice, horizon; **blocked slots** CRUD; changes revalidate availability.
   - **Bookings** page: table (filters by status/date/service/purpose), status actions (Done / No-show / Cancel), owner notes, Meet link, visible `PENDING_MEET` state with a **Retry dispatch** button (enqueues `dispatch-booking` again). Dashboard now shows upcoming bookings, purpose split and service interest (bookings + clicks).
6. **Double-booking test:** a Vitest integration test (against the dev DB) firing parallel inserts for the same slot — exactly one succeeds.

## Rules

Never trust the client for slot validity · no PII in logs · all strings from messages · Purple + black palette · keyboard accessible (slot grid is a radio group).

## Acceptance criteria

- Visitor can book a slot end to end (n8n not yet connected: booking stays `PENDING_MEET`).
- Sunday shows closed; slots respect the 3-hour notice and 30-day horizon; timezone display is correct.
- Double booking is impossible (test passes); cancellation frees the slot.
- Lint/typecheck/tests/build pass.

## Final report

Decisions taken (e.g. how Turnstile behaves without keys), test coverage summary, manual steps (Turnstile keys).
