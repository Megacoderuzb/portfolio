import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/** 1px violet gradient border with a soft halo around any content. */
export function GlowBorder({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "rounded-(--radius-card) bg-linear-to-br from-violet-600 via-violet-400/30 to-violet-900/40 p-px shadow-glow",
        className,
      )}
    >
      <div className="h-full rounded-[calc(var(--radius-card)-1px)] bg-surface">{children}</div>
    </div>
  );
}
