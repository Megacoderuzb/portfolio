import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { Contacts } from "./index";

// Admin-side data access: zod schemas for every mutation + FormData → input parsing (admin forms post FormData).

const LOCALES = ["en", "uz", "ru"] as const;
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const lines = (v: FormDataEntryValue | null) => str(v).split("\n").map((s) => s.trim()).filter(Boolean);
const list = (v: FormDataEntryValue | null) => str(v).split(",").map((s) => s.trim()).filter(Boolean);
const slug = z.string().max(64).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "use lowercase letters, digits and dashes");
const id = z.string().min(1).max(40);
const httpsUrl = z.url({ protocol: /^https?$/ });

/** Drops locales whose fields are all empty, so they fall back to English instead of overriding it. */
function pickLocales<T extends Record<string, unknown>>(read: (locale: string) => T) {
  return Object.fromEntries(
    LOCALES.map((l) => [l, read(l)] as const).filter(
      ([l, t]) => l === "en" || Object.values(t).some((v) => (Array.isArray(v) ? v.length : v)),
    ),
  );
}

export const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/** "content.en.summary: Too small…" — first problem, for the form message. */
export const firstIssue = (e: z.ZodError) => {
  const issue = e.issues[0];
  return issue ? `${issue.path.join(".") || "form"}: ${issue.message}` : "Invalid input";
};

// ---------------------------------------------------------------- projects

// Per-locale text: English required, uz/ru optional (anything left empty falls back to English on the site).
const projectText = z.object({
  type: z.string().max(120),
  summary: z.string().max(800),
  highlights: z.array(z.string().max(300)).max(12),
});
const projectContent = z.object({
  en: projectText.extend({ type: z.string().min(1).max(120), summary: z.string().min(1).max(800) }),
  uz: projectText.optional(),
  ru: projectText.optional(),
});

export const projectInput = z.object({
  id: id.optional(),
  slug,
  title: z.string().min(1).max(120),
  url: z.union([httpsUrl, z.literal("")]).transform((v) => v || null),
  stack: z.array(z.string().max(40)).max(20),
  serviceIds: z.array(id).max(20),
  visible: z.boolean(),
  status: z.enum(["VERIFIED", "NEEDS_INPUT"]),
  content: projectContent,
});

export function projectFromForm(fd: FormData) {
  return {
    id: str(fd.get("id")) || undefined,
    slug: str(fd.get("slug")),
    title: str(fd.get("title")),
    url: str(fd.get("url")),
    stack: list(fd.get("stack")),
    serviceIds: fd.getAll("serviceIds").map(String),
    visible: fd.get("visible") === "on",
    status: str(fd.get("status")),
    content: pickLocales((l) => ({
      type: str(fd.get(`${l}.type`)),
      summary: str(fd.get(`${l}.summary`)),
      highlights: lines(fd.get(`${l}.highlights`)),
    })),
  };
}

export async function saveProject({ id, serviceIds, ...fields }: z.output<typeof projectInput>) {
  const services = serviceIds.map((sid) => ({ id: sid }));
  if (id) return db.project.update({ where: { id }, data: { ...fields, services: { set: services } } });
  const last = await db.project.aggregate({ _max: { order: true } });
  return db.project.create({ data: { ...fields, order: (last._max.order ?? -1) + 1, services: { connect: services } } });
}

export const listProjectsAdmin = () => db.project.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
export const getProjectAdmin = (projectId: string) =>
  db.project.findUnique({ where: { id: projectId }, include: { services: { select: { id: true } } } });
export const deleteProject = (projectId: string) => db.project.delete({ where: { id: projectId } });

// ---------------------------------------------------------------- services

const serviceText = z.object({ title: z.string().max(120), description: z.string().max(400) });

export const serviceInput = z.object({
  id: id.optional(),
  slug,
  visible: z.boolean(),
  content: z.object({
    en: serviceText.extend({ title: z.string().min(1).max(120), description: z.string().min(1).max(400) }),
    uz: serviceText.optional(),
    ru: serviceText.optional(),
  }),
});

export function serviceFromForm(fd: FormData) {
  return {
    id: str(fd.get("id")) || undefined,
    slug: str(fd.get("slug")),
    visible: fd.get("visible") === "on",
    content: pickLocales((l) => ({ title: str(fd.get(`${l}.title`)), description: str(fd.get(`${l}.description`)) })),
  };
}

export async function saveService({ id: serviceId, ...fields }: z.output<typeof serviceInput>) {
  if (serviceId) return db.service.update({ where: { id: serviceId }, data: fields });
  const last = await db.service.aggregate({ _max: { order: true } });
  return db.service.create({ data: { ...fields, order: (last._max.order ?? -1) + 1 } });
}

export const listServicesAdmin = () => db.service.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
export const getServiceAdmin = (serviceId: string) => db.service.findUnique({ where: { id: serviceId } });
export const deleteService = (serviceId: string) => db.service.delete({ where: { id: serviceId } });

// ---------------------------------------------------------------- ordering

/** Swaps an item with its neighbour (dir −1 = up) and renumbers the list 0…n. */
export async function moveItem(kind: "project" | "service", itemId: string, dir: -1 | 1) {
  const rows = kind === "project" ? await listProjectsAdmin() : await listServicesAdmin();
  const i = rows.findIndex((r) => r.id === itemId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await db.$transaction(
    rows.map((r, order) =>
      kind === "project"
        ? db.project.update({ where: { id: r.id }, data: { order } })
        : db.service.update({ where: { id: r.id }, data: { order } }),
    ),
  );
}

// ---------------------------------------------------------------- settings

export const contactsInput = z.object({
  email: z.email(),
  telegram: httpsUrl,
  linkedin: httpsUrl,
  github: httpsUrl,
});

export const contactsFromForm = (fd: FormData) => ({
  email: str(fd.get("email")),
  telegram: str(fd.get("telegram")),
  linkedin: str(fd.get("linkedin")),
  github: str(fd.get("github")),
});

export const getContactsSetting = async () =>
  ((await db.setting.findUnique({ where: { key: "contacts" } }))?.value ?? null) as Contacts | null;

export const saveContacts = (value: Contacts) =>
  db.setting.upsert({ where: { key: "contacts" }, create: { key: "contacts", value }, update: { value } });
