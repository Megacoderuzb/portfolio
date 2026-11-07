import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { connection } from "next/server";
import { route } from "@/lib/api";
import { recordEvent } from "@/lib/events";
import { clientIp, hashIp } from "@/lib/ip";
import { allow, limiter } from "@/lib/rate-limit";
import { getActiveResumeFile, resumePath } from "@/lib/resume";

const NOT_AVAILABLE =
  "Resume is not available yet. / Rezyume hali yuklanmagan. / Резюме пока не загружено.\n";

/** Streams the active resume PDF as a download. The stored file name/path never leaves the server. */
export const GET = route("api/resume", async (req: Request) => {
  await connection(); // request-time: never prerendered at build
  if (!(await allow(limiter("resume", 20, 60), hashIp(clientIp(req.headers))))) {
    return new Response("Too many requests\n", { status: 429 });
  }

  const file = await getActiveResumeFile();
  const filePath = file ? resumePath(file.filename) : null;
  const size = filePath ? (await stat(filePath).catch(() => null))?.size : undefined;
  if (!filePath || !size) {
    return new Response(NOT_AVAILABLE, { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  void recordEvent("RESUME_DOWNLOAD");
  return new Response(Readable.toWeb(createReadStream(filePath)) as ReadableStream, {
    headers: {
      "content-type": "application/pdf",
      "content-length": String(size),
      "content-disposition": 'attachment; filename="Muhammadjon-Abduvakhobov-CV.pdf"',
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
});
