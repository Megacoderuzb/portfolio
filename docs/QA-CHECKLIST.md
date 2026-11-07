# QA checklist (run before going live)

## Build & code
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all pass
- [ ] No secrets in the repo; `.env` is git-ignored; env validation fails fast with a clear message
- [ ] Prisma migrations apply cleanly on an empty database; `pnpm seed` is idempotent (run twice)

## Content & i18n
- [ ] Every page/section works in `uz`, `ru`, `en`; no raw keys visible; no missing-message warnings
- [ ] Machine-drafted uz/ru translations of seeded projects/services reviewed by the owner
- [ ] Name, links, email, Telegram, LinkedIn, GitHub are correct everywhere
- [ ] No prices anywhere; no photo of the owner anywhere

## Design & motion
- [ ] Only palette tokens used (purple + black); functional red/green only for form states
- [ ] Each section has its own entrance animation; transitions are smooth at 60 fps on a mid phone
- [ ] `prefers-reduced-motion` produces a calm, fully usable site
- [ ] Layout verified at 360, 390, 768, 1024, 1440 px; no horizontal scroll

## Booking
- [ ] Sunday has no slots; Mon–Sat slots run 09:00–23:00 (last slot ends ≤ 23:00)
- [ ] Slots < 3 hours from now and > 30 days ahead are not offered
- [ ] Visitor sees times in own timezone with the label; owner time (Tashkent) shown on confirmation
- [ ] Two simultaneous requests for one slot → exactly one succeeds, the other gets `slot_taken`
- [ ] Honeypot, Turnstile and rate limits work; invalid input shows friendly translated errors
- [ ] Selected service and purpose are stored; admin dashboard shows service interest
- [ ] Manage page: cancel works, frees the slot, deletes the Calendar event, notifies the owner

## n8n / Google / Telegram
- [ ] Real booking → Calendar event with Meet link + visitor invite email
- [ ] Sheets row appended and updated on cancel
- [ ] Owner receives the Telegram notification in Uzbek
- [ ] Callback sets `CONFIRMED` and the visitor page shows the Meet link
- [ ] n8n down → booking stays `PENDING_MEET`, retries happen, owner is alerted, admin **Retry** works
- [ ] Google OAuth consent screen is in **production** (refresh token not expiring weekly)

## Bot
- [ ] Only the owner can use the bot
- [ ] `/remind`, `/task`, recurring reminders, snooze, done work; parser tests cover the grammar
- [ ] Restarting the worker/Redis does not lose pending reminders
- [ ] 60- and 15-minute meeting briefs arrive with the right questions; cancelled bookings send nothing
- [ ] Morning digest arrives at 08:30 Tashkent time

## Resume & admin
- [ ] Resume downloads the Full-Stack PDF; replacing it in admin changes the download immediately; counter increments
- [ ] Non-PDF / oversized uploads rejected
- [ ] `/admin` and admin APIs are inaccessible without login; login is rate limited
- [ ] Projects/services can be added, reordered, hidden, translated from admin

## Game
- [ ] Playable with mouse, touch, keyboard; page still scrolls vertically on mobile
- [ ] Pauses when offscreen or tab hidden; "Skip game" link works; best score persists
- [ ] Win shows the CTA and records `GAME_WIN`; no layout shift; game code not loaded before the footer approaches

## SEO, a11y, performance, security
- [ ] Lighthouse mobile ≥ 90 (Performance, Accessibility, Best Practices, SEO) for each locale
- [ ] `hreflang`, canonical, sitemap, robots, JSON-LD Person, OG image per locale
- [ ] Keyboard-only run-through of the whole site; visible focus; contrast AA
- [ ] Security headers present (CSP, referrer policy, frame-ancestors none, etc.)
- [ ] HTTPS with auto-renewing certificates; HTTP redirects to HTTPS

## Operations
- [ ] `docker compose up -d` on a clean VPS brings up app, worker, db, redis, n8n
- [ ] `/api/health` is green (db, redis, worker heartbeat)
- [ ] Daily Postgres backup runs and a restore was tested once
- [ ] Runbook (`docs/RUNBOOK.md` produced in phase 09) is accurate
