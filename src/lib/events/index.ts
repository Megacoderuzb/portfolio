import type { EventType } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { errorLabel, log } from "@/lib/log";

/** Stores an analytics event. Never throws: analytics must not break the request that triggered it. */
export async function recordEvent(type: EventType, meta?: Record<string, string | undefined>) {
  const clean = meta && Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== undefined));
  try {
    await db.analyticsEvent.create({ data: { type, meta: clean } });
  } catch (e) {
    log.error("events.record_failed", { type, error: errorLabel(e) });
  }
}
