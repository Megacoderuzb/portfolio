import { UnrecoverableError } from "bullmq";

// Worker → n8n webhooks (docs/BOOKING-N8N.md "Contracts"). Times are ISO-8601 UTC; n8n formats them in Tashkent.

type BookingRow = {
  id: string;
  token: string;
  name: string;
  email: string;
  telegram: string | null;
  phone: string | null;
  company: string | null;
  note: string | null;
  purpose: string;
  locale: string;
  visitorTimezone: string;
  startsAt: Date;
  endsAt: Date;
  calendarEventId: string | null;
  service: { slug: string; content: unknown } | null;
};

/** `adminUrl`: base of the admin panel (its own host when ADMIN_URL is set), defaults to the site. */
export function createdPayload(b: BookingRow, appUrl: string, adminUrl = appUrl) {
  const serviceTitle = (b.service?.content as { en?: { title?: string } } | undefined)?.en?.title;
  return {
    bookingId: b.id,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    ownerTimezone: "Asia/Tashkent",
    visitor: {
      name: b.name,
      email: b.email,
      telegram: b.telegram,
      phone: b.phone,
      company: b.company,
      timezone: b.visitorTimezone,
      locale: b.locale,
    },
    purpose: b.purpose,
    service: b.service ? { slug: b.service.slug, title: serviceTitle ?? b.service.slug } : null,
    note: b.note,
    manageUrl: `${appUrl}/${b.locale}/booking/${b.token}`,
    adminUrl: `${adminUrl}/admin/bookings`,
  };
}

export function cancelledPayload(b: BookingRow, cancelledBy: "visitor" | "owner") {
  return {
    bookingId: b.id,
    calendarEventId: b.calendarEventId,
    cancelledBy,
    visitor: { name: b.name, email: b.email },
    startsAt: b.startsAt.toISOString(),
  };
}

type PostOptions = { baseUrl: string; secret?: string; path: string; body: unknown; fetchImpl?: typeof fetch; timeoutMs?: number };

/**
 * POST {baseUrl}/webhook/{path} with X-Webhook-Secret. Network errors, timeouts, 5xx, 408 and 429 throw a normal
 * Error (BullMQ retries); any other 4xx throws UnrecoverableError (a wrong secret or payload won't fix itself).
 */
export async function postToN8n({ baseUrl, secret, path, body, fetchImpl = fetch, timeoutMs = 15_000 }: PostOptions) {
  if (!secret) throw new UnrecoverableError("N8N_WEBHOOK_SECRET is not set");
  const res = await fetchImpl(new URL(`/webhook/${path}`, baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json", "x-webhook-secret": secret },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.ok) return res.status;
  const message = `n8n /webhook/${path} responded ${res.status}`;
  if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
    throw new UnrecoverableError(message);
  }
  throw new Error(message);
}
