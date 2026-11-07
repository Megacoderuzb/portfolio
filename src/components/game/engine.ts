import { LEVELS, SHAPES, type LevelMap, type Shape } from "./levels";

// Breakout engine: pure TypeScript, no DOM. The component feeds it input and frame time; the renderer reads
// its public fields. Nothing in update() allocates: events go into a preallocated pool.

export type Phase = "idle" | "ready" | "playing" | "paused" | "won" | "lost";
export type EventType = "hit" | "break" | "paddle" | "life" | "level" | "win" | "lose";
export type GameEvent = { type: EventType; x: number; y: number; points: number; brick: number };
export type Brick = {
  col: number;
  row: number;
  shape: Shape;
  hp: number;
  maxHp: number;
  alive: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
};

// ---- tuning knobs
export const STEP = 1 / 120; // fixed physics step (s)
const MAX_STEPS = 5; // per frame; a slower frame slows the game instead of spiralling
export const LIVES = 3;
export const MAX_ANGLE = Math.PI / 3; // paddle bounce: ±60° from vertical at the paddle ends
const BASE_SPEED = 1.1; // ball speed in canvas heights per second (≈ 350 px/s at 320 px)
const REDUCED_MOTION_SPEED = 0.8;
export const SPEEDUP = 0.03; // +3% …
export const HITS_PER_SPEEDUP = 5; // … every 5 brick hits
export const MAX_SPEEDUP = 1.6;
const KEY_SPEED = 1.2; // paddle speed with the keyboard, canvas widths per second
const MIN_VERTICAL = 0.3; // |vy| ≥ 30% of the speed: no endless near-horizontal crawling
const INSET = 0.08; // polygon bricks collide with their bounding box inset by 8%
export const POINTS = { hit: 10, strongBreak: 25, levelClear: 100 };
// layout (px)
const TOP = 16;
const SIDE = 10;
const GAP = 5;
const BRICK_AREA = 0.5; // bricks use the top half of the canvas
const MAX_BRICK_ASPECT = 2.2;
const PADDLE_H = 12;
const PADDLE_BOTTOM = 28;

const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

/** Circle vs axis-aligned box. */
function touchesBox(cx: number, cy: number, r: number, x: number, y: number, w: number, h: number) {
  const dx = cx - clamp(cx, x, x + w);
  const dy = cy - clamp(cy, y, y + h);
  return dx * dx + dy * dy < r * r;
}

export class Breakout {
  phase: Phase = "idle";
  level = 0;
  score = 0;
  lives = LIVES;
  /** Brick hits since the ball was launched (drives the speed ramp). */
  hits = 0;
  remaining = 0;
  bricks: Brick[] = [];
  readonly paddle = { x: 0, y: 0, w: 0, h: PADDLE_H };
  readonly ball = { x: 0, y: 0, r: 6, vx: 0, vy: 0 };
  /** Events since the consumer last reset `eventCount` (pool reused, never reallocated). */
  readonly events: GameEvent[] = Array.from({ length: 64 }, () => ({
    type: "hit" as EventType,
    x: 0,
    y: 0,
    points: 0,
    brick: -1,
  }));
  eventCount = 0;

  private acc = 0;
  private input = 0;
  private target = Number.NaN;
  private launches = 0;
  private resumeTo: Phase = "ready";
  private readonly levels: readonly LevelMap[];
  private readonly levelBricks: Brick[][];
  private readonly speedFactor: number;

  constructor(
    public width: number,
    public height: number,
    options: { reducedMotion?: boolean; levels?: readonly LevelMap[] } = {},
  ) {
    this.levels = options.levels ?? LEVELS;
    this.levelBricks = this.levels.map(parseLevel);
    this.speedFactor = BASE_SPEED * (options.reducedMotion ? REDUCED_MOTION_SPEED : 1);
    this.loadLevel(0);
    this.resize(width, height);
    this.paddle.x = (width - this.paddle.w) / 2;
    this.attach();
  }

  /** Current ball speed (px/s): base × ramp. */
  get speed() {
    const ramp = Math.min(MAX_SPEEDUP, 1 + SPEEDUP * Math.floor(this.hits / HITS_PER_SPEEDUP));
    return this.height * this.speedFactor * ramp;
  }

  get maxSpeed() {
    return this.height * this.speedFactor * MAX_SPEEDUP;
  }

  // ------------------------------------------------------------ commands

  /** New game from level 1. */
  start() {
    this.score = 0;
    this.lives = LIVES;
    this.acc = 0;
    this.paddle.x = (this.width - this.paddle.w) / 2;
    this.loadLevel(0);
    this.phase = "ready";
  }

  launch() {
    if (this.phase !== "ready") return;
    const angle = (this.launches++ % 2 ? 1 : -1) * 0.3; // alternate a slight left / right
    this.ball.vx = this.speed * Math.sin(angle);
    this.ball.vy = -this.speed * Math.cos(angle);
    this.phase = "playing";
  }

  pause() {
    if (this.phase !== "ready" && this.phase !== "playing") return;
    this.resumeTo = this.phase;
    this.phase = "paused";
    this.input = 0;
  }

  resume() {
    if (this.phase !== "paused") return;
    this.phase = this.resumeTo;
    this.acc = 0;
  }

  /** Keyboard: -1 left, 1 right, 0 stop. */
  setInput(dir: number) {
    this.input = dir;
    if (dir) this.target = Number.NaN;
  }

  /** Pointer: the paddle centre follows this x (canvas px). */
  setTarget(x: number) {
    this.target = x;
  }

  resize(width: number, height: number) {
    const sx = width / this.width;
    const sy = height / this.height;
    this.width = width;
    this.height = height;
    this.ball.r = clamp(height * 0.02, 5, 7);
    this.paddle.w = clamp(width * 0.15, 70, 130);
    this.paddle.y = height - PADDLE_BOTTOM;
    this.paddle.x = clamp(this.paddle.x * sx, 0, width - this.paddle.w);
    this.ball.x *= sx;
    this.ball.y *= sy;
    this.ball.vx *= sy; // speed is relative to the height
    this.ball.vy *= sy;
    this.layout();
    if (this.phase === "ready" || this.phase === "idle" || (this.phase === "paused" && this.resumeTo === "ready"))
      this.attach();
  }

  // ------------------------------------------------------------ simulation

  /** Advances by `dt` seconds of frame time in fixed steps. */
  update(dt: number) {
    if (this.phase !== "ready" && this.phase !== "playing") return;
    this.acc += Math.min(dt, 0.25);
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_STEPS && (this.phase === "ready" || this.phase === "playing")) {
      this.step();
      this.acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) this.acc = 0;
  }

  /** One fixed step, split into sub-steps of at most half a ball radius so thin shapes can't be skipped. */
  step() {
    this.movePaddle(STEP);
    if (this.phase === "ready") return this.attach();
    if (this.phase !== "playing") return;
    const n = Math.max(1, Math.ceil((this.speed * STEP) / (this.ball.r * 0.5)));
    for (let i = 0; i < n && this.phase === "playing"; i++) this.subStep(STEP / n);
  }

  private subStep(h: number) {
    const b = this.ball;
    b.x += b.vx * h;
    b.y += b.vy * h;

    // walls
    if (b.x - b.r < 0) {
      b.x = b.r;
      b.vx = Math.abs(b.vx);
    } else if (b.x + b.r > this.width) {
      b.x = this.width - b.r;
      b.vx = -Math.abs(b.vx);
    }
    if (b.y - b.r < 0) {
      b.y = b.r;
      b.vy = Math.abs(b.vy);
    }

    // paddle: the angle depends on where it hits (centre: straight up, ends: ±60°)
    const p = this.paddle;
    if (b.vy > 0 && touchesBox(b.x, b.y, b.r, p.x, p.y, p.w, p.h)) {
      const offset = clamp((b.x - (p.x + p.w / 2)) / (p.w / 2), -1, 1);
      const angle = offset * MAX_ANGLE;
      b.vx = this.speed * Math.sin(angle);
      b.vy = -this.speed * Math.cos(angle);
      b.y = p.y - b.r;
      this.emit("paddle", b.x, b.y, 0, -1);
    }

    this.collideBricks();

    // lost below the paddle
    if (b.y - b.r > this.height) this.loseLife();
  }

  /** Resolves at most one brick: the closest one the ball touches. */
  private collideBricks() {
    const b = this.ball;
    let hit = -1;
    let closest = Infinity;
    for (let i = 0; i < this.bricks.length; i++) {
      const k = this.bricks[i];
      if (!k.alive) continue;
      const cx = k.x + k.w / 2;
      const cy = k.y + k.h / 2;
      const touching =
        k.shape === "circle"
          ? (b.x - cx) ** 2 + (b.y - cy) ** 2 < (circleRadius(k) + b.r) ** 2
          : touchesBox(
              b.x,
              b.y,
              b.r,
              k.x + k.w * INSET,
              k.y + k.h * INSET,
              k.w * (1 - 2 * INSET),
              k.h * (1 - 2 * INSET),
            );
      if (!touching) continue;
      const d = (b.x - cx) ** 2 + (b.y - cy) ** 2;
      if (d < closest) {
        closest = d;
        hit = i;
      }
    }
    if (hit < 0) return;

    const k = this.bricks[hit];
    if (k.shape === "circle") this.bounceCircle(k);
    else this.bounceBox(k);
    this.damage(hit);
  }

  /** Reflects on the axis of the smaller penetration and pushes the ball out. */
  private bounceBox(k: Brick) {
    const b = this.ball;
    const left = k.x + k.w * INSET;
    const right = k.x + k.w * (1 - INSET);
    const top = k.y + k.h * INSET;
    const bottom = k.y + k.h * (1 - INSET);
    const penX = Math.min(b.x + b.r - left, right - (b.x - b.r));
    const penY = Math.min(b.y + b.r - top, bottom - (b.y - b.r));
    if (penX < penY) {
      const fromLeft = b.x < (left + right) / 2;
      b.x = fromLeft ? left - b.r : right + b.r;
      b.vx = fromLeft ? -Math.abs(b.vx) : Math.abs(b.vx);
    } else {
      const fromTop = b.y < (top + bottom) / 2;
      b.y = fromTop ? top - b.r : bottom + b.r;
      b.vy = fromTop ? -Math.abs(b.vy) : Math.abs(b.vy);
    }
  }

  /** Reflects off the circle's normal and pushes the ball out along it. */
  private bounceCircle(k: Brick) {
    const b = this.ball;
    const cx = k.x + k.w / 2;
    const cy = k.y + k.h / 2;
    const d = Math.hypot(b.x - cx, b.y - cy) || 1;
    const nx = (b.x - cx) / d;
    const ny = (b.y - cy) / d;
    const dot = b.vx * nx + b.vy * ny;
    if (dot < 0) {
      b.vx -= 2 * dot * nx;
      b.vy -= 2 * dot * ny;
    }
    const reach = circleRadius(k) + b.r;
    b.x = cx + nx * reach;
    b.y = cy + ny * reach;
  }

  private damage(index: number) {
    const k = this.bricks[index];
    k.hp--;
    this.hits++;
    const broken = k.hp <= 0;
    const points = broken && k.maxHp > 1 ? POINTS.strongBreak : POINTS.hit;
    this.score += points;
    this.emit(broken ? "break" : "hit", k.x + k.w / 2, k.y + k.h / 2, points, index);
    this.normalizeVelocity();
    if (!broken) return;
    k.alive = false;
    if (--this.remaining === 0) this.clearLevel();
  }

  /** Keeps |v| = current speed (the ramp) and the angle away from horizontal. */
  private normalizeVelocity() {
    const b = this.ball;
    const speed = this.speed;
    const minVy = speed * MIN_VERTICAL;
    const len = Math.hypot(b.vx, b.vy) || 1;
    b.vx = (b.vx / len) * speed;
    b.vy = (b.vy / len) * speed;
    if (Math.abs(b.vy) < minVy) {
      b.vy = b.vy < 0 ? -minVy : minVy;
      b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(speed * speed - minVy * minVy);
    }
  }

  private clearLevel() {
    this.score += POINTS.levelClear;
    const b = this.ball;
    if (this.level === this.levels.length - 1) {
      this.phase = "won";
      this.emit("win", b.x, b.y, POINTS.levelClear, -1);
      return;
    }
    this.loadLevel(this.level + 1);
    this.phase = "ready";
    this.emit("level", b.x, b.y, POINTS.levelClear, -1);
  }

  private loseLife() {
    this.lives--;
    this.hits = 0;
    if (this.lives <= 0) {
      this.phase = "lost";
      this.emit("lose", this.ball.x, this.height, 0, -1);
      return;
    }
    this.phase = "ready";
    this.attach();
    this.emit("life", this.ball.x, this.height, 0, -1);
  }

  private movePaddle(dt: number) {
    const p = this.paddle;
    if (this.input) p.x += this.input * this.width * KEY_SPEED * dt;
    else if (!Number.isNaN(this.target)) p.x = this.target - p.w / 2;
    p.x = clamp(p.x, 0, this.width - p.w);
  }

  /** Ball sits on the paddle, waiting for launch. */
  private attach() {
    const b = this.ball;
    b.x = this.paddle.x + this.paddle.w / 2;
    b.y = this.paddle.y - b.r - 1;
    b.vx = 0;
    b.vy = 0;
  }

  private emit(type: EventType, x: number, y: number, points: number, brick: number) {
    if (this.eventCount >= this.events.length) return;
    const e = this.events[this.eventCount++];
    e.type = type;
    e.x = x;
    e.y = y;
    e.points = points;
    e.brick = brick;
  }

  // ------------------------------------------------------------ levels

  /** Reuses the level's preallocated bricks (a level change inside the frame loop allocates nothing). */
  private loadLevel(index: number) {
    this.level = index;
    this.hits = 0;
    this.bricks = this.levelBricks[index];
    for (const k of this.bricks) {
      k.hp = k.maxHp;
      k.alive = true;
    }
    this.remaining = this.bricks.length;
    this.layout();
    this.attach();
  }

  /** Grid over the full width and the top half of the canvas; bricks keep a compact aspect ratio. */
  private layout() {
    const map = this.levels[this.level];
    const cols = map[0].length;
    const cellW = (this.width - 2 * SIDE) / cols;
    const cellH = Math.min(cellW * 0.7, (this.height * BRICK_AREA - TOP) / map.length);
    const h = cellH - GAP;
    const w = Math.min(cellW - GAP, h * MAX_BRICK_ASPECT);
    for (const k of this.bricks) {
      k.w = w;
      k.h = h;
      k.x = SIDE + k.col * cellW + (cellW - w) / 2;
      k.y = TOP + k.row * cellH + GAP / 2;
    }
  }
}

export const circleRadius = (k: Brick) => (Math.min(k.w, k.h) / 2) * (1 - INSET);

function parseLevel(map: LevelMap): Brick[] {
  return map.flatMap((line, row) =>
    [...line].flatMap((ch, col) => {
      const shape = SHAPES[ch.toLowerCase() as keyof typeof SHAPES];
      const maxHp = ch === ch.toUpperCase() ? 2 : 1;
      return shape ? [{ col, row, shape, hp: maxHp, maxHp, alive: true, x: 0, y: 0, w: 0, h: 0 }] : [];
    }),
  );
}
