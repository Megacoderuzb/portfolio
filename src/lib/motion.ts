import type { Variants } from "motion/react";

// Shared presets for `motion` components (interactive UI such as the booking steps, inside a local
// <LazyMotion features={domAnimation} strict>). Scroll entrances are CSS: see <Reveal> and globals.css.
export const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** In-view animations play once, when a quarter of the element is visible. */
export const viewport = { once: true, amount: 0.25 } as const;

/** Reduced-motion fallback: opacity only, 200 ms. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
};
