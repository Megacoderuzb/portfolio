# Phase 03 — Database, seed, admin panel, resume, analytics events

Prerequisite: phases 00–02 done and committed. `docker compose -f docker-compose.dev.yml up -d db redis` must be running.

---

Read `CLAUDE.md`, `docs/SPEC.md` §6, §7, §8, §11, `prisma/schema.prisma`, `seed/seed-data.json`.

## Tasks

1. **Migrations:** create and apply the initial migration. Add the raw SQL **exclusion constraint** on `Booking` from the schema comments in a follow-up migration. Verify it with an SQL test (two overlapping non-cancelled bookings fail with `23P01`; a cancelled one doesn't block).
2. **Seed (`seed/seed.ts`, `pnpm seed`):** read `seed/seed-data.json`; upsert **by slug**, **create only missing** rows, never overwrite rows edited in admin (compare `updatedAt > createdAt` or a `--force` flag to override). Seed the default `Setting` rows (`availability`, `contacts`). Link projects ↔ services via slugs. Include the uz/ru/en content produced in phase 02 (move it into the seed so the DB owns it). Idempotent: run twice with no changes.
3. **Switch the content data layer** from seed JSON to Prisma (`src/lib/content`), keeping component code unchanged. Cache with Next's data cache and revalidate (`revalidateTag`) when admin saves.
4. **Admin auth:** `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` (bcrypt); login page at `/admin/login`; session JWT (jose) in an httpOnly, Secure (in production), SameSite=Lax cookie, 12 h expiry; logout; Redis-backed login rate limit (5 attempts / 15 min / IP); middleware protecting `/admin/*` and `/api/admin/*`; origin check on mutating admin requests. Provide `scripts/hash-password.ts` to generate the hash.
5. **Admin UI** (`/admin`, English UI is fine, same design system, not indexed — `noindex`, excluded from sitemap): 
   - **Dashboard:** counters (bookings, resume downloads, last 30 days), service-interest bar list, purpose split, upcoming bookings (empty until phase 04).
   - **Projects:** list, create/edit with per-locale tabs (uz/ru/en: type, summary, highlights), stack chips, linked services, visible toggle, status, reorder (drag or up/down). 
   - **Services:** same pattern, plus interest count from `AnalyticsEvent`.
   - **Resume:** upload PDF (≤ 5 MB; validate MIME **and** `%PDF-` magic bytes; random stored filename in `RESUME_DIR`, outside `public/`), set active, keep the last 5 versions, show download count.
   - **Settings:** contact links (email, Telegram, LinkedIn, GitHub).
   - (Availability and Bookings pages are added in phase 04.)
6. **Resume download:** `GET /api/resume` streams the active PDF as an attachment named `Muhammadjon-Abduvakhobov-CV.pdf`, records `RESUME_DOWNLOAD`, never reveals the storage path; 404 with a friendly message when none is active. Wire the Contacts/Hero buttons and "updated {date}".
7. **Events:** `src/lib/events` server helper + `POST /api/events` for the public whitelist (`SERVICE_CLICK`, `PROJECT_CLICK`, `CONTACT_CLICK`, `GAME_WIN`), zod-validated, rate limited; replace the `track()` stub with a real client helper using `navigator.sendBeacon`/`fetch keepalive`.
8. **Tests:** seed idempotency, auth (valid/invalid login, rate limit), resume upload validation, events whitelist.

## Rules

Single owner only · secrets from env · PDF-only uploads · no PII in logs · all admin mutations validated with zod.

## Acceptance criteria

- Fresh DB → migrate → seed → site shows seeded visible projects/services; owner can add a new project in admin and it appears on the site in all languages (fallback to `en` when a locale is missing).
- Replacing the resume in admin changes `/api/resume` immediately; non-PDFs are rejected.
- `/admin` is unreachable without login. Lint/typecheck/tests/build pass.

## Final report

What changed, how to create the admin hash, and the manual steps (set env values, upload the Full-Stack resume PDF).
