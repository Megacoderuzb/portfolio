# GAME — footer breakout

A small, polished **breakout** game at the bottom of the page. The ball is a "top" (to'pcha), the platform is the "board". The player must not let the ball fall and must destroy all the shapes above. Purpose: keep visitors on the site and leave a fun last impression, then convert with a CTA.

## Visuals

- Canvas inside the footer, max width 960px, height 320px (desktop) / 280px (mobile), device-pixel-ratio aware, resizes with `ResizeObserver`.
- Colors **only** from `design/tokens.css` (read CSS variables once at init): paddle = violet-500→violet-300 gradient with glow; ball = `text` color with violet trail; bricks = violet shades; 2-hit bricks use violet-800/900 with a lighter outline.
- Brick shapes: rounded rectangle, triangle, diamond, hexagon, circle (mix them per level). Keep all shapes roughly the same bounding size.
- On break: ≤ 10 small violet particles per brick (object pool, no per-frame allocation), tiny score pop. Under `prefers-reduced-motion`: no particles, no screen shake, ball speed −20%.

## Rules

- 3 lives; ball lost below the paddle → life −1, ball re-attaches to the paddle.
- Launch: click / tap / Space. Paddle bounce angle depends on hit offset (max ±60° from vertical). Speed +3% every 5 brick hits, capped at 1.6× base.
- 3 levels (all bricks destroyed → next level). Level 1: full grid of mixed shapes. Level 2: diamond/pyramid layout with some 2-hit bricks. Level 3: bricks form the letters **MA** with a few 2-hit bricks.
- Score: +10 per hit brick, +25 per destroyed 2-hit brick, level-clear bonus +100. Best score saved in `localStorage` key `ma_breakout_best` (wrap in try/catch).
- **Win** (all levels): show "You won" card with CTA **Book a free call** (scrolls to Booking) and send `GAME_WIN` event via `/api/events`. **Game over:** "Try again" button.

## Controls

- Mouse move or touch-drag moves the paddle; keyboard ←/→ or A/D; Space = launch; P or Esc = pause.
- **Mobile scroll must keep working:** the canvas uses `touch-action: pan-y` and only reacts to horizontal pointer movement for the paddle; never `preventDefault` on vertical gestures.
- A visible "Skip game" link before the canvas jumps past it (keyboard users). Canvas is focusable with visible focus ring and an `aria-label`; score/lives/level changes announced through an `aria-live="polite"` region.
- No sound by default (optional mute-toggle UI only if sound is added later).

## Engineering

- Files: `src/components/game/Breakout.tsx` (client; mounts canvas, handles UI + a11y), `src/components/game/engine.ts` (pure logic: state, update(dt), collisions — no DOM), `src/components/game/render.ts` (canvas drawing), `src/components/game/levels.ts` (level maps).
- Load lazily: `next/dynamic` with `ssr:false`, mounted when the footer is within ~600px of the viewport (IntersectionObserver). Zero cost for visitors who never scroll down.
- Loop: `requestAnimationFrame` render + **fixed timestep** physics (1/120 s accumulator, max 5 steps per frame) with sub-stepping so the ball never tunnels through thin shapes.
- Collision: ball (circle) vs paddle (rounded rect); ball vs bricks via circle-vs-AABB for polygons (use the shape's bounding box inset ~8%), circle-vs-circle for circle bricks; reflect on the axis of the smaller penetration. Only resolve one brick per sub-step.
- Pause automatically when the canvas is < 20% visible (IntersectionObserver) or the tab is hidden (`visibilitychange`). Resume only on user action.
- Unit-test `engine.ts` with Vitest: wall bounce, paddle angle, brick removal, 2-hit brick, life loss, level clear, no tunneling at max speed.
- Memory: reuse arrays/objects; do not allocate inside the frame loop.
