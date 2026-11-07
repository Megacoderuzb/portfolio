# SPEC — Personal portfolio (Muhammadjon Abduvakhobov)

## 1. Goal

A fast, modern, memorable portfolio that makes a recruiter, a networking contact or a one-off client do one thing: **book a free 30-minute Google Meet call**. Secondary actions: download the resume, open a contact link. The owner also gets a private admin panel and a Telegram personal-assistant bot.

## 2. Hard constraints

See `CLAUDE.md` "Hard rules". Summary: full-stack Next.js, no paid services except VPS + domain, three languages (uz/ru/en), purple + black palette, no photo of the owner, no prices, Asia/Tashkent timezone for the owner.

Free services that ARE allowed: Google Calendar API, Google Sheets API, Telegram Bot API, Cloudflare Turnstile, self-hosted n8n, Let's Encrypt.

## 3. Site map

| URL | Purpose |
|---|---|
| `/{locale}` | Landing page with all sections (`uz` default, also `ru`, `en`) |
| `/{locale}/booking/{token}` | Visitor manages one booking (details, join Meet, cancel) |
| `/admin` (+ subpages) | Owner admin (not localized) |
| `/api/*` | Route handlers (see §9) |
| `/sitemap.xml`, `/robots.txt`, `/{locale}/opengraph-image` | SEO |

Locale detection: `/` redirects to `/uz` unless `Accept-Language` clearly prefers `ru` or `en`; the choice is remembered in a cookie. Language switcher in the navbar.

## 4. Landing sections (in order)

1. **Hero** — badge "Open to job offers & projects", name *Muhammadjon Abduvakhobov*, role *Full-Stack Developer*, one-line value statement, two CTAs (**Book a free call**, **Download resume**), stat chips (years of experience "3+", live project count from DB, "NestJS · Next.js"). Visual: animated terminal-style card showing a `whoami`-like object, floating violet orbs, grid + noise background. No photo.
2. **About** — short paragraph + "Open to" chips (Full-time role · Freelance project · Networking). Education line (Tashkent State University of Economics, FinTech) and language line (Uzbek native, English C1, Russian A2) as small facts.
3. **Stack** — marquee/grid of technologies grouped: Backend, Frontend, Data & Queues, DevOps, Payments (Click, Payme, Uzum Bank, Atmos), Automation (n8n), AI-assisted development.
4. **Projects** — cards from DB (`visible=true`, ordered). Card: title, type, summary, stack chips, link button when `url` exists. Click opens a detail drawer with highlights. Projects with `needs_input` status are hidden unless the owner makes them visible.
5. **Services** — cards from DB. Each card: title, description, **"Book"** button → scrolls to Booking with the service preselected and records a `SERVICE_CLICK` event. **No prices.**
6. **Booking** — 3-step flow (see §5). Prominent "Free · 30 min · Google Meet" label.
7. **Contacts** — email (copy button), Telegram, LinkedIn, GitHub, **Download resume** (current Full-Stack PDF, shows "updated {date}").
8. **Footer** — links, copyright, and the **breakout game** (`docs/GAME.md`).

Section-to-section transitions are specified in `docs/DESIGN.md`.

## 5. Booking

### Defaults (stored in `Setting`, editable in admin)

```json
{ "timezone": "Asia/Tashkent", "workDays": [1,2,3,4,5,6], "workStart": "09:00", "workEnd": "23:00",
  "slotMinutes": 30, "bufferMinutes": 0, "minNoticeHours": 3, "maxDaysAhead": 30 }
```
ISO weekdays: 1 = Monday … 7 = Sunday. **Sunday is closed.**

### Flow

1. **Step 1 — Purpose & service:** purpose (Job offer · Freelance project · Networking · Other) and optional service (6 services or "Not sure").
2. **Step 2 — Date & time:** date strip/calendar (closed days disabled), slot grid. Slots are generated in Asia/Tashkent and displayed in the **visitor's timezone** with an explicit label "Times shown in {tz}".
3. **Step 3 — Details:** name*, email* (needed for the Calendar invite), Telegram, phone, company, short note. Honeypot field + Turnstile.
4. **Done:** confirmation card with date/time (visitor tz + Tashkent), status. The Meet link appears as soon as n8n confirms (poll `GET /api/bookings/{token}` every 2 s up to 30 s; if still pending show "The Meet link will arrive in your email invite"). Link to the manage page.

### Slot algorithm (server, `src/lib/booking`)

For a date `D` (Asia/Tashkent): if weekday ∉ `workDays` → no slots. Else generate `start = workStart; start + slotMinutes <= workEnd; start += slotMinutes`. Keep a slot only if:
- `start >= now + minNoticeHours` and `D <= today + maxDaysAhead`;
- it does not overlap (including `bufferMinutes` on both sides) any `Booking` with status ≠ `CANCELLED`, nor any `BlockedSlot`.

Return ISO UTC instants. **The server re-validates on submit** and inserts inside a transaction; a Postgres **exclusion constraint** on `tstzrange(startsAt, endsAt)` (non-cancelled bookings) is the final guard against double booking (see `prisma/schema.prisma` notes). On conflict return `409 slot_taken`.

### Limits

Rate limit: 5 booking attempts / IP / hour; max 2 future active bookings per email. Reject disposable-looking input only by validation (zod), no external lookups.

### Manage page

`/{locale}/booking/{token}` (token = 32 random bytes, base64url). Shows details, Meet button, **Cancel** (confirm dialog). Cancel → status `CANCELLED`, n8n deletes the Calendar event, owner gets a Telegram message. Rescheduling = cancel + book again (link provided).

## 6. Admin (`/admin`)

Auth: single owner, `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` (bcrypt) from env; session = signed JWT in an httpOnly, Secure, SameSite=Lax cookie (jose); login rate limited; middleware guards `/admin/*` and admin API.

Pages:
- **Dashboard:** upcoming bookings, counts (bookings, resume downloads, service interest as a bar list, purpose split), last 30 days.
- **Bookings:** table with filters, status change (Done / No-show / Cancel), owner notes, Meet link, "retry n8n dispatch" button when `PENDING_MEET`.
- **Availability:** work days/hours, slot length (15/30/45/60), buffer, notice, horizon; **blocked slots** (date range + reason).
- **Projects:** CRUD, drag-reorder, visible toggle, status badge, per-locale tabs (uz/ru/en) for type/summary/highlights, stack chips, linked services.
- **Services:** CRUD, reorder, visible toggle, per-locale title/description. Shows interest count.
- **Resume:** upload a new PDF (≤ 5 MB, PDF only, magic-bytes check); previous versions kept (last 5); shows download count.
- **Settings:** contact links (email, Telegram, LinkedIn, GitHub), site texts that are not in message files if needed.

## 7. Resume

Only the **Full-Stack** resume. Stored on the server volume `RESUME_DIR`, metadata in `ResumeFile`. `GET /api/resume` streams the active PDF with `Content-Disposition: attachment; filename="Muhammadjon-Abduvakhobov-CV.pdf"`, logs a `RESUME_DOWNLOAD` event, and never exposes the storage path. The owner replaces it from admin without touching code.

## 8. Data model

See `prisma/schema.prisma` (source of truth). Entities: `Project`, `Service`, `Booking`, `BlockedSlot`, `Setting`, `ResumeFile`, `AnalyticsEvent`, `Task`, `Reminder`.

Seed: `seed/seed-data.json` → `pnpm seed` is **idempotent and non-destructive**: upsert by `slug`, create only missing rows; never overwrite rows the owner edited in admin (use `--force` to override). Seed text is English; phase 02/03 must produce `uz` and `ru` translations for seeded content and mark them "machine-drafted, review needed" in a comment so the owner can review.

## 9. API

| Route | Notes |
|---|---|
| `GET /api/availability?date=YYYY-MM-DD` (or `from`/`to`, ≤ 31 days) | returns `{ slots: [{ start, end }], closed: boolean }` |
| `POST /api/bookings` | zod-validated; Turnstile; rate limit; returns `{ token }` |
| `GET /api/bookings/{token}` | public view: status, times, `meetUrl?`, service, purpose |
| `POST /api/bookings/{token}/cancel` | |
| `GET /api/resume` | download |
| `POST /api/events` | whitelist of public event types only (`SERVICE_CLICK`, `PROJECT_CLICK`, `CONTACT_CLICK`, `GAME_WIN`), rate limited |
| `POST /api/n8n/booking-confirmed` | n8n → app callback, header `X-Callback-Secret` |
| `POST /api/n8n/booking-failed` | n8n → app callback |
| `GET /api/health` | `{ ok, db, redis }` |
| `/api/admin/*` | admin only (or Server Actions) |

## 10. Integrations

- **n8n + Google Calendar/Meet + Sheets + Telegram:** `docs/BOOKING-N8N.md`.
- **Telegram assistant bot + reminders:** `docs/BOT.md`.

## 11. Security

zod on all inputs · rate limiting (Redis) · Turnstile + honeypot on booking · admin JWT cookie · CSRF-safe (SameSite + origin check on mutating admin routes) · strict security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, frame-ancestors none) · no PII in logs · IPs stored only as salted hash · secrets via env · n8n webhooks protected by shared secret headers and reachable only from the app (and callback only from n8n) · uploads: PDF only, size-capped, stored outside `public/`.

## 12. Tech stack

See `CLAUDE.md`. Node LTS, pnpm, PostgreSQL 16, Redis 7.

## 13. Performance, accessibility, SEO

- Mobile Lighthouse ≥ 90 on all four categories. Lazy-load below-the-fold sections and the game (load only when the footer approaches the viewport). Fonts via `next/font` (Manrope, Inter, JetBrains Mono; all have Cyrillic). No layout shift.
- WCAG AA contrast, keyboard navigation everywhere (including booking and the game), visible focus, ARIA labels, reduced-motion support, skip link.
- `hreflang` alternates, canonical URLs, JSON-LD `Person`, per-locale metadata, dynamic OG image, sitemap with all locales.

## 14. Definition of done

All items in `docs/QA-CHECKLIST.md` pass; `pnpm lint && pnpm typecheck && pnpm test && pnpm build` are green; a real end-to-end booking creates a Calendar event with a Meet link, a Sheets row and a Telegram message; the bot sends the 60- and 15-minute meeting briefs; the resume can be replaced from admin; a fresh `docker compose up` on the VPS brings everything up.
