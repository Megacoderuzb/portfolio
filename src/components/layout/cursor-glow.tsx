"use client";

import { useEffect, useRef } from "react";

const SIZE = 400;

/** Soft violet light following the pointer. Mouse/trackpad only, off under reduced motion. */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.transform = `translate3d(${e.clientX - SIZE / 2}px, ${e.clientY - SIZE / 2}px, 0)`;
        el.style.opacity = "1";
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      style={{ width: SIZE, height: SIZE }}
      className="pointer-events-none fixed top-0 left-0 -z-5 rounded-full opacity-0 transition-opacity duration-500 [background:radial-gradient(circle,var(--glow),transparent_60%)]"
    />
  );
}
