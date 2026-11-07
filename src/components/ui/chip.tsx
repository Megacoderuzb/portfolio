import type { HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

export function Chip({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 font-mono text-xs text-violet-300",
        className,
      )}
      {...props}
    />
  );
}
