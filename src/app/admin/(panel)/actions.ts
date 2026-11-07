"use server";

import { refresh, updateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/admin/action-form";
import { requireAdmin } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { CONTENT_TAG } from "@/lib/content";
import {
  contactsFromForm,
  contactsInput,
  deleteProject,
  deleteService,
  firstIssue,
  isUniqueViolation,
  moveItem,
  projectFromForm,
  projectInput,
  saveContacts,
  saveProject,
  saveService,
  serviceFromForm,
  serviceInput,
} from "@/lib/content/admin";
import {
  availabilityFromForm,
  blockedInput,
  createBlocked,
  deleteBlocked,
  saveAvailability,
  saveOwnerNotes,
  setBookingStatus,
  STATUSES,
} from "@/lib/booking/admin";
import { availabilitySchema } from "@/lib/booking/slots";
import { cancelBriefs } from "@/lib/n8n";
import { enqueueBookingJob } from "@/lib/queue";
import { saveResume, setActiveResume, type ResumeError } from "@/lib/resume";

// Every action re-checks the session (the proxy does too) and validates its input with zod.
// Content changes call updateTag(CONTENT_TAG): the public site shows them on the next request.

const idSchema = z.string().min(1).max(40);

export async function saveProjectAction(_: ActionState, data: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = projectInput.safeParse(projectFromForm(data));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  try {
    await saveProject(parsed.data);
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "slug: already used by another project" };
    throw e;
  }
  updateTag(CONTENT_TAG);
  redirect("/admin/projects");
}

export async function deleteProjectAction(id: string) {
  await requireAdmin();
  await deleteProject(idSchema.parse(id));
  updateTag(CONTENT_TAG);
  redirect("/admin/projects");
}

export async function saveServiceAction(_: ActionState, data: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = serviceInput.safeParse(serviceFromForm(data));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  try {
    await saveService(parsed.data);
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "slug: already used by another service" };
    throw e;
  }
  updateTag(CONTENT_TAG);
  redirect("/admin/services");
}

export async function deleteServiceAction(id: string) {
  await requireAdmin();
  await deleteService(idSchema.parse(id));
  updateTag(CONTENT_TAG);
  redirect("/admin/services");
}

export async function moveAction(kind: "project" | "service", id: string, dir: number) {
  await requireAdmin();
  await moveItem(z.enum(["project", "service"]).parse(kind), idSchema.parse(id), dir < 0 ? -1 : 1);
  updateTag(CONTENT_TAG);
}

const RESUME_ERRORS: Record<ResumeError, string> = {
  missing: "Choose a PDF file.",
  too_large: "The file is larger than 5 MB.",
  not_pdf: "Only PDF files are accepted.",
};

export async function uploadResumeAction(_: ActionState, data: FormData): Promise<ActionState> {
  await requireAdmin();
  const file = data.get("file");
  if (!(file instanceof File)) return { error: RESUME_ERRORS.missing };
  const error = await saveResume(file);
  if (error) return { error: RESUME_ERRORS[error] };
  updateTag(CONTENT_TAG);
  return { ok: true };
}

export async function activateResumeAction(id: string) {
  await requireAdmin();
  await setActiveResume(idSchema.parse(id));
  updateTag(CONTENT_TAG);
}

export async function saveContactsAction(_: ActionState, data: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = contactsInput.safeParse(contactsFromForm(data));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  await saveContacts(parsed.data);
  updateTag(CONTENT_TAG);
  return { ok: true };
}

// ---------------------------------------------------------------- bookings & availability

export async function setBookingStatusAction(id: string, status: string) {
  await requireAdmin();
  const booking = await setBookingStatus(idSchema.parse(id), z.enum(STATUSES).parse(status));
  if (booking.status === "CANCELLED") {
    await cancelBriefs(booking.id);
    await enqueueBookingJob("cancel-booking", booking.id, { cancelledBy: "owner" });
  }
  refresh();
}

export async function saveOwnerNotesAction(id: string, _: ActionState, data: FormData): Promise<ActionState> {
  await requireAdmin();
  const notes = z.string().trim().max(2000).safeParse(data.get("ownerNotes") ?? "");
  if (!notes.success) return { error: "Notes are too long (max 2000 characters)." };
  await saveOwnerNotes(idSchema.parse(id), notes.data);
  return { ok: true };
}

/** Re-sends a booking stuck in PENDING_MEET to the worker → n8n. */
export async function retryDispatchAction(id: string) {
  await requireAdmin();
  await enqueueBookingJob("dispatch-booking", idSchema.parse(id));
  refresh();
}

export async function saveAvailabilityAction(_: ActionState, data: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = availabilitySchema.safeParse(availabilityFromForm(data));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  await saveAvailability(parsed.data);
  updateTag(CONTENT_TAG); // slot length shown on the site
  return { ok: true };
}

export async function addBlockedAction(_: ActionState, data: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = blockedInput.safeParse({ from: data.get("from"), to: data.get("to"), reason: data.get("reason") ?? "" });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  await createBlocked(parsed.data);
  refresh();
  return { ok: true };
}

export async function deleteBlockedAction(id: string) {
  await requireAdmin();
  await deleteBlocked(idSchema.parse(id));
  refresh();
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}
