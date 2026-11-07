import { z } from "zod";

// Shared by the browser helper (track.ts) and POST /api/events. No server imports here.

/** The only event types the public API accepts (BOOKING_STARTED: visitor reached the time step). */
export const PUBLIC_EVENTS = ["SERVICE_CLICK", "PROJECT_CLICK", "CONTACT_CLICK", "GAME_WIN", "BOOKING_STARTED"] as const;
export type PublicEvent = (typeof PUBLIC_EVENTS)[number];

const slug = z.string().regex(/^[a-z0-9-]{1,64}$/);

export const publicEventSchema = z
  .object({
    type: z.enum(PUBLIC_EVENTS),
    meta: z
      .object({
        serviceSlug: slug.optional(),
        projectSlug: slug.optional(),
        channel: z.enum(["email", "telegram", "linkedin", "github"]).optional(),
        locale: z.enum(["uz", "ru", "en"]).optional(),
      })
      .strict()
      .default({}),
  })
  .strict();

export type EventMeta = z.input<typeof publicEventSchema>["meta"];
