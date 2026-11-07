import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Container } from "@/components/ui/container";
import { GlowBorder } from "@/components/ui/glow-border";
import { Marquee } from "@/components/ui/marquee";
import { Monogram } from "@/components/ui/monogram";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { Stepper } from "@/components/ui/stepper";
import { Demos } from "./demos";

// Dev-only style guide at /{locale}/_dev/ui (folder "%5Fdev" because "_dev" would be a private folder).
// 404 in production; not in the sitemap. Section titles are English on purpose: not user-facing.
export const metadata: Metadata = { robots: { index: false, follow: false } };

const palette = [
  "bg-0",
  "bg-1",
  "surface",
  "surface-2",
  "border",
  "violet-300",
  "violet-400",
  "violet-500",
  "violet-600",
  "violet-700",
  "violet-800",
  "violet-900",
  "text",
  "muted",
  "dim",
  "glow",
  "danger",
  "success",
];

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-10">
      <h2 className="mb-6 font-mono text-sm tracking-widest text-violet-400 uppercase">{title}</h2>
      {children}
    </section>
  );
}

export default async function UiPage({ params }: PageProps<"/[locale]/_dev/ui">) {
  if (process.env.NODE_ENV === "production") notFound();
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations();
  const messages = await getMessages();
  const steps = Object.values(messages.booking.steps);
  const groups = Object.values(messages.stack.groups);

  return (
    <Container className="py-16">
      <h1 className="text-h1">UI</h1>

      <Block title="Palette">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {palette.map((name) => (
            <li key={name} className="overflow-hidden rounded-xl border border-border">
              <div className="h-16" style={{ background: `var(--${name})` }} />
              <p className="px-3 py-2 font-mono text-xs">{name}</p>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Typography">
        <p className="text-h1 font-heading font-extrabold">{t("hero.title")}</p>
        <p className="mt-4 text-h2 font-heading font-extrabold">{t("about.title")}</p>
        <p className="mt-4 max-w-3xl">{t("about.text")}</p>
        <p className="mt-2 text-sm text-muted">{t("about.facts.languages")}</p>
        <p className="mt-2 font-mono text-sm text-violet-300">{t("footer.game.title")}</p>
      </Block>

      <Block title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">{t("nav.bookCall")}</Button>
          <Button>{t("hero.ctaBook")}</Button>
          <Button size="lg">{t("hero.ctaBook")}</Button>
          <Button variant="secondary">{t("hero.ctaResume")}</Button>
          <Button variant="ghost">{t("common.back")}</Button>
          <Button loading>{t("booking.submitting")}</Button>
          <Button disabled>{t("common.next")}</Button>
        </div>
      </Block>

      <Block title="Card · Chip · GlowBorder · Monogram · SectionHeading">
        <div className="grid gap-6 md:grid-cols-3">
          <Card interactive className="p-6">
            <h3 className="text-xl">{t("services.title")}</h3>
            <p className="mt-2 text-muted">{t("services.subtitle")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Chip>NestJS</Chip>
              <Chip>Next.js</Chip>
              <Chip>PostgreSQL</Chip>
            </div>
          </Card>
          <GlowBorder>
            <div className="p-6">
              <p className="font-mono text-sm text-violet-300">{t("booking.free")}</p>
              <p className="mt-2">{t("booking.duration", { minutes: 30 })}</p>
            </div>
          </GlowBorder>
          <div className="flex items-center gap-4">
            <Monogram size="sm" />
            <Monogram size="md" />
            <Monogram size="lg" />
          </div>
        </div>
        <SectionHeading className="mt-10" eyebrow="03" title={t("projects.title")} subtitle={t("projects.subtitle")} />
      </Block>

      <Block title="Stepper · Skeleton · Marquee">
        <Stepper steps={steps} current={1} />
        <div className="mt-8 grid max-w-md gap-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <Marquee className="mt-8">
          {groups.map((g) => (
            <Chip key={g}>{g}</Chip>
          ))}
        </Marquee>
      </Block>

      <Block title="Interactive: Dialog · Drawer · Tabs · Toast · Form controls">
        <Demos />
      </Block>
    </Container>
  );
}
