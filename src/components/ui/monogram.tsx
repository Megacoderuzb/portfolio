import { cx } from "@/lib/cx";

const sizes = { sm: "size-9 rounded-xl text-sm", md: "size-12 rounded-2xl text-lg", lg: "size-20 rounded-3xl text-3xl" };

/** "MA" logo mark; decorative, so the surrounding link carries the accessible name. */
export function Monogram({ size = "sm", className }: { size?: keyof typeof sizes; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "grid shrink-0 place-items-center bg-linear-to-br from-violet-800 to-violet-600 font-heading font-extrabold tracking-tight text-text shadow-glow",
        sizes[size],
        className,
      )}
    >
      MA
    </span>
  );
}
