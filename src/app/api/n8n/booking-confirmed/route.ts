import { route } from "@/lib/api";
import { confirmBooking, confirmedSchema, hasCallbackSecret } from "@/lib/n8n";

/** n8n → app after the Calendar event + Meet link exist. Idempotent. */
export const POST = route("api/n8n/booking-confirmed", async (req: Request) => {
  if (!hasCallbackSecret(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = confirmedSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const result = await confirmBooking(parsed.data);
  return Response.json({ result }, { status: result === "not_found" ? 404 : 200 });
});
