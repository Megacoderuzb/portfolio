import type { Breakout, Brick, GameEvent } from "./engine";
import type { Shape } from "./levels";

// Canvas drawing for the breakout. Colors come only from the design tokens (CSS variables, read once).
// Particles, score pops and the ball trail live in fixed pools: drawing a frame allocates nothing.

export type Palette = Record<"text" | "v300" | "v400" | "v500" | "v600" | "v700" | "v800" | "v900" | "glow", string>;

/** Reads the palette from design/tokens.css (:root variables). */
export function readPalette(el: Element = document.documentElement): Palette {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    text: v("--text"),
    v300: v("--violet-300"),
    v400: v("--violet-400"),
    v500: v("--violet-500"),
    v600: v("--violet-600"),
    v700: v("--violet-700"),
    v800: v("--violet-800"),
    v900: v("--violet-900"),
    glow: v("--glow"),
  };
}

const PARTICLES = 120;
const PARTICLES_PER_BREAK = 8; // ≤ 10 per brick (docs/GAME.md)
const PARTICLE_LIFE = 0.55;
const POPS = 12;
const POP_LIFE = 0.7;
const TRAIL = 10;
const SHAKE = 0.25;
const GLOW_SPREAD = [7, 3]; // px around the paddle
const POP_TEXT: Record<number, string> = { 10: "+10", 25: "+25", 100: "+100" };

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };
type Pop = { x: number; y: number; life: number; text: string };

export class Renderer {
  private readonly particles: Particle[] = Array.from({ length: PARTICLES }, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    color: "",
    size: 0,
  }));
  private readonly pops: Pop[] = Array.from({ length: POPS }, () => ({ x: 0, y: 0, life: 0, text: "" }));
  private readonly trail = new Float32Array(TRAIL * 2);
  private trailLength = 0;
  private trailHead = 0;
  private shake = 0;
  private paddleFill: CanvasGradient | null = null;
  private paddleFillWidth = 0;
  private readonly shades: string[];

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly colors: Palette,
    private readonly reducedMotion: boolean,
  ) {
    this.shades = [colors.v300, colors.v400, colors.v500, colors.v600, colors.v700];
  }

  /** Context state that a canvas resize wipes: call after every width/height change. */
  reset(dpr: number) {
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
    this.ctx.textAlign = "center";
  }

  /** True while effects are still animating (the component keeps the loop running for them). */
  get busy() {
    if (this.shake > 0) return true;
    for (const q of this.particles) if (q.life > 0) return true;
    for (const s of this.pops) if (s.life > 0) return true;
    return false;
  }

  /** Turns engine events into effects. Call for each event before the engine's eventCount is reset. */
  onEvent(e: GameEvent, game: Breakout) {
    if (e.type === "break" || e.type === "hit") {
      this.pop(e.x, e.y, e.points);
      if (e.type === "break" && !this.reducedMotion) this.burst(e.x, e.y, this.brickColor(game.bricks[e.brick]));
    } else if (e.type === "level" || e.type === "win") {
      this.pop(game.width / 2, game.height / 2, e.points);
    } else if (e.type === "life" || e.type === "lose") {
      if (!this.reducedMotion) this.shake = SHAKE;
      this.trailLength = 0;
    }
  }

  draw(game: Breakout, dt: number) {
    const { ctx, colors } = this;
    ctx.clearRect(0, 0, game.width, game.height);
    ctx.save();
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const amount = (this.shake / SHAKE) * 4;
      ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
    }

    // bricks: violet shades per row; 2-hit bricks darker with a light outline
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = colors.v300;
    for (const k of game.bricks) {
      if (!k.alive) continue;
      shapePath(ctx, k.shape, k.x, k.y, k.w, k.h);
      ctx.fillStyle = this.brickColor(k);
      ctx.fill();
      if (k.maxHp > 1) ctx.stroke();
    }

    // paddle: violet-500 → violet-300 with a glow
    const p = game.paddle;
    if (!this.paddleFill || this.paddleFillWidth !== p.w) {
      this.paddleFill = ctx.createLinearGradient(0, 0, p.w, 0);
      this.paddleFill.addColorStop(0, colors.v500);
      this.paddleFill.addColorStop(1, colors.v300);
      this.paddleFillWidth = p.w;
    }
    // glow = two translucent halos (shadowBlur is slow on canvases without a GPU)
    ctx.fillStyle = colors.glow;
    for (const spread of GLOW_SPREAD) {
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.roundRect(p.x - spread, p.y - spread, p.w + spread * 2, p.h + spread * 2, p.h / 2 + spread);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = this.paddleFill;
    ctx.beginPath();
    ctx.roundRect(0, 0, p.w, p.h, p.h / 2);
    ctx.fill();
    ctx.restore();

    // ball + violet trail
    const b = game.ball;
    if (game.phase === "playing") this.pushTrail(b.x, b.y);
    else if (game.phase !== "paused") this.trailLength = 0;
    ctx.fillStyle = colors.v400;
    for (let i = 0; i < this.trailLength; i++) {
      const at = ((this.trailHead - 1 - i + TRAIL) % TRAIL) * 2;
      const fade = 1 - (i + 1) / (this.trailLength + 1);
      ctx.globalAlpha = fade * 0.45;
      ctx.beginPath();
      ctx.arc(this.trail[at], this.trail[at + 1], b.r * (0.4 + 0.6 * fade), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = colors.glow;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.text;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();

    // particles
    for (const q of this.particles) {
      if (q.life <= 0) continue;
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 420 * dt;
      ctx.globalAlpha = Math.max(0, q.life / PARTICLE_LIFE);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x, q.y, q.size, q.size);
    }

    // score pops (float up, fade; no movement under reduced motion). The font is set in reset(), not here:
    // assigning ctx.font resolves styles and forced a reflow every frame after a HUD update.
    ctx.fillStyle = colors.v300;
    for (const s of this.pops) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (!this.reducedMotion) s.y -= 28 * dt;
      ctx.globalAlpha = Math.max(0, s.life / POP_LIFE);
      ctx.fillText(s.text, s.x, s.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private brickColor(k: Brick) {
    if (k.maxHp > 1) return k.hp > 1 ? this.colors.v900 : this.colors.v800;
    return this.shades[k.row % this.shades.length];
  }

  private pushTrail(x: number, y: number) {
    this.trail[this.trailHead * 2] = x;
    this.trail[this.trailHead * 2 + 1] = y;
    this.trailHead = (this.trailHead + 1) % TRAIL;
    this.trailLength = Math.min(TRAIL, this.trailLength + 1);
  }

  private burst(x: number, y: number, color: string) {
    let spawned = 0;
    for (const q of this.particles) {
      if (spawned === PARTICLES_PER_BREAK) break;
      if (q.life > 0) continue;
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 120;
      q.x = x;
      q.y = y;
      q.vx = Math.cos(angle) * speed;
      q.vy = Math.sin(angle) * speed - 60;
      q.life = PARTICLE_LIFE * (0.6 + Math.random() * 0.4);
      q.color = color;
      q.size = 2 + Math.random() * 2;
      spawned++;
    }
  }

  private pop(x: number, y: number, points: number) {
    let slot = this.pops[0];
    for (const s of this.pops) if (s.life <= 0) slot = s;
    slot.x = x;
    slot.y = y;
    slot.life = POP_LIFE;
    slot.text = POP_TEXT[points] ?? "";
  }
}

/** Path for a brick shape inside its bounding box (all shapes share the box size). */
function shapePath(ctx: CanvasRenderingContext2D, shape: Shape, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  switch (shape) {
    case "rect":
      ctx.roundRect(x, y, w, h, Math.min(6, h / 3));
      break;
    case "triangle":
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      break;
    case "diamond":
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
      break;
    case "hexagon": {
      const inset = Math.min(w * 0.25, h * 0.5);
      ctx.moveTo(x + inset, y);
      ctx.lineTo(x + w - inset, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w - inset, y + h);
      ctx.lineTo(x + inset, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
      break;
    }
    case "circle":
      ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
      break;
  }
}
