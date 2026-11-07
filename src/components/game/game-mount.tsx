"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

// The game box: HUD row + canvas frame. The skeleton and the game share these sizes, so nothing shifts.
export const HUD_CLASS = "flex h-20 flex-wrap content-center items-center justify-between gap-x-4 gap-y-2 sm:h-10";
export const FRAME_CLASS = "relative mt-3 h-70 overflow-hidden rounded-(--radius-card) border border-border md:h-80";

/** Static placeholder (no pulse: nothing animates until the game is wanted). */
function GameSkeleton() {
  return (
    <div aria-hidden>
      <div className={HUD_CLASS} />
      <div className={`${FRAME_CLASS} bg-surface-2/40`} />
    </div>
  );
}

// engine + renderer + UI are a separate chunk, fetched only when the footer gets within ~600 px of the viewport
const Breakout = dynamic(() => import("./breakout"), { ssr: false, loading: GameSkeleton });

export function GameMount() {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setNear(true);
        observer.disconnect();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{near ? <Breakout /> : <GameSkeleton />}</div>;
}
