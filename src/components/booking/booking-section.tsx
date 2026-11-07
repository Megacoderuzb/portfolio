import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Chip } from "@/components/ui/chip";
import { Container } from "@/components/ui/container";
import { GlowBorder } from "@/components/ui/glow-border";
import { Reveal } from "@/components/ui/reveal";
import { getBookingSettings, getServices } from "@/lib/content";
import { publicEnv } from "@/lib/env";
import { BookingFlow } from "./booking-flow";

// Enter: panel scales up from 0.96 with a glow pulse; the steps inside cross-fade/slide (motion, see BookingFlow).
export async function BookingSection({ locale }: { locale: Locale }) {
  const [t, services, settings] = await Promise.all([
    getTranslations("booking"),
    getServices(locale),
    getBookingSettings(),
  ]);

  return (
    <section id="booking" aria-labelledby="booking-title" className="py-section">
      <Container>
        <Reveal preset="panel">
          <GlowBorder className="glow-pulse">
            <div className="px-5 py-12 sm:px-12">
              <div className="text-center">
                <ul className="flex flex-wrap justify-center gap-2">
                  <li>
                    <Chip>{t("free")}</Chip>
                  </li>
                  <li>
                    <Chip>{t("duration", { minutes: settings.slotMinutes })}</Chip>
                  </li>
                  <li>
                    <Chip>{t("meet")}</Chip>
                  </li>
                </ul>
                <h2 id="booking-title" className="mx-auto mt-6 max-w-2xl text-h2">
                  {t("title")}
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-lg text-muted">{t("subtitle")}</p>
              </div>
              <div className="mt-12">
                <BookingFlow
                  services={services.map(({ slug, title }) => ({ slug, title }))}
                  siteKey={publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                  horizonDays={settings.maxDaysAhead}
                />
              </div>
            </div>
          </GlowBorder>
        </Reveal>
      </Container>
    </section>
  );
}
