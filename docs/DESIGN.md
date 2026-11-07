# DESIGN — visual system and motion

Mood: dark, confident, technical, a little playful. Think "developer console meets premium product page". Everything in violet-on-black.

## Colors (source: `design/tokens.css`)

| Token | Value | Use |
|---|---|---|
| `bg-0` | `#07070B` | page background, deepest |
| `bg-1` | `#0A0A0F` | main surface |
| `surface` | `#111018` | cards |
| `surface-2` | `#17151F` | raised / hover |
| `border` | `#26232F` | hairlines (also use `rgba(167,139,250,.16)` for glow borders) |
| `violet-300` | `#C4B5FD` | highlights, small icons |
| `violet-400` | `#A78BFA` | links, secondary accents |
| `violet-500` | `#8B5CF6` | primary accent |
| `violet-600` | `#7C3AED` | primary buttons |
| `violet-700` | `#6D28D9` | button hover/pressed |
| `violet-900` | `#3B0F7A` | deep gradients |
| `text` | `#F4F2FA` | body/headings |
| `muted` | `#A29DB5` | secondary text |
| `dim` | `#6E6A80` | tertiary/disabled |
| `glow` | `rgba(139,92,246,.35)` | shadows/halos |

Rules: only these tokens. Gradients go violet-600 → violet-400 (and to near-black). Functional states only: error `#F87171`, success `#34D399` (muted usage, never decorative). Text contrast ≥ 4.5:1.

## Typography

- Headings: **Manrope** (700/800), tight tracking (`-0.02em`).
- Body: **Inter** (400/500).
- Mono accents (labels, terminal card, chips): **JetBrains Mono**.
- Scale (clamp): h1 `clamp(2.4rem, 6vw, 4.5rem)`, h2 `clamp(1.8rem, 4vw, 3rem)`, body 1rem/1.7, small 0.875rem.
- Uzbek apostrophes (`o'`, `g'`, `'`) must render cleanly; test with real strings.

## Layout

- Max content width 1200px, 24px side padding on mobile (16px minimum), 8-point spacing grid, section vertical padding `clamp(72px, 10vw, 140px)`.
- Navbar: sticky, blurred glass, logo = "MA" monogram (violet gradient square, rounded) + links + language switcher + "Book a call" button. Collapses to a drawer on mobile.
- Cards: `surface` bg, 1px `border`, radius 20px, subtle inner top highlight, hover: lift 4px + violet glow border.
- Buttons: primary = violet-600 fill, white text, glow on hover; secondary = ghost with violet border; focus ring 2px violet-300 offset 2px.

## Background

Layered, cheap to render: (1) `bg-0`; (2) faint grid (1px lines at 4% violet, masked radially); (3) two large blurred violet radial gradients that drift slowly (CSS animation, `will-change: transform`); (4) film-grain noise (tiny tiled PNG/SVG at 3–4% opacity). No heavy canvas/WebGL on the landing.

## Hero visual (no photo)

A glass **terminal card** typing a short object (`name`, `role`, `stack`, `location`, `status: "open to work"`) with a blinking caret; behind it a rotating thin violet ring and 3–4 floating translucent shapes (hexagon, triangle, circle) that echo the footer game bricks. Parallax on scroll via `useScroll` + `useTransform`. Disable parallax and typing animation under `prefers-reduced-motion` (render final state).

## Motion system (Framer Motion / `motion`)

Use `LazyMotion` with `domAnimation` and `m.*` components. Shared presets in `src/lib/motion.ts`:

- easing `[0.22, 1, 0.36, 1]`; durations 0.5–0.8s; stagger 0.06–0.1s.
- `viewport={{ once: true, amount: 0.25 }}` on every in-view animation.
- Global: scroll progress bar (top, violet gradient), cursor glow follower (desktop pointer only), smooth anchor scroll with `scroll-margin-top` for the navbar.

### Section transitions (each section enters differently)

| Section | Enter animation |
|---|---|
| Hero | Staggered text rise + blur-to-sharp (`filter: blur(12px→0)`), terminal card slides in from right with slight rotate; orbs parallax |
| About | Text lines reveal from a clip-path mask (left→right); chips pop in with spring stagger |
| Stack | Rows slide in from alternating sides; infinite marquee afterwards (pause on hover) |
| Projects | Cards stagger up with scale 0.94→1 and clip-path "curtain" reveal; detail drawer slides from right with backdrop fade |
| Services | Cards fly in from left/right alternately with 3D tilt (`rotateY ±12°→0`); hover = mouse-tracked tilt |
| Booking | Panel scales up from 0.96 with glow pulse; steps cross-fade/slide horizontally (`AnimatePresence`, direction aware) |
| Contacts | Items rise in a staggered diagonal; icons draw (SVG `pathLength`) |
| Footer | Whole footer rises from below with a violet horizon-line sweep; game canvas fades in last |

Rules: transform/opacity/filter only (no layout-thrashing properties), no animation longer than 1s, every animation has a reduced-motion fallback (opacity-only, ≤ 200ms).

## Components to build (`src/components/ui`)

`Button`, `Card`, `Badge/Chip`, `SectionHeading` (eyebrow + title + subtitle), `Container`, `Drawer`, `Dialog`, `Tabs`, `Input/Textarea/Select/Field` (with error state), `Stepper`, `Toast`, `Skeleton`, `Marquee`, `GlowBorder`, `Reveal` (wrapper using the presets), `Monogram`.

## Iconography

Use a single set (`lucide-react`). Violet-300 default, 20–24px, stroke 1.75.

## Imagery

No photographs of people. Project cards use generated gradient covers (unique hue-shift within violet range per project, with the project initials or a simple geometric motif) unless the owner later uploads a screenshot in admin (optional `coverUrl` field in `Project.content` — add only if the owner asks).
