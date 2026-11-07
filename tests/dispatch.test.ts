import { Queue, QueueEvents, Worker, type Job } from "bullmq";
import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { POST as confirmedRoute } from "@/app/api/n8n/booking-confirmed/route";
import { POST as failedRoute } from "@/app/api/n8n/booking-failed/route";
import { db } from "@/lib/db";
import { cancelBriefs } from "@/lib/n8n";
import { dispatchBackoff, redisConnection, type BookingJob } from "@/lib/queue/jobs";
import { startMockN8n } from "../scripts/mock-n8n";
import { createBookingProcessor, onFinalFailure } from "../worker/jobs/dispatch-booking";
import { postToN8n } from "../worker/lib/n8n";

// Booking → worker → (mock) n8n → callback → CONFIRMED, against real Redis + Postgres. No Google access needed.

const run = randomBytes(4).toString("hex");
const connection = { ...redisConnection(process.env.REDIS_URL!), maxRetriesPerRequest: null };
const cleanup: (() => Promise<unknown>)[] = [];
const bookingIds: string[] = [];

let slot = 0;
async function makeBooking(status: "PENDING_MEET" | "CONFIRMED" | "CANCELLED" = "PENDING_MEET") {
  slot += 1;
  const startsAt = new Date(Date.UTC(2099, 1, 1 + Math.floor(Math.random() * 300), 3, slot * 30));
  const booking = await db.booking.create({
    data: {
      token: randomBytes(32).toString("base64url"),
      name: "Dispatch Test",
      email: `dispatch-${run}@example.test`,
      purpose: "FREELANCE",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60_000),
      status,
    },
  });
  bookingIds.push(booking.id);
  return booking;
}

/** Isolated queue + worker + mock n8n per test (fast backoff: 40 ms instead of 10 s…10 min). */
let rigs = 0;
async function rig(statuses: number[]) {
  const name = `test-booking-${run}-${++rigs}`;
  const mock = await startMockN8n(statuses);
  const queue = new Queue<BookingJob>(name, { connection });
  const events = new QueueEvents(name, { connection });
  const alerts: string[] = [];
  const worker = new Worker<BookingJob>(
    name,
    createBookingProcessor({ baseUrl: mock.url, secret: "test-webhook-secret", appUrl: "https://example.test" }),
    { connection, settings: { backoffStrategy: (n: number) => dispatchBackoff(n, [40, 40, 40, 40]) } },
  );
  onFinalFailure(worker, async (job: Job<BookingJob>) => alerts.push(`${job.name}:${job.data.bookingId}`));
  cleanup.push(async () => {
    await worker.close();
    await queue.obliterate({ force: true });
    await Promise.all([queue.close(), events.close(), mock.close()]);
  });
  return { mock, queue, events, alerts };
}

const callback = (route: (req: Request) => Promise<Response>, body: unknown, secret = process.env.N8N_CALLBACK_SECRET!) =>
  route(new Request("http://app/api/n8n", { method: "POST", headers: { "x-callback-secret": secret }, body: JSON.stringify(body) }));

afterAll(async () => {
  for (const close of cleanup) await close();
  for (const id of bookingIds) await cancelBriefs(id);
  await db.reminder.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await db.booking.deleteMany({ where: { id: { in: bookingIds } } });
});

describe("postToN8n", () => {
  it("sends the secret header; 5xx/408/429 retry, other 4xx are permanent", async () => {
    const mock = await startMockN8n([200, 500, 429, 401]);
    cleanup.push(mock.close);
    const send = () => postToN8n({ baseUrl: mock.url, secret: "s3cret", path: "booking-created", body: { a: 1 } });
    await expect(send()).resolves.toBe(200);
    await expect(send()).rejects.toMatchObject({ name: "Error" });
    await expect(send()).rejects.toMatchObject({ name: "Error" });
    await expect(send()).rejects.toMatchObject({ name: "UnrecoverableError" });
    expect(mock.received[0]).toMatchObject({ path: "/webhook/booking-created", headers: { "x-webhook-secret": "s3cret" } });
  });
});

describe("dispatch → n8n → callback (Redis + DB + mock n8n)", () => {
  it("retries failures with backoff, then the callback confirms with the Meet link (idempotent)", async () => {
    const { mock, queue, events, alerts } = await rig([500, 503, 200]);
    const booking = await makeBooking();

    const job = await queue.add("dispatch-booking", { bookingId: booking.id }, { attempts: 5, backoff: { type: "custom" } });
    await expect(job.waitUntilFinished(events, 15_000)).resolves.toBe("sent");
    expect(mock.received).toHaveLength(3);
    expect(alerts).toEqual([]);
    expect(mock.received[2].body).toMatchObject({
      bookingId: booking.id,
      ownerTimezone: "Asia/Tashkent",
      visitor: { email: booking.email },
      manageUrl: `https://example.test/uz/booking/${booking.token}`,
    });

    const payload = { bookingId: booking.id, calendarEventId: "evt-1", meetUrl: "https://meet.google.com/abc-defg-hij" };
    expect((await callback(confirmedRoute, payload, "wrong")).status).toBe(401);
    expect((await callback(confirmedRoute, { ...payload, meetUrl: "javascript:alert(1)" })).status).toBe(400);
    expect(await (await callback(confirmedRoute, payload)).json()).toEqual({ result: "confirmed" });
    expect(await (await callback(confirmedRoute, payload)).json()).toEqual({ result: "unchanged" });

    const saved = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(saved).toMatchObject({ status: "CONFIRMED", meetUrl: payload.meetUrl, calendarEventId: "evt-1" });
    const briefs = await db.reminder.findMany({ where: { bookingId: booking.id }, orderBy: { remindAt: "asc" } });
    expect(briefs.map((r) => r.kind)).toEqual(["brief60", "brief15"]);
    expect(briefs[1].remindAt.getTime() - briefs[0].remindAt.getTime()).toBe(45 * 60_000);
  });

  it("alerts the owner once after the final attempt and keeps the booking PENDING_MEET", async () => {
    const { mock, queue, events, alerts } = await rig([503]);
    const booking = await makeBooking();

    const job = await queue.add("dispatch-booking", { bookingId: booking.id }, { attempts: 3, backoff: { type: "custom" } });
    await expect(job.waitUntilFinished(events, 15_000)).rejects.toThrow(/503/);
    await new Promise((r) => setTimeout(r, 100)); // let the "failed" listener run
    expect(mock.received).toHaveLength(3);
    expect(alerts).toEqual([`dispatch-booking:${booking.id}`]);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("PENDING_MEET");
    expect(await (await callback(failedRoute, { bookingId: booking.id, error: "Google quota" })).json()).toEqual({
      result: "kept_pending",
    });
  });

  it("does not retry a 4xx (wrong secret) and skips bookings that are no longer pending", async () => {
    const { mock, queue, events } = await rig([403]);
    const pending = await makeBooking();
    const failed = await queue.add("dispatch-booking", { bookingId: pending.id }, { attempts: 5, backoff: { type: "custom" } });
    await expect(failed.waitUntilFinished(events, 15_000)).rejects.toThrow(/403/);
    expect(mock.received).toHaveLength(1);

    const confirmed = await makeBooking("CONFIRMED");
    const skipped = await queue.add("dispatch-booking", { bookingId: confirmed.id }, { attempts: 5 });
    await expect(skipped.waitUntilFinished(events, 15_000)).resolves.toBe("skipped");
    expect(mock.received).toHaveLength(1);
  });

  it("ignores a confirmation for a booking cancelled meanwhile (keeps CANCELLED, stores the event id to delete it)", async () => {
    const booking = await makeBooking("CANCELLED");
    const payload = { bookingId: booking.id, calendarEventId: "evt-late", meetUrl: "https://meet.google.com/xyz-abcd-efg" };
    expect(await (await callback(confirmedRoute, payload)).json()).toEqual({ result: "ignored_cancelled" });
    const saved = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(saved).toMatchObject({ status: "CANCELLED", calendarEventId: "evt-late", meetUrl: null });
  });
});
