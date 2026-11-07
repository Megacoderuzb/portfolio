import { Circle, Hexagon, Triangle } from "lucide-react";
import type { CSSProperties } from "react";

// How far each shape drifts up (--depth) and turns (--spin) over the first 700px of scroll
// (.parallax, CSS scroll timeline: no work while the page is idle).
const shapes = [
  { Icon: Hexagon, depth: -140, spin: 40, className: "-top-8 -left-6 size-16" },
  { Icon: Triangle, depth: -80, spin: -30, className: "top-1/3 -right-6 size-12" },
  { Icon: Circle, depth: -40, spin: 0, className: "-bottom-10 left-1/4 size-10" },
];

/** Translucent hexagon / triangle / circle drifting at different scroll speeds. Static under reduced motion. */
export function ParallaxShapes() {
  return shapes.map(({ Icon, depth, spin, className }, i) => (
    <div
      key={i}
      className={`parallax absolute ${className}`}
      style={{ "--depth": `${depth}px`, "--spin": `${spin}deg` } as CSSProperties}
    >
      <Icon className="size-full fill-violet-500/10 text-violet-400/50" strokeWidth={1.25} />
    </div>
  ));
}
