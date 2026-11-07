import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { serverEnv } from "@/lib/env";

// Resume PDFs live in RESUME_DIR (a volume outside public/) under random names; metadata in ResumeFile.
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const KEEP_VERSIONS = 5;

export type ResumeError = "missing" | "too_large" | "not_pdf";

/** Validates size, declared MIME type and the `%PDF-` magic bytes (the MIME type alone is client-controlled). */
export function validateResume(file: { size: number; type: string }, head: Uint8Array): ResumeError | null {
  if (file.size === 0) return "missing";
  if (file.size > MAX_RESUME_BYTES) return "too_large";
  const magic = new TextDecoder().decode(head.subarray(0, 5));
  if (file.type !== "application/pdf" || magic !== "%PDF-") return "not_pdf";
  return null;
}

const dir = () => path.resolve(serverEnv().RESUME_DIR);

/** Absolute path of a stored file; the random name never leaves the server. */
export const resumePath = (filename: string) => path.join(dir(), path.basename(filename));

/** Stores a validated upload as the new active resume, then prunes old versions. */
export async function saveResume(file: File): Promise<ResumeError | null> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const error = validateResume(file, bytes);
  if (error) return error;

  const filename = `${randomUUID()}.pdf`;
  await mkdir(dir(), { recursive: true });
  await writeFile(resumePath(filename), bytes);
  await db.$transaction([
    db.resumeFile.updateMany({ where: { active: true }, data: { active: false } }),
    db.resumeFile.create({ data: { filename, sizeBytes: file.size, active: true } }),
  ]);
  await pruneResumes();
  return null;
}

export async function setActiveResume(id: string) {
  await db.$transaction([
    db.resumeFile.updateMany({ where: { active: true }, data: { active: false } }),
    db.resumeFile.update({ where: { id }, data: { active: true } }),
  ]);
}

/** Keeps the newest KEEP_VERSIONS files (and always the active one). */
async function pruneResumes() {
  const old = await db.resumeFile.findMany({
    where: { active: false },
    orderBy: { uploadedAt: "desc" },
    skip: KEEP_VERSIONS - 1,
  });
  for (const f of old) {
    await rm(resumePath(f.filename), { force: true });
    await db.resumeFile.delete({ where: { id: f.id } });
  }
}

export const listResumes = () => db.resumeFile.findMany({ orderBy: { uploadedAt: "desc" } });
export const getActiveResumeFile = () => db.resumeFile.findFirst({ where: { active: true } });
