import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

type CardProps = ComponentProps<"div"> & { interactive?: boolean };

/** Surface with border and top highlight. No padding: callers add it (covers go edge to edge). */
export function Card({ interactive, className, ...props }: CardProps) {
  return (
    <div
      className={cx(
        "rounded-(--radius-card) border border-border bg-surface shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--violet-300)_8%,transparent)]",
        interactive && "transition duration-300 hover:-translate-y-1 hover:border-violet-400/40 hover:shadow-glow",
        className,
      )}
      {...props}
    />
  );
}
