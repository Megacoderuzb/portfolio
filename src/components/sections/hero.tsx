import { FileDown } from "lucide-react";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";
import { buttonStyles } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Container } from "@/components/ui/container";
import { apiUrl } from "@/lib/hosts";
import { getOwner, getProjects } from "@/lib/content";
import { HeroVisual } from "./hero-visual";

// Entrance runs in CSS (.hero-in) so the headline paints before hydration.
const order = (i: number) => ({ "--i": i }) as CSSProperties;

export async function Hero({ locale }: { locale: Locale }) {
  const t = await getTranslations();
  const [owner, projects] = await Promise.all([getOwner(), getProjects(locale)]);
  const stats = [
    { value: owner.experience, label: t("hero.stats.experience") },
    { value: String(projects.length), label: t("hero.stats.projects") },
    { value: owner.coreStack, label: t("hero.stats.stack") },
  ];

  return (
    <section aria-labelledby="hero-title" className="overflow-x-clip">
      <Container className="grid items-center gap-16 pt-12 pb-section sm:pt-20 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="min-w-0">
          <p className="hero-in" style={order(0)}>
            <Chip className="py-1.5">
              <span aria-hidden className="size-2 animate-[pulse_2s_ease-in-out_3] rounded-full bg-violet-400" />
              {t("hero.badge")}
            </Chip>
          </p>
          <h1 id="hero-title" className="mt-6">
            <span
              className="hero-in block font-mono text-sm font-medium tracking-normal text-violet-300 sm:text-base"
              style={order(1)}
            >
              {owner.fullName} · {t("hero.role")}
            </span>
            <span className="hero-in mt-4 block text-h1" style={order(2)}>
              {t("hero.title")}
            </span>
          </h1>
          <p className="hero-in mt-6 max-w-xl text-lg text-muted" style={order(3)}>
            {t("hero.subtitle")}
          </p>
          <div className="hero-in mt-10 flex flex-wrap gap-3" style={order(4)}>
            <a href="#booking" className={buttonStyles({ size: "lg" })}>
              {t("hero.ctaBook")}
            </a>
            {/* file download from a route handler, not a page: plain <a> on purpose */}
            <a href={apiUrl("/api/resume")} className={buttonStyles({ variant: "secondary", size: "lg" })}>
              <FileDown className="size-5" aria-hidden />
              {t("hero.ctaResume")}
            </a>
          </div>
          <ul className="hero-in mt-10 flex flex-wrap gap-3" style={order(5)}>
            {stats.map((s) => (
              <li key={s.label} className="rounded-2xl border border-border bg-surface/60 px-4 py-2.5 text-sm text-muted">
                <strong className="mr-1.5 font-heading text-base text-text">{s.value}</strong>
                {s.label}
              </li>
            ))}
          </ul>
        </div>
        <HeroVisual
          fields={[
            { key: "name", value: owner.fullName },
            { key: "role", value: t("hero.role") },
            { key: "stack", value: ["NestJS", "Next.js", "PostgreSQL"] },
            { key: "location", value: t("about.facts.location") },
            { key: "status", value: t("hero.status") },
          ]}
        />
      </Container>
    </section>
  );
}
