import { route } from "@/lib/api";
import { cancelBookingByToken } from "@/lib/booking";
import { clientIp, hashIp } from "@/lib/ip";
import { cancelBriefs } from "@/lib/n8n";
import { enqueueBookingJob } from "@/lib/queue";
import { allow, limiter } from "@/lib/rate-limit";

/** Cancels the visitor's booking (idempotent); the worker then removes the Calendar event via n8n. */
export const POST = route("api/bookings/:token/cancel", async (req: Request, ctx: RouteContext<"/api/bookings/[token]/cancel">) => {
  if (!(await allow(limiter("booking-cancel", 20, 60), hashIp(clientIp(req.headers))))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }
  const result = await cancelBookingByToken((await ctx.params).token);
  if (!result) return Response.json({ error: "not_found" }, { status: 404 });
  if (result.changed) {
    await cancelBriefs(result.id);
    await enqueueBookingJob("cancel-booking", result.id, { cancelledBy: "visitor" });
  }
  return Response.json({ status: result.status });
});
