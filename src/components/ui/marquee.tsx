import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * Infinite horizontal scroll (CSS). Pauses on hover/focus and while inside a not-yet-shown <Reveal>;
 * static and wrapped under reduced motion.
 */
export function Marquee({ children, reverse, className }: { children: ReactNode; reverse?: boolean; className?: string }) {
  return (
    <div
      className={cx(
        "marquee overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]",
        className,
      )}
    >
      <div className={cx("marquee-track flex w-max gap-3", reverse && "[animation-direction:reverse]")}>
        <div className="flex gap-3">{children}</div>
        <div className="marquee-dup flex gap-3" aria-hidden inert>
          {children}
        </div>
      </div>
    </div>
  );
}
