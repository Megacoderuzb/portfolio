import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { failedSchema, hasCallbackSecret } from "@/lib/n8n";
import { log } from "@/lib/log";

/**
 * n8n → app when Calendar/Meet creation failed. The booking stays PENDING_MEET (admin shows "Retry dispatch");
 * n8n itself alerts the owner on Telegram. Idempotent: it changes nothing.
 */
export const POST = route("api/n8n/booking-failed", async (req: Request) => {
  if (!hasCallbackSecret(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = failedSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const exists = await db.booking.count({ where: { id: parsed.data.bookingId } });
  if (!exists) return Response.json({ error: "not_found" }, { status: 404 });
  // the id only: n8n's error text can echo visitor details (see n8n → Executions for the cause)
  log.warn("n8n.booking_failed", { bookingId: parsed.data.bookingId });
  return Response.json({ result: "kept_pending" });
});
