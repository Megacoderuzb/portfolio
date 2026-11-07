# Phase 08 — Polish: SEO, accessibility, performance, security, tests

Prerequisite: phases 00–07 done and committed.

---

Read `CLAUDE.md`, `docs/SPEC.md` §11, §13, `docs/QA-CHECKLIST.md`.

## Tasks

1. **SEO:** per-locale metadata (title, description, canonical), `hreflang` alternates (+ `x-default` → `uz`), `sitemap.ts` (all locales, no admin/manage pages), `robots.ts` (disallow `/admin`, `/api`, `/*/booking/`), JSON-LD `Person` (name, jobTitle, url, sameAs: LinkedIn/GitHub/Telegram, knowsAbout), dynamic `opengraph-image.tsx` per locale (violet/black, name + role + "Free consultation"; no photo), Twitter card tags.
2. **Security headers** in `next.config`/middleware: CSP (allow Cloudflare Turnstile and nothing else external; fonts self-hosted via `next/font`), `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (deny camera/mic/geolocation), `frame-ancestors 'none'`, HSTS (production). Verify the site and admin work under the CSP; Turnstile still loads.
3. **Accessibility:** keyboard-only pass over every flow (nav, drawer, booking stepper/slot grid, dialogs, admin, game); correct headings order; landmarks; labels; error summaries; focus management after step changes and dialogs; contrast AA; reduced-motion fidelity. Run `axe` (e.g. via `@axe-core/playwright`, dev dependency) on key pages in all three locales and fix findings.
4. **Performance:** Lighthouse mobile ≥ 90 on all four categories for `/uz`, `/ru`, `/en`. Check: font loading, image/OG sizes, bundle analysis (Motion via `LazyMotion`, game lazy-loaded), `next/dynamic` for below-the-fold interactive parts, no layout shift, efficient background animations (transform/opacity only, `will-change` sparingly), cache headers for static assets.
5. **Error & empty states:** localized `not-found.tsx`, `error.tsx`, `global-error.tsx`, loading skeletons, offline-friendly booking errors.
6. **Observability:** structured JSON logger without PII; request ids for API errors; `/api/health` complete (db, redis, worker heartbeat).
7. **Tests:** add Playwright smoke tests (dev dependency): landing renders in 3 locales, language switch, booking flow with mocked availability, admin login redirect, resume 404/200, game mounts lazily. Keep them runnable in CI (`pnpm test:e2e`). Add a GitHub Actions workflow `.github/workflows/ci.yml` running lint, typecheck, unit tests, build (and e2e if practical) with Postgres/Redis services.
8. **Content pass:** read all three message files and seeded content aloud-style for tone, typos, consistency of the name spelling "Muhammadjon Abduvakhobov", correct links; list anything the owner must verify.

## Acceptance criteria

- `docs/QA-CHECKLIST.md` sections *Content & i18n*, *Design & motion*, *SEO, a11y, performance, security* all pass (tick them in the final report).
- Lint/typecheck/unit/e2e/build pass in CI.

## Final report

Lighthouse scores per locale, axe results, any remaining known issues with severity.
