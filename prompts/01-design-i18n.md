# Phase 01 — Design system, i18n, layout, motion foundation

Prerequisite: phase 00 done and committed.

---

Read `CLAUDE.md`, `docs/DESIGN.md`, `design/tokens.css`, and `messages/*.json`. This is phase 01 of 10: build the design system, the three-language routing and the global layout. Do not build the page sections yet (phase 02).

## Tasks

1. **Tokens:** integrate `design/tokens.css` into the global stylesheet (Tailwind config per installed version). Only palette tokens may be used anywhere in the app.
2. **Fonts:** `next/font` for Manrope (headings), Inter (body), JetBrains Mono (mono), subsets `latin`, `latin-ext`, `cyrillic`; expose as CSS variables; `display: swap`.
3. **i18n:** next-intl with locales `uz` (default), `ru`, `en`; routes under `src/app/[locale]`; copy `messages/*.json` into `src/messages/`; typed message keys if practical. Middleware: locale negotiation (cookie → `Accept-Language` clear preference for ru/en → default uz); **exclude** `/admin`, `/api`, `/_next`, static files, `sitemap.xml`, `robots.txt`. Language switcher component preserving the current section hash and remembering the choice in a cookie.
4. **Layout:** root `[locale]/layout.tsx` with `<html lang>`, metadata from messages, skip-link ("skip to content"), sticky glass **Navbar** (MA monogram logo, section links, language switcher, "Book a free call" button; mobile drawer), background layers (grid + drifting violet gradients + grain, per `DESIGN.md`), scroll-progress bar, desktop-only cursor glow.
5. **UI primitives** in `src/components/ui`: `Button` (primary/secondary/ghost, sizes, loading), `Card`, `Chip`, `Container`, `SectionHeading`, `Drawer`, `Dialog`, `Tabs`, form controls (`Field`, `Input`, `Textarea`, `Select`, error state), `Stepper`, `Toast`, `Skeleton`, `Marquee`, `GlowBorder`, `Monogram`. Accessible by default (focus rings, ARIA, keyboard).
6. **Motion foundation:** `src/lib/motion.ts` with shared easing/variants and a `Reveal` wrapper; wrap the app in `LazyMotion` (`domAnimation`) and use `m.*` components. All motion must degrade under `prefers-reduced-motion` (opacity-only, ≤ 200 ms).
7. **Style guide page** (dev only, `/[locale]/_dev/ui`, excluded from sitemap and disabled in production) showing every primitive and the palette, for visual checking.
8. **Tests:** a unit test that every key in `uz.json` exists in `ru.json` and `en.json` (and vice versa).

## Rules

- Purple + black only; no photo of the owner; no prices; no hardcoded UI text (everything from messages).
- Keep Client Components minimal; Navbar interactive parts only.

## Acceptance criteria

- `/uz`, `/ru`, `/en` render the layout; switching language works; Uzbek apostrophes and Cyrillic render correctly.
- Lint, typecheck, tests, build pass. Lighthouse accessibility ≥ 95 on the placeholder page.

## Final report

Short list of what was built, decisions taken, and screenshots/notes on anything visual the owner should review.
