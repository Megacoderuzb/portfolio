import { cx } from "@/lib/cx";

type Props = { id?: string; eyebrow?: string; title: string; subtitle?: string; className?: string };

/** `id` goes on the h2 so a section can use `aria-labelledby`. */
export function SectionHeading({ id, eyebrow, title, subtitle, className }: Props) {
  return (
    <div className={cx("max-w-2xl", className)}>
      {eyebrow && <p className="mb-3 font-mono text-xs tracking-widest text-violet-400 uppercase">{eyebrow}</p>}
      <h2 id={id} className="text-h2">
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-lg text-muted">{subtitle}</p>}
    </div>
  );
}
