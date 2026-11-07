import { connection } from "next/server";
import { route } from "@/lib/api";
import { hasCallbackSecret } from "@/lib/n8n";
import { weeklyStats } from "@/lib/stats";

/** Weekly summary numbers for the n8n `weekly-summary` workflow (X-Callback-Secret). */
export const GET = route("api/n8n/stats", async (req: Request) => {
  await connection();
  if (!hasCallbackSecret(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await weeklyStats(), { headers: { "cache-control": "no-store" } });
});
