import { describe, expect, it } from "vitest";
import {
  Breakout,
  circleRadius,
  HITS_PER_SPEEDUP,
  LIVES,
  MAX_ANGLE,
  MAX_SPEEDUP,
  POINTS,
  SPEEDUP,
  STEP,
  type EventType,
} from "@/components/game/engine";
import { LEVELS, type LevelMap } from "@/components/game/levels";

const W = 600;
const H = 300;

function game(levels?: LevelMap[], options: { reducedMotion?: boolean } = {}) {
  const g = new Breakout(W, H, { levels, ...options });
  g.start();
  return g;
}

/** Launches, then places the ball and its velocity by hand. */
function shoot(g: Breakout, x: number, y: number, vx: number, vy: number) {
  g.launch();
  Object.assign(g.ball, { x, y, vx, vy });
}

/** Steps until an event of `type` happens (or `seconds` pass); returns whether it happened. */
function until(g: Breakout, type: EventType, seconds = 3) {
  for (let t = 0; t < seconds; t += STEP) {
    g.eventCount = 0;
    g.step();
    for (let i = 0; i < g.eventCount; i++) if (g.events[i].type === type) return true;
  }
  return false;
}

const center = (g: Breakout, i: number) => ({
  x: g.bricks[i].x + g.bricks[i].w / 2,
  y: g.bricks[i].y + g.bricks[i].h / 2,
});

describe("walls", () => {
  const corner: LevelMap[] = [["r........."]];

  it("bounces off the left, right and top walls and stays inside", () => {
    const g = game(corner);
    shoot(g, 30, 200, -300, -50);
    for (let i = 0; i < 30; i++) g.step();
    expect(g.ball.vx).toBeGreaterThan(0);
    expect(g.ball.x).toBeGreaterThanOrEqual(g.ball.r);

    Object.assign(g.ball, { x: W - 30, y: 200, vx: 300, vy: -50 });
    for (let i = 0; i < 30; i++) g.step();
    expect(g.ball.vx).toBeLessThan(0);
    expect(g.ball.x).toBeLessThanOrEqual(W - g.ball.r);

    Object.assign(g.ball, { x: W - 60, y: 20, vx: 0, vy: -300 });
    for (let i = 0; i < 30; i++) g.step();
    expect(g.ball.vy).toBeGreaterThan(0);
    expect(g.ball.y).toBeGreaterThanOrEqual(g.ball.r);
  });
});

describe("paddle", () => {
  const corner: LevelMap[] = [["r........."]];

  it.each([
    [0, 0],
    [0.5, MAX_ANGLE / 2],
    [1, MAX_ANGLE],
    [-1, -MAX_ANGLE],
    [-1.05, -MAX_ANGLE], // just past the end (still touching): clamped to ±60°
  ])("hit at offset %s → angle %s rad from vertical", (offset, angle) => {
    const g = game(corner);
    g.setTarget(W / 2);
    g.step();
    const p = g.paddle;
    shoot(g, p.x + p.w / 2 + (offset * p.w) / 2, p.y - g.ball.r - 4, 0, 250);
    expect(until(g, "paddle")).toBe(true);
    expect(Math.atan2(g.ball.vx, -g.ball.vy)).toBeCloseTo(angle, 5);
    expect(Math.hypot(g.ball.vx, g.ball.vy)).toBeCloseTo(g.speed, 5);
  });
});

describe("bricks", () => {
  it("a hit removes a 1-hit brick, scores +10 and bounces the ball back", () => {
    const g = game([["....r...r."]]);
    const target = center(g, 0);
    shoot(g, target.x, target.y + 80, 0, -300);
    expect(until(g, "break")).toBe(true);
    expect(g.bricks[0].alive).toBe(false);
    expect(g.bricks[1].alive).toBe(true);
    expect(g.score).toBe(POINTS.hit);
    expect(g.ball.vy).toBeGreaterThan(0);
  });

  it("a 2-hit brick survives the first hit (+10) and breaks on the second (+25)", () => {
    const g = game([["....R...r."]]);
    const target = center(g, 0);
    shoot(g, target.x, target.y + 80, 0, -300);
    expect(until(g, "hit")).toBe(true);
    expect(g.bricks[0]).toMatchObject({ alive: true, hp: 1 });
    expect(g.score).toBe(POINTS.hit);

    Object.assign(g.ball, { x: target.x, y: target.y + 80, vx: 0, vy: -300 });
    expect(until(g, "break")).toBe(true);
    expect(g.bricks[0].alive).toBe(false);
    expect(g.score).toBe(POINTS.hit + POINTS.strongBreak);
  });

  it("circle bricks reflect off their normal", () => {
    const g = game([["....c...r."]]);
    const target = center(g, 0);
    const r = circleRadius(g.bricks[0]);
    // coming up slightly right of centre → leaves to the right
    shoot(g, target.x + r * 0.5, target.y + 80, 0, -300);
    expect(until(g, "break")).toBe(true);
    expect(g.ball.vx).toBeGreaterThan(0);
    expect(g.ball.vy).toBeGreaterThan(0);
  });

  it("speeds up 3% every 5 hits, capped at 1.6×", () => {
    const g = game();
    const base = g.speed;
    g.hits = HITS_PER_SPEEDUP - 1;
    expect(g.speed).toBe(base);
    g.hits = HITS_PER_SPEEDUP;
    expect(g.speed).toBeCloseTo(base * (1 + SPEEDUP));
    g.hits = 10_000;
    expect(g.speed).toBeCloseTo(base * MAX_SPEEDUP);
  });

  it("reduced motion: ball 20% slower", () => {
    expect(game(undefined, { reducedMotion: true }).speed).toBeCloseTo(game().speed * 0.8);
  });
});

describe("lives, levels, win", () => {
  it("losing the ball costs a life and re-attaches it; the third loss ends the game", () => {
    const g = game([["r........."]]);
    for (let life = LIVES - 1; life >= 0; life--) {
      g.setTarget(0);
      g.step();
      shoot(g, W - 40, H - 60, 0, 300);
      expect(until(g, life ? "life" : "lose")).toBe(true);
      expect(g.lives).toBe(life);
      if (life) {
        expect(g.phase).toBe("ready");
        expect(g.ball.x).toBeCloseTo(g.paddle.x + g.paddle.w / 2);
        expect(g.ball.y).toBeLessThan(g.paddle.y);
        expect(g.ball.vx).toBe(0);
      }
    }
    expect(g.phase).toBe("lost");
  });

  it("clearing a level adds +100, loads the next one and waits for launch", () => {
    const g = game([["....r....."], ["r.r.r....."]]);
    const target = center(g, 0);
    shoot(g, target.x, target.y + 80, 0, -300);
    expect(until(g, "level")).toBe(true);
    expect(g).toMatchObject({ level: 1, phase: "ready", remaining: 3, score: POINTS.hit + POINTS.levelClear });
    expect(g.bricks.every((k) => k.alive)).toBe(true);
  });

  it("clearing the last level wins", () => {
    const g = game([["....r....."]]);
    const target = center(g, 0);
    shoot(g, target.x, target.y + 80, 0, -300);
    expect(until(g, "win")).toBe(true);
    expect(g.phase).toBe("won");
    g.step(); // frozen
    expect(g.phase).toBe("won");
  });

  it("restart after game over starts fresh at level 1", () => {
    const g = game();
    g.phase = "lost";
    g.score = 500;
    g.lives = 0;
    g.start();
    expect(g).toMatchObject({ phase: "ready", score: 0, lives: LIVES, level: 0 });
    expect(g.bricks.every((k) => k.alive && k.hp === k.maxHp)).toBe(true);
  });
});

describe("levels", () => {
  const sizes = [
    [320, 280],
    [375, 280],
    [768, 320],
    [960, 320],
  ] as const;

  it.each(sizes)("all levels fit a %ix%i canvas with room to play", (w, h) => {
    for (const map of LEVELS) {
      const g = new Breakout(w, h, { levels: [map] });
      for (const k of g.bricks) {
        expect(k.x).toBeGreaterThanOrEqual(0);
        expect(k.x + k.w).toBeLessThanOrEqual(w);
        expect(k.y).toBeGreaterThanOrEqual(0);
        expect(k.y + k.h).toBeLessThanOrEqual(h * 0.5);
        expect(k.h).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it("level 2 and 3 have some 2-hit bricks; level 3 spells MA", () => {
    expect(LEVELS[1].join("")).toMatch(/[A-Z]/);
    expect(LEVELS[2].join("")).toMatch(/[A-Z]/);
    const lit = LEVELS[2].map((row) => row.replace(/[^.]/g, "#"));
    expect(lit).toEqual([
      ".#...#..###..",
      ".##.##.#...#.",
      ".#.#.#.#...#.",
      ".#...#.#####.",
      ".#...#.#...#.",
      ".#...#.#...#.",
    ]);
  });

  it.each(sizes)("all three levels are solvable at %ix%i (autopilot, no life lost)", (w, h) => {
    const g = new Breakout(w, h);
    g.start();
    // a player who aims: picks the paddle offset that sends the ball towards a remaining brick,
    // switching to the next brick after every paddle hit (so a blocked one can't stall it)
    let t = 0;
    let aim = 0;
    while (g.phase !== "won" && t < 900) {
      if (g.phase === "ready") g.launch();
      const alive = g.bricks.filter((k) => k.alive);
      const k = alive[aim % alive.length];
      const angle = Math.atan2(k.x + k.w / 2 - g.ball.x, g.paddle.y - (k.y + k.h / 2));
      const clamped = Math.max(-MAX_ANGLE * 0.95, Math.min(MAX_ANGLE * 0.95, angle));
      g.setTarget(g.ball.x - ((clamped / MAX_ANGLE) * g.paddle.w) / 2);
      g.eventCount = 0;
      g.update(1 / 60);
      for (let i = 0; i < g.eventCount; i++) if (g.events[i].type === "paddle") aim++;
      t += 1 / 60;
    }
    expect(g.phase).toBe("won");
    expect(g.lives).toBe(LIVES);
    expect(g.score).toBeGreaterThan(0);
  });
});

describe("no tunneling at max speed (property)", () => {
  // mulberry32: deterministic pseudo-random numbers
  let seed = 0x5eed;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  it.each(["r", "t", "d", "h", "c"])("shape %s: 500 random shots through it at 1.6× always hit", (shape) => {
    const g = new Breakout(W, H, { levels: [[`....${shape}.....`, ".........r"]] });
    let misses = 0;
    for (let trial = 0; trial < 500; trial++) {
      g.start();
      g.launch();
      g.hits = 10_000; // max speed
      const k = g.bricks[0];
      const radius = k.shape === "circle" ? circleRadius(k) * 0.6 : 0;
      // a point well inside the brick's collision shape
      const tx = k.x + k.w / 2 + (random() - 0.5) * (radius ? radius : k.w * 0.5);
      const ty = k.y + k.h / 2 + (random() - 0.5) * (radius ? radius : k.h * 0.4);
      // from below, inside the canvas, so no wall is in the way
      const sx = Math.min(W - 20, Math.max(20, tx + (random() - 0.5) * 300));
      const sy = ty + 60 + random() * 120;
      const len = Math.hypot(tx - sx, ty - sy);
      Object.assign(g.ball, { x: sx, y: sy, vx: ((tx - sx) / len) * g.maxSpeed, vy: ((ty - sy) / len) * g.maxSpeed });

      // irregular frame times, like a real browser
      let hit = false;
      for (let frame = 0; frame < 120 && !hit && g.ball.y > k.y - 30; frame++) {
        g.eventCount = 0;
        g.update(1 / 30 + random() * 0.02);
        for (let i = 0; i < g.eventCount; i++) if (g.events[i].brick === 0) hit = true;
      }
      if (!hit) misses++;
    }
    expect(misses).toBe(0);
  });
});
