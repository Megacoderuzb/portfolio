import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { getServices } from "@/lib/content";
import { ServiceCard } from "./service-card";

// Enter: cards fly in from alternating sides with a 3D tilt (perspective on the list). No prices.
export async function Services({ locale }: { locale: Locale }) {
  const [t, services] = await Promise.all([getTranslations("services"), getServices(locale)]);

  return (
    <section id="services" aria-labelledby="services-title" className="overflow-x-clip py-section">
      <Container>
        <Reveal>
          <SectionHeading id="services-title" eyebrow="04" title={t("title")} subtitle={t("subtitle")} />
        </Reveal>
        <ul className="mt-12 grid gap-6 [perspective:1200px] sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, i) => (
            <Reveal as="li" preset="tilt" index={i} key={service.slug}>
              <ServiceCard service={service} cta={t("cta")} />
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
