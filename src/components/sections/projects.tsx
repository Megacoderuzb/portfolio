import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { getProjects } from "@/lib/content";
import { ProjectGrid } from "./project-grid";

export async function Projects({ locale }: { locale: Locale }) {
  const [t, projects] = await Promise.all([getTranslations("projects"), getProjects(locale)]);

  return (
    <section id="projects" aria-labelledby="projects-title" className="py-section">
      <Container>
        <Reveal>
          <SectionHeading id="projects-title" eyebrow="03" title={t("title")} subtitle={t("subtitle")} />
        </Reveal>
        {projects.length ? <ProjectGrid projects={projects} /> : <p className="mt-12 text-muted">{t("empty")}</p>}
      </Container>
    </section>
  );
}
