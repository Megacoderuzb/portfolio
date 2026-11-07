import { GraduationCap, Languages, MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";

const openTo = ["job", "freelance", "networking"] as const;

// Enter: text revealed by a left→right mask, "open to" chips pop with a spring.
export async function About() {
  const t = await getTranslations("about");
  const facts = [
    { Icon: GraduationCap, text: t("facts.education") },
    { Icon: Languages, text: t("facts.languages") },
    { Icon: MapPin, text: t("facts.location") },
  ];

  return (
    <section id="about" aria-labelledby="about-title" className="py-section">
      <Container className="grid gap-12 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
        <div>
          <Reveal>
            <SectionHeading id="about-title" eyebrow="01" title={t("title")} />
          </Reveal>
          <Reveal as="p" preset="clip" className="mt-8 text-lg text-muted">
            {t("text")}
          </Reveal>
          <h3 className="mt-10 font-mono text-xs font-medium tracking-widest text-violet-400 uppercase">
            {t("openTo.title")}
          </h3>
          <ul className="mt-4 flex flex-wrap gap-3">
            {openTo.map((key, i) => (
              <Reveal as="li" preset="pop" index={i} key={key}>
                <Chip className="px-4 py-2">{t(`openTo.${key}`)}</Chip>
              </Reveal>
            ))}
          </ul>
        </div>
        <Reveal index={2}>
          <Card className="p-6">
            <ul className="grid gap-5">
              {facts.map(({ Icon, text }) => (
                <li key={text} className="flex gap-3">
                  <Icon className="mt-1 size-5 shrink-0 text-violet-300" strokeWidth={1.75} aria-hidden />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      </Container>
    </section>
  );
}
