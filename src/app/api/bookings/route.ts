import { z } from "zod";
import { route } from "@/lib/api";
import { bookingInput, createBooking } from "@/lib/booking";
import { recordEvent } from "@/lib/events";
import { clientIp, hashIp } from "@/lib/ip";
import { enqueueBookingJob } from "@/lib/queue";
import { allow, limiter } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

const bookingRequest = bookingInput.extend({
  website: z.string().max(200).optional(), // honeypot: humans never see it
  turnstileToken: z.string().max(4096).optional(),
});

/** Creates a booking (PENDING_MEET) and hands it to the worker; n8n adds the Calendar event + Meet link. */
export const POST = route("api/bookings", async (req: Request) => {
  const ip = clientIp(req.headers);
  const ipHash = hashIp(ip);
  if (!(await allow(limiter("booking", 5, 60 * 60), ipHash))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const parsed = bookingRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid", fields: parsed.error.issues.map((i) => i.path.join(".")) }, { status: 400 });
  }
  const { website, turnstileToken, ...input } = parsed.data;
  if (website) return Response.json({ error: "invalid" }, { status: 400 });
  if (!(await verifyTurnstile(turnstileToken, ip))) return Response.json({ error: "captcha" }, { status: 403 });

  const result = await createBooking(input, ipHash);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.error === "slot_taken" ? 409 : 429 });
  }

  await recordEvent("BOOKING_CREATED", { purpose: input.purpose, serviceSlug: input.service, locale: input.locale });
  await enqueueBookingJob("dispatch-booking", result.booking.id);
  return Response.json({ token: result.booking.token }, { status: 201 });
});
