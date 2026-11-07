// Multi-host setup: site on abduvaxobov.uz, admin panel on admin.abduvaxobov.uz, public API on api.abduvaxobov.uz.
// One Next.js app serves all three (Nginx forwards the Host header); this module decides which paths each host
// may serve. Pure (no env reads) so it is unit-tested. Splitting is opt-in: with ADMIN_URL / NEXT_PUBLIC_API_URL
// unset (dev, tests, CI) everything is served on one host, as before.

export type HostConfig = {
  /** Host (with port, if any) of the public site, from APP_URL. */
  main?: string;
  /** Host of the admin panel, from ADMIN_URL. Unset = admin lives on the main host. */
  admin?: string;
  /** Host of the public API, from NEXT_PUBLIC_API_URL. Unset = API lives on the main host. */
  api?: string;
};

export type HostDecision = { action: "allow" } | { action: "notFound" } | { action: "redirect"; to: string };

const isAdminPath = (p: string) => p === "/admin" || p.startsWith("/admin/") || p.startsWith("/api/admin/");
const isApiPath = (p: string) => p === "/api" || p.startsWith("/api/");
const isHealth = (p: string) => p === "/api/health";

const hostOf = (url?: string) => {
  try {
    return url ? new URL(url).host.toLowerCase() : undefined;
  } catch {
    return undefined;
  }
};

/** Hosts from the three URLs (any may be missing). */
export const hostConfig = (urls: { app?: string; admin?: string; api?: string }): HostConfig => ({
  main: hostOf(urls.app),
  admin: hostOf(urls.admin),
  api: hostOf(urls.api),
});

/**
 * - admin host: the panel and its API (plus /api/health); everything else redirects to /admin
 * - api host: /api/* except the admin API; everything else is 404
 * - main host: the site; /admin and /api/* are 404 once they have their own host (health stays for monitoring)
 * - any other host (localhost, Docker-internal names such as app:3000 used by n8n): no restriction
 */
export function hostPolicy(host: string, pathname: string, cfg: HostConfig): HostDecision {
  const h = host.toLowerCase();
  if (cfg.admin && h === cfg.admin) {
    return isAdminPath(pathname) || isHealth(pathname) ? { action: "allow" } : { action: "redirect", to: "/admin" };
  }
  if (cfg.api && h === cfg.api) {
    return isApiPath(pathname) && !isAdminPath(pathname) ? { action: "allow" } : { action: "notFound" };
  }
  if (cfg.main && h === cfg.main) {
    if (cfg.admin && isAdminPath(pathname)) return { action: "notFound" };
    if (cfg.api && isApiPath(pathname) && !isHealth(pathname)) return { action: "notFound" };
  }
  return { action: "allow" };
}

/** Browser-side URL of an API path: the API host when NEXT_PUBLIC_API_URL is set (build time), else same origin. */
export const apiUrl = (path: string) => `${(process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "")}${path}`;

/**
 * CORS headers for a cross-origin browser call from the public site to the API host.
 * Only the site's own origin is allowed; no credentials are used (the API has no cookies).
 */
export function corsHeaders(origin: string | null, siteOrigin: string | undefined): Record<string, string> | null {
  if (!origin || !siteOrigin || origin !== siteOrigin) return null;
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-request-id",
    "access-control-expose-headers": "x-request-id",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}
