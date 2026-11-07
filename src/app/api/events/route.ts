import { route } from "@/lib/api";
import { recordEvent } from "@/lib/events";
import { publicEventSchema } from "@/lib/events/public";
import { clientIp, hashIp } from "@/lib/ip";
import { allow, limiter } from "@/lib/rate-limit";

/** Public analytics beacon: whitelisted event types only, small bodies, 60 / min per IP. */
export const POST = route("api/events", async (req: Request) => {
  if (Number(req.headers.get("content-length") ?? 0) > 1024) return new Response(null, { status: 413 });
  if (!(await allow(limiter("events", 60, 60), hashIp(clientIp(req.headers))))) {
    return new Response(null, { status: 429 });
  }
  const parsed = publicEventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_event" }, { status: 400 });
  await recordEvent(parsed.data.type, parsed.data.meta);
  return new Response(null, { status: 204 });
});
