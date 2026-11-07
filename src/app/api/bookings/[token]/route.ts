import { connection, type NextRequest } from "next/server";
import { route } from "@/lib/api";
import { getPublicBooking } from "@/lib/booking";
import { clientIp, hashIp } from "@/lib/ip";
import { allow, limiter } from "@/lib/rate-limit";

const LOCALES = ["uz", "ru", "en"] as const;

/** The visitor's own booking, by its secret token (status, times, Meet link). Polled by the success card. */
export const GET = route("api/bookings/:token", async (req: NextRequest, ctx: RouteContext<"/api/bookings/[token]">) => {
  await connection();
  if (!(await allow(limiter("booking-view", 120, 60), hashIp(clientIp(req.headers))))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }
  const requested = req.nextUrl.searchParams.get("locale");
  const locale = LOCALES.find((l) => l === requested) ?? "en";
  const booking = await getPublicBooking((await ctx.params).token, locale);
  if (!booking) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(booking, { headers: { "cache-control": "no-store" } });
});
