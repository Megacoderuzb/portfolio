import { Check } from "lucide-react";
import { Fragment } from "react";
import { cx } from "@/lib/cx";

/** Progress through ordered steps; `current` is 0-based. */
export function Stepper({ steps, current, label }: { steps: string[]; current: number; label?: string }) {
  return (
    <ol aria-label={label} className="flex items-center gap-2 text-sm">
      {steps.map((step, i) => (
        <Fragment key={step}>
          <li aria-current={i === current ? "step" : undefined} className="flex items-center gap-2">
            <span
              className={cx(
                "grid size-7 place-items-center rounded-full border font-mono text-xs",
                i < current && "border-violet-600 bg-violet-600 text-text",
                i === current && "border-violet-400 text-violet-300 shadow-glow",
                i > current && "border-border text-muted",
              )}
            >
              {i < current ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={cx("hidden sm:inline", i === current ? "text-text" : "text-muted")}>{step}</span>
          </li>
          {i < steps.length - 1 && <li aria-hidden className="h-px w-6 bg-border" />}
        </Fragment>
      ))}
    </ol>
  );
}
