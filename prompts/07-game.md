# Phase 07 — Footer breakout game

Prerequisite: phases 00–02 done (footer exists). Independent of phases 03–06.

---

Read `CLAUDE.md`, `docs/GAME.md` (full), `docs/DESIGN.md` (colors, motion), `messages/*.json` (`footer.game.*`).

## Tasks

1. **Engine** `src/components/game/engine.ts`: pure TypeScript, no DOM. State, `update(dt)`, fixed-timestep physics with sub-stepping, ball vs paddle (angle by hit offset, max ±60°), ball vs bricks (rounded-rect/triangle/diamond/hexagon via inset bounding box, circle via circle-circle), one brick per sub-step, 2-hit bricks, speed ramp (+3% per 5 hits, cap 1.6×), lives, levels, score rules, win/lose states.
2. **Levels** `levels.ts`: level 1 mixed-shape grid; level 2 diamond/pyramid with some 2-hit bricks; level 3 spells **MA** with a few 2-hit bricks. All three must be solvable and fit the canvas at 280–320 px height.
3. **Renderer** `render.ts`: draws paddle (violet gradient + glow), ball + trail, shapes in violet shades, particles from an object pool, score pops; colors read once from CSS variables in `design/tokens.css` — **no off-palette colors**. Reduced motion: no particles/shake, ball speed −20%.
4. **Component** `Breakout.tsx` (client): canvas with DPR scaling and `ResizeObserver`; mouse, touch-drag (`touch-action: pan-y`, horizontal movement only, never block vertical scroll), keyboard (←/→, A/D, Space, P/Esc); HUD (score, best, lives, level) using messages; pause when < 20% visible or tab hidden; start/pause/restart buttons; win card with CTA **Book a free call** (scroll to `#booking`, record `GAME_WIN`); game-over card; best score in `localStorage` (`ma_breakout_best`, try/catch). Accessibility: focusable canvas with `aria-label`, `aria-live="polite"` announcements, a "Skip game" link before it.
5. **Lazy loading:** `next/dynamic` (`ssr:false`) mounted via IntersectionObserver when the footer is within ~600 px of the viewport; render a skeleton of the same size to avoid layout shift.
6. **Footer integration:** title/hint from messages, the game centered with max width 960, entrance animation per `DESIGN.md` (footer rises, canvas fades in last).
7. **Tests:** Vitest for `engine.ts` — wall bounce, paddle angle, brick removal, 2-hit brick, life loss and re-attach, level clear, win, no tunneling at max speed (property-style test over many random trajectories).

## Rules

Palette only · no sound · no allocations in the frame loop · no layout shift · keep the game bundle out of the initial JS.

## Acceptance criteria

- Playable and fun with mouse, touch and keyboard; page scrolling on mobile unaffected.
- Game code is not downloaded until the footer approaches (verify in the network panel).
- Lint/typecheck/tests/build pass; stable 60 fps on a mid-range phone profile.

## Final report

Short notes on tuning knobs (speeds, rows, lives) the owner can tweak, and anything visual to review.
