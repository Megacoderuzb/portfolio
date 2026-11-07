import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

const variants = {
  primary: "bg-violet-600 text-text hover:bg-violet-700 hover:shadow-glow",
  secondary: "border border-violet-500/60 text-violet-300 hover:border-violet-400 hover:bg-violet-500/10",
  ghost: "text-muted hover:bg-surface-2 hover:text-text",
};
// min-height, not height: long labels (Russian) wrap on narrow screens instead of widening the layout
const sizes = { sm: "min-h-9 px-4 py-1.5 text-sm", md: "min-h-11 px-5 py-2", lg: "min-h-13 px-7 py-3 text-lg" };

type StyleProps = { variant?: keyof typeof variants; size?: keyof typeof sizes };

/** Button look for any element, e.g. `<a className={buttonStyles()}>`. */
export function buttonStyles({ variant = "primary", size = "md" }: StyleProps = {}) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-full text-center leading-snug font-medium transition-[background-color,border-color,color,box-shadow] duration-200 disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & StyleProps & { loading?: boolean };

export function Button({ variant, size, loading, className, children, disabled, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(buttonStyles({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
