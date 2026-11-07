import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api";
import { availableDays } from "@/lib/booking";
import { clientIp, hashIp } from "@/lib/ip";
import { allow, limiter } from "@/lib/rate-limit";
import { daySpan } from "@/lib/time";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const query = z.object({ from: date, to: date }).refine((q) => daySpan(q.from, q.to) >= 1 && daySpan(q.from, q.to) <= 31);

/** ?date=YYYY-MM-DD or ?from=…&to=… (≤ 31 days), owner-calendar dates. Free slots only, never booking details. */
export const GET = route("api/availability", async (req: NextRequest) => {
  await connection();
  if (!(await allow(limiter("availability", 60, 60), hashIp(clientIp(req.headers))))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }
  const p = req.nextUrl.searchParams;
  const single = p.get("date");
  const parsed = query.safeParse({ from: single ?? p.get("from"), to: single ?? p.get("to") });
  if (!parsed.success) return Response.json({ error: "invalid_range" }, { status: 400 });

  const days = await availableDays(parsed.data.from, parsed.data.to);
  return Response.json(
    {
      slots: days.flatMap((d) => d.slots),
      closed: single ? days[0].closed : false,
      closedDates: days.filter((d) => d.closed).map((d) => d.date),
    },
    { headers: { "cache-control": "no-store" } },
  );
});
