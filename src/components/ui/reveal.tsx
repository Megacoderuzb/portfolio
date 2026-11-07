"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/** Section entrance styles, defined in globals.css (`[data-reveal="…"]`). See docs/DESIGN.md section table. */
export type Preset = "rise" | "clip" | "pop" | "side" | "curtain" | "tilt" | "panel" | "diagonal" | "sweep";

type Props = {
  children?: ReactNode;
  preset?: Preset;
  /** Position in a list: stagger delay and alternating side. */
  index?: number;
  as?: "div" | "li" | "p";
  className?: string;
};

// One observer for the whole page. Once an element is a fifth visible it gets data-shown and the CSS
// transition plays (once). No animation library on the landing: keeps the main thread free for first paint.
let observer: IntersectionObserver | undefined;

function observe(el: Element) {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-shown", "");
        observer?.unobserve(entry.target);
      }
    },
    { threshold: 0.2 },
  );
  observer.observe(el);
  return () => observer?.unobserve(el);
}

/** Animates its children in once when scrolled into view; opacity-only under reduced motion, visible without JS. */
export function Reveal({ children, preset = "rise", index = 0, as: Tag = "div", className }: Props) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => (ref.current ? observe(ref.current) : undefined), []);

  // IntersectionObserver honours the target's own clip-path: a fully clipped element never "intersects".
  // So the clip-path presets mask an inner wrapper and the observed element stays unclipped.
  const masked = preset === "clip" || preset === "curtain";
  const Mask = Tag === "p" ? "span" : "div"; // valid nesting inside <p>

  return (
    <Tag
      ref={ref as never}
      data-reveal={preset}
      style={{ "--i": index, "--side": index % 2 ? 1 : -1 } as CSSProperties}
      className={className}
    >
      {masked ? <Mask className="reveal-mask block h-full">{children}</Mask> : children}
    </Tag>
  );
}
