import type { CSSProperties } from "react";
import { ParallaxShapes } from "./parallax-shapes";

type Field = { key: string; value: string | string[] };
type Token = { text: string; className: string };

const CHAR_MS = 28;
const START_MS = 900; // after the card has slid in

function toLines(fields: Field[]): Token[][] {
  return [
    [
      { text: "$ ", className: "text-violet-400" },
      { text: "whoami", className: "text-text" },
    ],
    [{ text: "{", className: "text-muted" }],
    ...fields.map(({ key, value }) => [
      { text: `  ${key}`, className: "text-violet-300" },
      { text: ": ", className: "text-muted" },
      { text: Array.isArray(value) ? `[${value.map((v) => `"${v}"`).join(", ")}]` : `"${value}"`, className: "text-text" },
      { text: ",", className: "text-muted" },
    ]),
    [
      { text: "}", className: "text-muted" },
      { text: " ▍", className: "caret text-violet-300" },
    ],
  ];
}

/**
 * Glass terminal "typing" a whoami object, a rotating ring and parallax shapes (echo the footer game bricks).
 * Typing is pure CSS (.type-line: each line unmasked in steps, one after another), so no re-renders.
 * Decorative: the hero text carries the same facts. Reduced motion: final text, no parallax.
 */
export function HeroVisual({ fields }: { fields: Field[] }) {
  const lines: { tokens: Token[]; style: CSSProperties }[] = [];
  let start = START_MS;
  for (const tokens of toLines(fields)) {
    const n = tokens.reduce((sum, t) => sum + t.text.length, 0);
    lines.push({ tokens, style: { "--n": n, "--d": `${start}ms` } as CSSProperties });
    start += n * CHAR_MS;
  }

  return (
    <div aria-hidden className="relative mx-auto w-full max-w-lg">
      <div className="hero-ring absolute -inset-[12%] rounded-full border border-violet-500/20">
        <span className="absolute top-1/2 -left-1 size-2 rounded-full bg-violet-400 shadow-glow" />
      </div>
      <ParallaxShapes />
      <div className="hero-card-in relative rounded-(--radius-card) border border-violet-400/20 bg-surface/95 shadow-glow">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <span className="size-3 rounded-full bg-violet-700" />
          <span className="size-3 rounded-full bg-violet-500" />
          <span className="size-3 rounded-full bg-violet-300" />
          <span className="ml-3 font-mono text-xs text-muted">~/whoami.ts</span>
        </div>
        <pre className="p-5 font-mono text-[13px] leading-6 whitespace-pre-wrap sm:p-6 sm:text-sm">
          <code>
            {lines.map(({ tokens, style }, i) => (
              <span key={i} className="type-line block" style={style}>
                {tokens.map((t, j) => (
                  <span key={j} className={t.className}>
                    {t.text}
                  </span>
                ))}
              </span>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
