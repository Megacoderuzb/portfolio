import "@/lib/env/load";
import { DEFAULT_AVAILABILITY } from "@/lib/booking/slots";
import { db } from "@/lib/db";
import data from "./seed-data.json";
import translations from "./translations.json";

// pnpm seed            → creates missing rows only (never touches anything edited in admin)
// pnpm seed --force    → also overwrites existing seeded rows with the seed content
// Idempotent: a second run creates nothing.

type Counts = { created: number; updated: number; skipped: number };
type Translated = Record<string, Record<string, unknown> | undefined>;

export async function seed({ force = false } = {}): Promise<Counts> {
  const counts: Counts = { created: 0, updated: 0, skipped: 0 };
  const plan = (exists: boolean) => {
    if (!exists) counts.created++;
    else if (force) counts.updated++;
    else counts.skipped++;
    return !exists || force;
  };

  for (const s of data.services) {
    const content = { en: { title: s.title, description: s.description }, ...(translations.services as Translated)[s.slug] };
    const exists = !!(await db.service.findUnique({ where: { slug: s.slug }, select: { id: true } }));
    if (!plan(exists)) continue;
    await db.service.upsert({
      where: { slug: s.slug },
      create: { slug: s.slug, order: s.order, content },
      update: { order: s.order, content },
    });
  }

  for (const [order, p] of data.projects.entries()) {
    const content = {
      en: { type: p.type, summary: p.summary, highlights: p.highlights },
      ...(translations.projects as Translated)[p.slug],
    };
    const fields = {
      title: p.title,
      url: p.url,
      stack: p.stack,
      order,
      visible: p.visible,
      status: p.status === "verified" ? ("VERIFIED" as const) : ("NEEDS_INPUT" as const),
      content,
    };
    const services = p.services.map((slug) => ({ slug }));
    const exists = !!(await db.project.findUnique({ where: { slug: p.slug }, select: { id: true } }));
    if (!plan(exists)) continue;
    await db.project.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, ...fields, services: { connect: services } },
      update: { ...fields, services: { set: services } },
    });
  }

  const { email, telegram, linkedin, github } = data.owner;
  const settings = { availability: DEFAULT_AVAILABILITY, contacts: { email, telegram, linkedin, github } };
  for (const [key, value] of Object.entries(settings)) {
    const exists = !!(await db.setting.findUnique({ where: { key } }));
    if (!plan(exists)) continue;
    await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }

  return counts;
}

// Run only as a script (tests import seed()).
if (process.argv[1]?.replace(/\\/g, "/").endsWith("seed/seed.ts")) {
  seed({ force: process.argv.includes("--force") })
    .then((c) => console.log(`[seed] created ${c.created}, updated ${c.updated}, skipped ${c.skipped}`))
    .catch((e) => {
      console.error("[seed] failed:", e instanceof Error ? e.message : e);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
