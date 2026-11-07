import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { About } from "@/components/sections/about";
import { BookingSection } from "@/components/booking/booking-section";
import { Contacts } from "@/components/sections/contacts";
import { Hero } from "@/components/sections/hero";
import { PersonJsonLd } from "@/components/sections/person-json-ld";
import { Projects } from "@/components/sections/projects";
import { Services } from "@/components/sections/services";
import { Stack } from "@/components/sections/stack";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const locale = (await params).locale as Locale; // validated by the layout
  setRequestLocale(locale);

  // Sections read the DB at request time (cached in memory, see src/lib/content), so they stream inside one
  // boundary: the prerendered shell is the layout (navbar, footer); content arrives in the same response.
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <PersonJsonLd locale={locale} />
      <Hero locale={locale} />
      <About />
      <Stack />
      <Projects locale={locale} />
      <Services locale={locale} />
      <BookingSection locale={locale} />
      <Contacts />
    </Suspense>
  );
}
