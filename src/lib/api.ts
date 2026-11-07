import { randomUUID } from "node:crypto";
import { errorLabel, log } from "@/lib/log";

// Wrapper for route handlers: every response carries `x-request-id`, error bodies carry `requestId` (so a visitor
// can quote it and the log line is findable), failures and slow requests are logged, and an unexpected throw
// becomes a clean 500 instead of a stack trace.

const SLOW_MS = 1500;

/** Reuses a sane incoming id (reverse proxy) or makes a new one; never trusts arbitrary header content. */
function requestId(req: Request) {
  const given = req.headers.get("x-request-id");
  return given && /^[\w-]{8,64}$/.test(given) ? given : randomUUID();
}

async function withId(res: Response, id: string) {
  const headers = new Headers(res.headers);
  headers.set("x-request-id", id);
  if (res.status >= 400 && headers.get("content-type")?.includes("application/json")) {
    const body: unknown = await res
      .clone()
      .json()
      .catch(() => null);
    if (body && typeof body === "object" && !Array.isArray(body)) {
      headers.delete("content-length");
      return new Response(JSON.stringify({ ...body, requestId: id }), { status: res.status, headers });
    }
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export function route<Req extends Request, Ctx>(
  name: string,
  handler: (req: Req, ctx: Ctx) => Promise<Response> | Response,
) {
  // ctx is optional so tests (and plain callers) can invoke a handler with just a Request
  return async (req: Req, ctx?: Ctx): Promise<Response> => {
    const id = requestId(req);
    const started = Date.now();
    let res: Response;
    try {
      res = await handler(req, ctx as Ctx);
    } catch (e) {
      log.error("api.unhandled", { route: name, requestId: id, error: errorLabel(e) });
      res = Response.json({ error: "server_error" }, { status: 500 });
    }
    const ms = Date.now() - started;
    if (res.status >= 500) log.error("api.error", { route: name, requestId: id, status: res.status, ms });
    else if (res.status >= 400) log.warn("api.rejected", { route: name, requestId: id, status: res.status, ms });
    else if (ms > SLOW_MS) log.warn("api.slow", { route: name, requestId: id, status: res.status, ms });
    return withId(res, id);
  };
}
