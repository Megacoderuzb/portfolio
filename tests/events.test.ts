import { describe, expect, it } from "vitest";
import { publicEventSchema } from "@/lib/events/public";

const ok = (body: unknown) => publicEventSchema.safeParse(body).success;

describe("public events whitelist", () => {
  it("accepts the public event types", () => {
    expect(ok({ type: "BOOKING_STARTED", meta: { locale: "ru" } })).toBe(true);
    expect(ok({ type: "SERVICE_CLICK", meta: { serviceSlug: "crm-pms", locale: "uz" } })).toBe(true);
    expect(ok({ type: "PROJECT_CLICK", meta: { projectSlug: "poweryarn" } })).toBe(true);
    expect(ok({ type: "CONTACT_CLICK", meta: { channel: "telegram" } })).toBe(true);
    expect(ok({ type: "GAME_WIN" })).toBe(true);
  });

  it("rejects server-only types, unknown fields and bad values", () => {
    expect(ok({ type: "RESUME_DOWNLOAD" })).toBe(false);
    expect(ok({ type: "BOOKING_CREATED" })).toBe(false);
    expect(ok({ type: "SERVICE_CLICK", meta: { email: "a@b.c" } })).toBe(false);
    expect(ok({ type: "SERVICE_CLICK", meta: { serviceSlug: "<script>" } })).toBe(false);
    expect(ok({ type: "GAME_WIN", extra: 1 })).toBe(false);
  });
});
