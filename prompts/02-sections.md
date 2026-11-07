# Phase 02 — Landing sections and section transitions

Prerequisite: phases 00–01 done and committed.

---

Read `CLAUDE.md`, `docs/SPEC.md` §4, `docs/DESIGN.md` (hero visual + motion table), `messages/*.json`, `seed/seed-data.json`. This is phase 02 of 10: build the public landing sections. Data for projects/services comes from the database in phase 03; for now read it through a small data layer (`src/lib/content`) that can use the seed JSON as a temporary source and be switched to Prisma in phase 03 without touching components.

## Tasks

1. **Hero:** badge, name *Muhammadjon Abduvakhobov*, role, title, subtitle, two CTAs (book → `#booking`, resume → `/api/resume`), stat chips (experience "3+", live project count, core stack). Visual: animated **terminal card** (typing effect, blinking caret, final state under reduced-motion) + rotating thin ring + floating translucent shapes (hexagon/triangle/circle) with scroll parallax. **No photo.**
2. **About:** paragraph, "Open to" chips, facts (education, languages, location).
3. **Stack:** grouped technologies (Backend, Frontend, Data & queues, DevOps, Payments, Automation & AI) with a marquee; list the real stack: NestJS, Node.js, TypeScript, Next.js, React, Redux Toolkit, Tailwind, PostgreSQL, MongoDB, Redis, TypeORM, Prisma, BullMQ, RabbitMQ, Kafka, Docker, Nginx, GitHub Actions, GitLab CI/CD, Jest, Swagger/OpenAPI, Socket.io, Click, Payme, Uzum Bank, Atmos, n8n, RAG, MCP, Claude Code/Cursor/Copilot. Use monochrome violet icons or text chips (no brand colors).
4. **Projects:** cards from the data layer (`visible` only, ordered). Card: generated violet gradient cover (unique hue shift per project, initials/geometric motif), title, type, summary, stack chips, "Visit site" button when `url` exists. Click opens a **Drawer** with highlights and stack. Fire `PROJECT_CLICK` events through a no-op `track()` stub (wired in phase 03).
5. **Services:** cards (title, description, **Book** button; **no prices**). Clicking Book sets the selected service in a small client store/URL param (`?service=slug#booking`), scrolls to `#booking`, and calls `track("SERVICE_CLICK", { serviceSlug })` (stub for now). The booking section itself is built in phase 04: render a placeholder container with `id="booking"`.
6. **Contacts:** email (copy button with toast), Telegram, LinkedIn, GitHub, resume download button with "updated {date}" (placeholder until phase 03).
7. **Footer:** links, copyright, a placeholder container with `id="game"` (phase 07).
8. **Translations for seed content:** the seed text is English. Produce natural **uz** and **ru** versions for all visible seeded projects/services in the data layer, and mark each with a `// machine-drafted: owner review needed` comment (or a `"_review": true` flag in the content JSON).
9. **Section transitions:** implement the per-section entrance animations table in `docs/DESIGN.md` (each section different), using `Reveal`/presets, `viewport once`, transform/opacity/filter only, reduced-motion fallbacks.
10. **Responsive:** verify 360, 390, 768, 1024, 1440 px. No horizontal scroll.

## Rules

Purple + black only · no photo · no prices · all strings from messages (project/service text from content JSON) · Server Components by default.

## Acceptance criteria

- Landing renders in all three languages with every section and distinct transitions.
- Smooth 60 fps scrolling on a mid-range phone profile; lint/typecheck/tests/build pass.
- Lighthouse mobile ≥ 90 (Performance and Accessibility) on `/uz`.

## Final report

What was built, which seeded items are `needs_input` and hidden, and what the owner should review (translations, wording).
