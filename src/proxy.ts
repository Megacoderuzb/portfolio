import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { corsHeaders, hostConfig, hostPolicy } from "@/lib/hosts";

// Locale negotiation: NEXT_LOCALE cookie → Accept-Language → "uz". Sets the cookie when the URL locale changes.
const intl = createMiddleware(routing);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const NOINDEX = { "x-robots-tag": "noindex, nofollow" };

const isAdminPath = (p: string) => p === "/admin" || p.startsWith("/admin/") || p.startsWith("/api/admin/");

/** Runs per request: the hosts come from env (APP_URL, ADMIN_URL, NEXT_PUBLIC_API_URL). */
const hosts = () =>
  hostConfig({ app: process.env.APP_URL, admin: process.env.ADMIN_URL, api: process.env.NEXT_PUBLIC_API_URL });

async function handle(req: NextRequest, host: string, cfg: ReturnType<typeof hosts>) {
  const { pathname } = req.nextUrl;

  if (isAdminPath(pathname)) {
    // CSRF: a mutating admin request must come from a page on this host (SameSite=Lax cookie is the other half).
    // Compares hosts, not origins: behind Nginx the app itself sees plain http.
    if (!SAFE_METHODS.has(req.method)) {
      const origin = req.headers.get("origin");
      if (!origin || URL.parse(origin)?.host !== req.headers.get("host")) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }
    if (pathname === "/admin/login") return NextResponse.next();
    if (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    // On the API host the browser calls come from the site's origin: answer the preflight, allow only that origin.
    const cors =
      cfg.api && host === cfg.api
        ? corsHeaders(req.headers.get("origin"), URL.parse(process.env.APP_URL ?? "")?.origin)
        : null;
    const res = req.method === "OPTIONS" ? new NextResponse(null, { status: 204 }) : NextResponse.next();
    for (const [key, value] of Object.entries(cors ?? {})) res.headers.set(key, value);
    return res;
  }

  return intl(req);
}

export default async function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase();
  const cfg = hosts();
  const decision = hostPolicy(host, req.nextUrl.pathname, cfg);

  if (decision.action === "notFound") return new NextResponse("Not found", { status: 404, headers: NOINDEX });
  if (decision.action === "redirect") return NextResponse.redirect(new URL(decision.to, req.url));

  const res = await handle(req, host, cfg);
  // the admin panel and the API are not pages to index
  if (host === cfg.admin || host === cfg.api) {
    for (const [key, value] of Object.entries(NOINDEX)) res.headers.set(key, value);
  }
  return res;
}

export const config = {
  matcher: [
    // everything except Next internals and files (sitemap.xml, robots.txt…); includes /api and /admin
    "/((?!_next|_vercel|.*\\..*).*)",
  ],
};
