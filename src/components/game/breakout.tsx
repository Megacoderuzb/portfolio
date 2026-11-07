"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { track } from "@/lib/events/track";
import { Breakout as Engine, LIVES, type Phase } from "./engine";
import { FRAME_CLASS, HUD_CLASS } from "./game-mount";
import { LEVELS } from "./levels";
import { readPalette, Renderer } from "./render";

const BEST_KEY = "ma_breakout_best";

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score: number) {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch {}
}

type Hud = { phase: Phase; score: number; lives: number; level: number };
type Controls = { game: Engine; sync: () => void; wake: () => void; left: number };

/** Footer breakout (docs/GAME.md). Loaded lazily by <GameMount>; never server-rendered. */
export default function Breakout() {
  const t = useTranslations("footer.game");
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useRef<Controls | null>(null);
  const [hud, setHud] = useState<Hud>({ phase: "idle", score: 0, lives: LIVES, level: 1 });
  const [best, setBest] = useState(readBest);

  useEffect(() => {
    const frame = frameRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const box = canvas.getBoundingClientRect(); // the canvas, not the bordered frame: 1 canvas px = 1 css px
    const game = new Engine(box.width || 320, box.height || 280, { reducedMotion });
    const renderer = new Renderer(ctx, readPalette(), reducedMotion);
    let bestSoFar = readBest();

    // React state changes only on game events (hits, lives, levels), never per frame
    const sync = () => {
      if (game.score > bestSoFar) {
        bestSoFar = game.score;
        saveBest(bestSoFar);
        setBest(bestSoFar);
      }
      setHud({ phase: game.phase, score: game.score, lives: game.lives, level: game.level + 1 });
    };

    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      game.update(dt);
      if (game.eventCount) {
        for (let i = 0; i < game.eventCount; i++) {
          renderer.onEvent(game.events[i], game);
          if (game.events[i].type === "win") track("GAME_WIN");
        }
        game.eventCount = 0;
        sync();
      }
      renderer.draw(game, dt);
      // the loop sleeps when nothing moves (idle, paused, game over) and wakes on input
      if (game.phase === "ready" || game.phase === "playing" || renderer.busy) raf = requestAnimationFrame(loop);
      else raf = last = 0;
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const c: Controls = { game, sync, wake, left: box.left };
    controls.current = c;

    const fit = () => {
      const { width, height, left } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      c.left = left;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      renderer.reset(dpr);
      game.resize(width, height);
      renderer.draw(game, 0);
    };
    fit();
    const resize = new ResizeObserver(fit);
    resize.observe(frame);

    // pause when mostly scrolled away or the tab is hidden; resuming is always the player's choice
    const pause = () => {
      if (game.phase !== "ready" && game.phase !== "playing") return;
      game.pause();
      sync();
      wake();
    };
    const visibility = new IntersectionObserver(([entry]) => entry.intersectionRatio < 0.2 && pause(), {
      threshold: [0, 0.2],
    });
    visibility.observe(frame);
    const onHidden = () => document.hidden && pause();
    document.addEventListener("visibilitychange", onHidden);

    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      visibility.disconnect();
      document.removeEventListener("visibilitychange", onHidden);
      controls.current = null;
    };
  }, []);

  /** Runs a command on the engine, then refreshes the HUD and wakes the loop. */
  const act = (command: (game: Engine) => void) => {
    const c = controls.current;
    if (!c) return;
    command(c.game);
    c.sync();
    c.wake();
  };
  const start = () => {
    act((g) => g.start());
    canvasRef.current?.focus();
  };
  const togglePause = () => act((g) => (g.phase === "paused" ? g.resume() : g.pause()));

  // horizontal position only; vertical touch drags stay page scrolls (touch-action: pan-y).
  // The canvas' left edge is cached (resize / pointerenter): reading layout on every move forced reflows.
  const onPointerEnter = (e: PointerEvent<HTMLCanvasElement>) => {
    if (controls.current) controls.current.left = e.currentTarget.getBoundingClientRect().left;
  };
  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const c = controls.current;
    if (c) c.game.setTarget(e.clientX - c.left);
  };
  const onClick = () => act((g) => (g.phase === "idle" ? g.start() : g.launch()));
  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const key = e.key.toLowerCase();
    if (key === "arrowleft" || key === "a") controls.current?.game.setInput(-1);
    else if (key === "arrowright" || key === "d") controls.current?.game.setInput(1);
    else if (key === " ")
      act((g) =>
        g.phase === "paused"
          ? g.resume()
          : g.phase === "ready"
            ? g.launch()
            : g.phase === "playing"
              ? undefined
              : g.start(),
      );
    else if (key === "p" || key === "escape") togglePause();
    else return;
    e.preventDefault();
    controls.current?.wake();
  };
  const onKeyUp = (e: KeyboardEvent<HTMLCanvasElement>) => {
    if (["arrowleft", "arrowright", "a", "d"].includes(e.key.toLowerCase())) controls.current?.game.setInput(0);
  };

  const { phase, score, lives, level } = hud;
  const running = phase === "ready" || phase === "playing";
  // announced politely on lives / level / end changes (not on every point)
  const status =
    phase === "won"
      ? `${t("win")} ${t("score")}: ${score}`
      : phase === "lost"
        ? `${t("lose")}. ${t("score")}: ${score}`
        : phase === "idle"
          ? ""
          : `${t("lives")}: ${lives}. ${t("level")}: ${level}`;

  return (
    <div>
      <div className={HUD_CLASS}>
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
          {(
            [
              ["score", score],
              ["best", best],
              ["lives", lives],
              ["level", `${level}/${LEVELS.length}`],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="flex gap-1.5">
              <dt className="text-muted">{t(key)}</dt>
              <dd className="font-medium text-text">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex gap-2">
          {(running || phase === "paused") && (
            <Button size="sm" variant="secondary" onClick={togglePause}>
              {phase === "paused" ? t("resume") : t("pause")}
            </Button>
          )}
          {phase !== "idle" && (
            <Button size="sm" variant="ghost" onClick={start}>
              {t("restart")}
            </Button>
          )}
        </div>
      </div>

      <div ref={frameRef} className={`${FRAME_CLASS} bg-bg-0/60`}>
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="application"
          aria-label={t("label")}
          aria-describedby="game-launch-hint"
          className="block size-full touch-pan-y rounded-(--radius-card) outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-inset"
          onPointerEnter={onPointerEnter}
          onPointerDown={onPointerEnter}
          onPointerMove={onPointerMove}
          onClick={onClick}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
        />

        <p
          id="game-launch-hint"
          className={`pointer-events-none absolute inset-x-0 bottom-12 text-center text-xs text-muted transition-opacity ${phase === "ready" ? "opacity-100" : "opacity-0"}`}
        >
          {t("launch")}
        </p>

        {phase !== "ready" && phase !== "playing" && (
          <div className="absolute inset-0 grid place-items-center bg-bg-0/70 p-4 text-center backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-4">
              {phase === "won" && <p className="font-heading text-xl font-bold">{t("win")}</p>}
              {phase === "lost" && <p className="font-heading text-xl font-bold">{t("lose")}</p>}
              {(phase === "won" || phase === "lost") && (
                <p className="text-sm text-muted">
                  {t("score")}: <span className="font-medium text-text tabular-nums">{score}</span>
                </p>
              )}
              <div className="flex flex-wrap justify-center gap-3">
                {phase === "idle" && <Button onClick={start}>{t("start")}</Button>}
                {phase === "paused" && <Button onClick={togglePause}>{t("resume")}</Button>}
                {phase === "won" && (
                  <a href="#booking" className={buttonStyles()}>
                    {t("winCta")}
                  </a>
                )}
                {(phase === "won" || phase === "lost") && (
                  <Button variant={phase === "won" ? "secondary" : "primary"} onClick={start}>
                    {t("tryAgain")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {status}
      </p>
    </div>
  );
}
