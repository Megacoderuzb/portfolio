import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import type { Locale } from "next-intl";
import { db } from "@/lib/db";
import seed from "../../../seed/seed-data.json";

// Content data layer. Components only call these async getters.
// DB reads happen at request time (`connection()`: the Docker build has no database) and are cached in
// memory under CONTENT_TAG; admin mutations call updateTag(CONTENT_TAG) so the site updates immediately.
export const CONTENT_TAG = "content";

/** Translatable text keyed by locale — the shape of the `content` JSON column. */
export type LocalizedContent<T> = Partial<Record<Locale, T>> & { en: T; _review?: boolean };

const isBlank = (v: unknown) => v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

/** The visitor's locale, field by field, falling back to English for anything missing or empty. */
export function localize<T extends object>(content: LocalizedContent<T>, locale: Locale): T {
  const local = content[locale] as Record<string, unknown> | undefined;
  if (!local) return content.en;
  return Object.fromEntries(
    Object.entries(content.en).map(([key, fallback]) => [key, isBlank(local[key]) ? fallback : local[key]]),
  ) as T;
}

export type ProjectText = { type: string; summary: string; highlights: string[] };
export type ServiceText = { title: string; description: string };
export type Project = ProjectText & { slug: string; title: string; url: string | null; stack: string[] };
export type Service = ServiceText & { slug: string };
export type Contacts = { email: string; telegram: string; linkedin: string; github: string };

async function loadProjects() {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("max");
  return db.project.findMany({ where: { visible: true }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
}

async function loadServices() {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("max");
  return db.service.findMany({ where: { visible: true }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
}

async function loadSetting(key: string) {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("max");
  return (await db.setting.findUnique({ where: { key } }))?.value ?? null;
}

async function loadActiveResume() {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("max");
  return db.resumeFile.findFirst({ where: { active: true }, select: { uploadedAt: true } });
}

/** Visible projects in display order. */
export async function getProjects(locale: Locale): Promise<Project[]> {
  await connection();
  return (await loadProjects()).map((p) => ({
    slug: p.slug,
    title: p.title,
    url: p.url,
    stack: p.stack,
    ...localize(p.content as LocalizedContent<ProjectText>, locale),
  }));
}

/** Visible services in display order. */
export async function getServices(locale: Locale): Promise<Service[]> {
  await connection();
  return (await loadServices()).map((s) => ({
    slug: s.slug,
    ...localize(s.content as LocalizedContent<ServiceText>, locale),
  }));
}

/** Contact links from the `contacts` setting (edited in /admin/settings). */
export async function getContacts(): Promise<Contacts> {
  await connection();
  const { email, telegram, linkedin, github } = seed.owner;
  return { email, telegram, linkedin, github, ...((await loadSetting("contacts")) as Partial<Contacts> | null) };
}

/** Active resume metadata, or null when none is uploaded. */
export async function getResume(): Promise<{ updatedAt: Date } | null> {
  await connection();
  const file = await loadActiveResume();
  return file && { updatedAt: file.uploadedAt };
}

/** Static owner facts (no DB: usable in the prerendered layout, e.g. the footer). */
export function getOwner() {
  return { fullName: seed.owner.fullName, experience: "3+", coreStack: "NestJS · Next.js" };
}

/** Consultation length ("Free · {minutes} min" label) and booking horizon, from the `availability` setting. */
export async function getBookingSettings() {
  await connection();
  const a = (await loadSetting("availability")) as { slotMinutes?: number; maxDaysAhead?: number } | null;
  return { slotMinutes: a?.slotMinutes ?? 30, maxDaysAhead: a?.maxDaysAhead ?? 30 };
}

/** Technologies by group (keys match messages `stack.groups.*`). Tech names are not translated. */
export const stackGroups = [
  { key: "backend", items: ["NestJS", "Node.js", "TypeScript", "Swagger / OpenAPI", "Socket.io", "Jest"] },
  { key: "frontend", items: ["Next.js", "React", "Redux Toolkit", "Tailwind CSS"] },
  {
    key: "data",
    items: ["PostgreSQL", "MongoDB", "Redis", "TypeORM", "Prisma", "BullMQ", "RabbitMQ", "Kafka"],
  },
  { key: "devops", items: ["Docker", "Nginx", "GitHub Actions", "GitLab CI/CD"] },
  { key: "payments", items: ["Click", "Payme", "Uzum Bank", "Atmos"] },
  { key: "automation", items: ["n8n", "RAG", "MCP", "Claude Code / Cursor / Copilot"] },
] as const;
