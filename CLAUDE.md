# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

You are building a personal portfolio website for **Muhammadjon Abduvakhobov**, a Full-Stack Developer (NestJS, Next.js, TypeScript) based in Tashkent, Uzbekistan. Read `docs/SPEC.md` before any phase. Other docs are referenced by each prompt in `prompts/`.

## How this repo is built

- The repo starts as a **kit** (docs, prompts, schema, seed, messages, tokens, Docker/Nginx) with no app code. The app is built in 10 ordered phases: `prompts/00-scaffold.md` … `prompts/09-deploy.md`. One prompt = one phase; don't start work belonging to a later phase. Check which phase is done by what exists in `src/`, `worker/`, `prisma/migrations/`.
- Never overwrite or delete kit files when scaffolding.
- Sources of truth: `docs/SPEC.md` (product + API), `prisma/schema.prisma` (data model), `docs/DESIGN.md` + `design/tokens.css` (visuals/motion), `docs/BOOKING-N8N.md` (app ↔ n8n contracts), `docs/BOT.md` (bot commands + date grammar), `docs/GAME.md` (footer breakout game), `docs/MEETING-QUESTIONS.md` (static brief questions), `docs/QA-CHECKLIST.md` (definition of done).
- `prisma/schema.prisma` was written for Prisma 5/6 and never validated against an engine: run `prisma validate` before relying on it and adapt to the installed Prisma version (v7+ moves the datasource URL to `prisma.config.ts`).
- `README.md` (Uzbek) lists the owner's manual steps (BotFather token, Google Cloud OAuth in **production** mode, Sheets ID, Turnstile keys, DNS, resume PDF). Mention them in phase reports; you can't do them.

## What the site is for

- Audience: **HR / recruiters and networking contacts**, plus people who need a one-off freelancer.
- Main conversion: booking a **free 30-minute Google Meet consultation**. Secondary: resume download, contact clicks.
- Every service card has a "book" button; the chosen service is recorded so the owner knows what the visitor is interested in.

## Hard rules (never violate)

1. **Full-stack Next.js** (App Router, TypeScript strict). The only extra process is `worker/` (BullMQ jobs + Telegram bot) and the self-hosted **n8n** container.
2. **No paid services** beyond the VPS and the domain. No AI APIs, no email provider (Google Calendar invites email the visitor), no paid analytics, no payment gateway.
3. **Languages:** `uz` (default), `ru`, `en` via next-intl. Every user-facing string exists in all three. Never hardcode UI text.
4. **Palette: purple + black only** (`design/tokens.css`). Functional error/success states may use a muted red/green, nowhere else.
5. **Never use a photo of the owner.** Use the "MA" monogram and abstract/graphic visuals.
6. **No prices anywhere.**
7. Owner's timezone is **Asia/Tashkent (UTC+5, no DST)**. Store all instants in UTC (`timestamptz`). Display in the visitor's timezone on booking UI.
8. Secrets only in env vars. Validate env with zod at startup. Never log secrets or personal data.
9. Admin is single-user (owner). Public API must validate every input with zod and be rate limited.
10. Respect `prefers-reduced-motion`. Keep Lighthouse (mobile) ≥ 90 for Performance/Accessibility/SEO/Best Practices.

## Stack

Next.js (latest stable, App Router) · React · TypeScript strict · Tailwind CSS · `motion` / Framer Motion (use `LazyMotion` + `m` components to keep the bundle small) · next-intl · Prisma + PostgreSQL · Redis + BullMQ · grammY (Telegram) · Luxon (time) · zod · jose (admin session) · bcryptjs · rate-limiter-flexible · Vitest · pnpm · Docker · Nginx.

If a library's current API differs from what the docs here assume (Prisma 7 config file, Tailwind v4 CSS config, next-intl version), **follow the installed version's documentation** and keep the intent.

Installed versions differ from older docs/prompts:
- **Next 16.4** (Turbopack, `cacheComponents: true`): `middleware.ts` is now `proxy.ts`. Read the bundled docs in `node_modules/next/dist/docs/` before using a Next API (see `AGENTS.md`).
- **Prisma 7.10**: the connection URL is in `prisma.config.ts`, not the schema. Import the client from `@/generated/prisma/client`, and use the singleton `db` from `@/lib/db` (connects through `@prisma/adapter-pg`).
- **Env:** call `serverEnv()` / `publicEnv()` from `@/lib/env`. They are lazy so `next build` works without `.env`. Owner-provided secrets may be blank in dev but are required when `NODE_ENV=production`. The worker uses `workerEnv()` from `worker/lib/env.ts`, a subset of the same schema.

## Folder structure

```
src/
  app/
    [locale]/               public site (uz | ru | en)
      page.tsx              landing (all sections)
      booking/[token]/      manage / cancel a booking
    admin/                  NOT locale-prefixed; protected by middleware
    api/                    route handlers (availability, bookings, resume, n8n callbacks, health)
    sitemap.ts robots.ts opengraph-image.tsx
  components/{ui,layout,sections,booking,game,admin}/   layout = navbar, footer, background, providers
  lib/{db,env,auth,time,booking,queue,n8n,events,i18n}/
  messages/                 uz.json ru.json en.json (copied from kit)
  proxy.ts                  (Next 16 name for middleware.ts) next-intl for public routes; auth guard for /admin; excludes /api, /_next, files
  instrumentation.ts        validates env at server start
  generated/prisma/         generated Prisma client (gitignored; `pnpm install` regenerates it)
worker/
  index.ts                  starts BullMQ workers + Telegram bot (long polling)
  bot/ jobs/ lib/
n8n/workflows/              exported workflow JSON files
prisma/ schema.prisma  migrations/
seed/ seed-data.json  seed.ts
tests/                      Vitest (unit tests for time/slots, bot parser, game engine)
```

## Architecture (cross-cutting flows)

Three runtime processes share one Postgres + Redis: **app** (Next.js), **worker** (BullMQ + grammY), **n8n** (Google Calendar/Meet, Sheets, owner Telegram notifications).

**Booking lifecycle** (`docs/BOOKING-N8N.md`):
1. `POST /api/bookings` → zod + Turnstile + honeypot + Redis rate limit → re-run slot validation server-side → insert `Booking(status=PENDING_MEET)` in a transaction → enqueue BullMQ `dispatch-booking`.
2. Worker POSTs `{N8N_BASE_URL}/webhook/booking-created` with `X-Webhook-Secret` (5 attempts, exponential backoff; Telegram alert to owner on final failure).
3. n8n creates the Calendar event with Meet + visitor as attendee (the invite *is* the visitor's confirmation email), then calls `POST /api/n8n/booking-confirmed` with `X-Callback-Secret`.
4. App sets `CONFIRMED`, stores `meetUrl`/`calendarEventId`, schedules 60- and 15-minute brief reminders. The visitor page polls `GET /api/bookings/{token}`.
- n8n callbacks must be idempotent and compare secrets in constant time. Stuck bookings stay `PENDING_MEET`; admin has a Retry button.
- Cancel → `CANCELLED` → `booking-cancelled` webhook (n8n deletes the event, updates the Sheet row) and the booking's brief jobs are removed.

**Double booking:** slot math in `src/lib/booking` is pure (Luxon, owner zone passed explicitly; containers set `TZ=Asia/Tashkent` but dev machines may not). The final guard is a Postgres **exclusion constraint** on `tstzrange(startsAt, endsAt)` for non-cancelled rows. Prisma can't express it: add it as raw SQL in a migration (SQL is in the schema comments). Map Postgres error `23P01` to HTTP 409 `slot_taken`.

**Worker / Telegram:**
- Run exactly **one** worker replica: the bot uses long polling, and two pollers conflict. For the same reason, n8n may only *send* Telegram messages and must never use a Telegram Trigger on this bot token.
- Postgres (`Reminder`, `Task`) is the source of truth. BullMQ delayed jobs use deterministic `jobId = reminder:{id}:{remindAt}`. On start, the worker re-enqueues every `PENDING` reminder, so Redis loss loses nothing.
- Worker writes Redis key `worker:heartbeat` every 30 s; `/api/health` reports `{ ok, db, redis }` + heartbeat.

**i18n scope:** public site only (`/[locale]`, next-intl). `/admin` is not localized. The bot, owner Telegram messages and meeting briefs are Uzbek (Latin) only. After phase 01, the app reads `src/messages/*.json` (copied from root `messages/`). A test enforces identical key sets across uz/ru/en.

**Content & seed:** projects/services text lives in `content` JSON keyed by locale. `pnpm seed` is idempotent and non-destructive: upsert by `slug`, create missing rows only, never overwrite admin edits unless `--force`. Machine-drafted uz/ru translations are marked for owner review.

**UI conventions:** `src/components/ui/*` primitives; links styled as buttons use `buttonStyles()`. Dialog/Drawer are native `<dialog>`. The dev style guide is `/{locale}/_dev/ui` (folder `%5Fdev`); it returns 404 in production. Add new message keys to all three `src/messages/*.json` files; `tests/messages.test.ts` checks that the keys and `{placeholders}` match.

**Content data layer:** public components get projects, services, contacts and resume data only from `src/lib/content`, through async getters plus `localize()`, which falls back to `en` field by field.
- The getters call `connection()`, so DB reads happen at request time; the Docker build has no database.
- Results are cached in memory with `"use cache"` + `cacheTag(CONTENT_TAG)`. Every admin mutation calls `updateTag(CONTENT_TAG)`.
- Pages that render DB data must sit inside `<Suspense>` (cacheComponents rule).
- `getOwner()` is static (no DB), so prerendered layout parts like the footer can use it.
- Admin data access and zod input schemas live in `src/lib/content/admin.ts`.
- `seed/seed.ts` seeds from `seed/seed-data.json` (English) + `seed/translations.json` (uz/ru, `"_review": true` = machine-drafted). It only creates missing rows; `--force` overwrites.

**Admin & auth:**
- `src/proxy.ts` guards `/admin/*` and `/api/admin/*` with a jose JWT cookie (`admin_session`, 12 h). It also rejects mutating admin requests whose `Origin` host ≠ `Host`.
- Every Server Action in `src/app/admin/(panel)/actions.ts` calls `requireAdmin()` again and validates with zod.
- Login is rate-limited to 5 per 15 min per hashed IP (Redis, `src/lib/rate-limit.ts`).
- `ADMIN_PASSWORD_HASH` is base64 of the bcrypt hash (`pnpm hash-password`). A raw `$2b$…` gets mangled by `.env`/compose `$` expansion.
- `src/lib/db` must not call `serverEnv()` at import time: `next build` runs with `NODE_ENV=production` and no secrets.
- Admin forms use `<ActionForm>` (`useActionState`) with server-rendered fields. Uploads go through a Server Action, with a 6 MB body limit in `next.config.ts`.

**Public API:** `/api/resume` streams the active PDF from `RESUME_DIR` (random names, outside `public/`) and records `RESUME_DOWNLOAD`. `/api/events` accepts only the whitelist in `src/lib/events/public.ts`. Both are rate-limited per hashed IP. In the browser, `track()` uses sendBeacon. Server-rendered links opt in with `data-track="CONTACT_CLICK" data-channel="…"`, caught by one listener in `<Providers>`.

**Booking (phase 04):**
- Pure slot math lives in `src/lib/booking/slots.ts`; DB flows in `src/lib/booking/index.ts`; admin in `admin.ts`.
- `createBooking` re-runs the slot rules, then does a plain atomic INSERT. The `booking_no_overlap` constraint is the guard; `isOverlapViolation` reads `meta.driverAdapterError.cause.originalCode === "23P01"`. There is no interactive transaction: those failed to start under parallel load.
- Jobs go through `src/lib/queue` (BullMQ queue `booking`: `dispatch-booking`, `cancel-booking`). `src/lib/queue/jobs.ts` has no app imports, so the worker can share it.
- The client never uses Luxon (Intl only). The language switcher reads `window.location` on click instead of `usePathname()`, which would break prerendering of dynamic routes.

**n8n (phase 05):**
- `worker/jobs/dispatch-booking.ts` consumes the `booking` queue.
  - `dispatch-booking` is skipped unless the booking is still `PENDING_MEET`.
  - Retries use custom backoff (`dispatchBackoff`: 10 s, 30 s, 2 min, 10 min). A 4xx other than 408/429 throws `UnrecoverableError`.
  - On final failure, the owner gets an alert via the plain Bot API (`worker/lib/telegram.ts`).
- App side: `src/lib/n8n`, covering the constant-time secret check, the idempotent `confirmBooking`, and `scheduleBriefs`/`cancelBriefs`.
- Workflow JSONs in `n8n/workflows/` call Calendar through an HTTP Request node, which creates the Meet link and the invite (`sendUpdates=all`).
  - Secrets live only in n8n credentials (looked up by name), never in the JSON.
  - A Config node holds `appUrl`/`sheetId`/`ownerTelegramId`.
  - Setup is in `docs/N8N-SETUP.md`.
- Tests use `scripts/mock-n8n.ts`; `pnpm test:dispatch [--mock]` posts a sample booking.

**Bot, reminders, briefs (phase 06):**
- `worker/index.ts` runs everything in **one** process, and there must be exactly one replica: the bot long-polls.
  - It runs the booking worker, the heartbeat (`worker:heartbeat`, 30 s, read by `/api/health`) and the grammY bot.
  - It also runs the `reminders` worker, the restore sweep, and the digest schedulers.
  - Without `TELEGRAM_BOT_TOKEN`/`OWNER_TELEGRAM_ID`, the bot, reminders and digests stay off (warning only).
- Parsing: `worker/bot/parse.ts` is a pure grammar plus `nextOccurrence`.
- Bot UI: `worker/bot/ui.ts` holds all texts and keyboards (plain text, no `parse_mode`). `worker/bot/index.ts` holds the handlers, the in-memory quick-add drafts and `ownerGuard`.
- Data: `worker/lib/reminders.ts` handles tasks, reminders and the `Setting` key `bot`.
- Queue jobs (`src/lib/queue/jobs.ts`):
  - `deliver` has `{reminderId, at}` and id `reminder:{id}:{ms}`; a job whose `at` ≠ the row's `remindAt` is stale.
  - `repeat` has id `repeat:{id}:{sentAt}`. It is the single gentle repeat, which ✅/⏰ remove.
  - `digest` runs from job schedulers.
  - Reminder jobs are removed when finished, so the ids free up. The worker re-enqueues every `PENDING` row at start and every 10 min.
- Message order: send first, then update the row. A retry may duplicate a message, but nothing is lost.
- Recurring rows advance `remindAt` after each send. Snoozing a recurring reminder creates a one-off copy.
- Briefs (`brief60`/`brief15` rows) are sent only for `CONFIRMED` bookings that have not started yet, and only if enabled in `/settings`. The questions come from `worker/lib/meeting-questions.ts`.
- Logs use `errorLabel()`, never error messages: Prisma messages can echo personal data.
- Tests: `tests/bot.test.ts` drives the real bot through `bot.handleUpdate` with a fake API transformer, so no token is needed. Test rows use 2099 dates, so a running dev worker never delivers them.

**Footer game (phase 07):** files are kebab-case in `src/components/game/`.
- `engine.ts`: a pure `Breakout` class.
  - Fixed 1/120 s steps, split into sub-steps of at most half the ball radius. It resolves one brick per sub-step.
  - Events go into a preallocated pool. Every level's bricks are preallocated, so `update()` never allocates.
  - The tuning knobs sit at the top of the file.
- `levels.ts`: string maps.
- `render.ts`: `Renderer`.
  - The palette is read once from CSS variables. Particles, pops and the trail use pools.
  - No `shadowBlur`: it is slow without a GPU, so glow is drawn as translucent halos.
  - `ctx.font` is set only in `reset()`. Setting it per frame forced a reflow on every frame after HUD updates.
- `breakout.tsx`:
  - React state changes only on game events, never per frame.
  - The rAF loop sleeps when nothing moves.
  - The pointer x uses a cached canvas left edge, because `getBoundingClientRect` per move forced reflows.
- `game-mount.tsx`: an IntersectionObserver with `rootMargin: 600px` triggers `next/dynamic` (`ssr:false`). The static skeleton shares `HUD_CLASS`/`FRAME_CLASS`, so there is no layout shift and no pulse animation.
- `tests/engine.test.ts` includes an aiming autopilot that wins all levels at 320–960 px. A plain `sin()` paddle offset can lock into a periodic orbit.

**Polish (phase 08):**
- **Metadata must stay static.** Runtime data in `generateMetadata` (`connection()`, `headers()`) makes Next stream title/description/canonical/og after `</head>`. Lighthouse and non-JS crawlers then miss them (measured: SEO 91 → 100 when reverted).
  - The public origin is therefore baked in at build from `APP_URL`. The Dockerfile requires it as `ARG APP_URL`, and compose passes it.
  - `sitemap.ts` and `robots.ts` are route handlers and use `connection()`, so they read the runtime value.
  - For e2e locally, build with `APP_URL=http://localhost:3100`. The SEO test only checks paths and one consistent origin.
- **Headers:** CSP, nosniff, referrer policy, permissions policy, X-Frame-Options and HSTS (prod) live in `next.config.ts`. Turnstile is the only external origin.
  - `script-src` keeps `'unsafe-inline'`: a nonce would make every page dynamic.
  - Dev adds `unsafe-eval` and `ws:`.
- **Errors:** `[locale]/not-found.tsx` (reached through `[...rest]`), `[locale]/error.tsx` and `global-error.tsx`.
  - `global-error.tsx` is the one place with fixed three-language text.
  - Strings are under `errors.*`.
- **API wrapper:** `route()` in `src/lib/api.ts` wraps every handler.
  - It adds `x-request-id` and puts `requestId` in error bodies.
  - It logs failures and slow requests through `src/lib/log.ts`: JSON lines, personal-data keys redacted, errors by class only.
  - Inside handlers use `log`, not `console`.
- **OG image:** `src/lib/og/render.tsx` reads the bundled Inter `.woff` files with `readFile`. Node's `fetch` can't open `file:` URLs, and satori can't read woff2.
- **Booking form:** the submit button prevents mouse-down focus change (`onMouseDown` preventDefault). Otherwise blur shows a validation message, the button shifts, and the first click is lost.
  - Focus moves to the new step group after each step change.
  - Motion features load async (`motion-features.ts`).
- **e2e:** `pnpm build` first, then `pnpm test:e2e`. Playwright starts `next start` on :3100 with throwaway secrets.
  - Locally it uses one worker: parallel Chrome starved on this machine and caused false timeouts.
  - It needs Postgres and Redis, migrated and seeded.
  - `.github/workflows/ci.yml` runs lint, typecheck, unit, build and e2e.

**Hosts (admin and API on their own subdomains):** one app serves `abduvaxobov.uz`, `admin.abduvaxobov.uz` and `api.abduvaxobov.uz`. Nginx forwards the Host header, and `src/lib/hosts.ts` (`hostPolicy`, pure and tested) decides which paths each host serves.
- It is opt-in: `ADMIN_URL` (runtime) and `NEXT_PUBLIC_API_URL` (**build time**, Docker `ARG`) unset means one host, as in dev, tests and CI.
- Main host: the site. `/admin` and `/api/*` return 404 there, except `/api/health`.
- `admin.` host: only `/admin` and `/api/admin`. Everything else redirects to `/admin`. The session cookie is host-only, and the CSRF check still compares Origin and Host.
- `api.` host: only the public API. `src/proxy.ts` answers the CORS preflight and allows **only** the `APP_URL` origin, with no credentials.
  - Browser code calls the API through `apiUrl()`. The CSP `connect-src` includes the API origin.
  - The analytics beacon uses `text/plain` to avoid a preflight.
- Unknown hosts (localhost, Docker-internal `app:3000` used by n8n callbacks) are unrestricted.
- Worker links (n8n `adminUrl`, Telegram alerts) use `ADMIN_URL` when set.
- Admin and API hosts get `X-Robots-Tag: noindex`.
- Verified with the three `*.localhost` hosts in a real browser: cross-origin booking, CSP and admin login all work.

**Browser checks in dev:** open `http://localhost:3100`, not `127.0.0.1`. On `127.0.0.1`, Next dev's HMR socket is rejected and client JS never hydrates.

**Local dev ports:** this machine already runs another PostgreSQL on 5432 and another project's Redis on 6379. The dev compose ports come from `DB_PORT`/`REDIS_PORT` in `.env` (currently 5435/6380). Use `127.0.0.1` rather than `localhost` in URLs.

**Animation & performance (measured in phase 02):**
- Scroll entrances are CSS, not `motion`. `<Reveal preset index>` tags an element (`data-reveal`) and one shared IntersectionObserver adds `data-shown`. Presets are in `globals.css` (one per section, per `docs/DESIGN.md`). Hidden states apply only under `@media (scripting: enabled)`, so content stays visible without JS. Presets that use `clip-path` mask an inner wrapper, because IntersectionObserver ignores fully clipped targets.
- The hero entrance and terminal typing are CSS too, so the LCP paints before hydration. Scroll progress, hero parallax and the ring use CSS scroll timelines (`animation-timeline: scroll()`).
- **No infinite animation in the first viewport.** Headless Lighthouse/PageSpeed has no GPU, so running animations repaint on the main thread. Measured: TBT went from 4.6 s to 0.09 s once they were stopped. Loop-style effects (marquee, glow pulse) start only after their `Reveal` is shown, or run a finite number of times.
- Use `motion` only for interactive UI such as the booking steps (`AnimatePresence`). Wrap just that subtree in `<LazyMotion features={domAnimation} strict>` and use `m.*`. There is no global motion provider.
- `next/font` `subsets` only controls preloading. Every subset is still declared. Preload `latin` only.

**Design tokens:** `design/tokens.css` targets Tailwind v4 `@theme` and resets Tailwind's default palette (`--color-*: initial`), so only token colors exist as utilities; the game canvas reads the same CSS variables at runtime via `getComputedStyle`, so keep `:root` variables even if the Tailwind config changes.

## Conventions

- Server Components by default; `"use client"` only where needed (animations, forms, game).
- Data access only through `src/lib/*` (no Prisma calls inside components).
- Content that is translatable (project/service text) lives in a `content` JSON column keyed by locale; fall back to `en` if a locale is missing.
- Money-free, auth-light, small: prefer simple, readable code over abstractions.
- Commit-sized work: finish the phase, run `pnpm lint && pnpm typecheck && pnpm test`, then report what changed and what the owner must do manually.
- When something in a phase prompt is ambiguous, choose the simplest option that satisfies `docs/SPEC.md` and note the decision in the final report.

## Commands (create these scripts in phase 00)

`pnpm dev` · `pnpm build` · `pnpm start` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm seed` · `pnpm db:migrate` · `pnpm db:studio` · `pnpm worker` (runs `worker/index.ts` with tsx)

```bash
docker compose -f docker-compose.dev.yml up -d   # local Postgres :5432, Redis :6379, n8n :5678 (app + worker run on host)
pnpm dev                                          # app
pnpm worker                                       # BullMQ + Telegram bot (needs TELEGRAM_BOT_TOKEN)
pnpm test tests/slots.test.ts                     # single test file (test = vitest run)
pnpm test -t "Sunday closed"                      # tests matching a name
pnpm test:e2e                                     # Playwright smoke tests (added in phase 08)

# production (VPS): app/worker images; the worker image also runs one-off tasks
docker compose run --rm worker pnpm prisma migrate deploy
docker compose run --rm worker pnpm seed
docker compose up -d
```

Definition of done for every phase: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
