import { getTranslations } from "next-intl/server";
import { Chip } from "@/components/ui/chip";
import { Container } from "@/components/ui/container";
import { Marquee } from "@/components/ui/marquee";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { stackGroups } from "@/lib/content";

// Enter: group rows slide in from alternating sides; a decorative marquee of every tech runs below.
export async function Stack() {
  const t = await getTranslations("stack");
  const all = stackGroups.flatMap((g) => g.items);

  return (
    <section id="stack" aria-labelledby="stack-title" className="overflow-x-clip py-section">
      <Container>
        <Reveal>
          <SectionHeading id="stack-title" eyebrow="02" title={t("title")} subtitle={t("subtitle")} />
        </Reveal>
        <div className="mt-12 grid gap-3">
          {stackGroups.map((group, i) => (
            <Reveal
              key={group.key}
              preset="side"
              index={i}
              className="grid gap-3 rounded-2xl border border-border bg-surface/60 p-5 sm:grid-cols-[13rem_1fr] sm:items-center"
            >
              <h3 className="font-mono text-sm font-medium tracking-normal text-violet-400">
                {t(`groups.${group.key}`)}
              </h3>
              <ul className="flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <li key={item}>
                    <Chip>{item}</Chip>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </Container>
      {/* repeats the list above, so hidden from assistive tech; the Reveal also starts the marquee */}
      <Reveal className="mt-14">
        <div aria-hidden>
          <Marquee>
          {all.map((item) => (
            <span key={item} className="px-4 font-heading text-2xl font-extrabold text-violet-300/60 sm:text-3xl">
              {item}
            </span>
          ))}
          </Marquee>
        </div>
      </Reveal>
    </section>
  );
}
