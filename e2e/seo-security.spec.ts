import { expect, test } from "@playwright/test";
import { LOCALES, revealAll } from "./helpers";

test("robots.txt blocks admin, api and manage pages and points at the sitemap", async ({ request, baseURL }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text).toContain("Allow: /");
  for (const path of ["/admin", "/api", "/*/booking/"]) expect(text).toContain(`Disallow: ${path}`);
  expect(text).toContain(`Sitemap: ${baseURL}/sitemap.xml`);
});

test("sitemap.xml lists every locale with alternates and nothing private", async ({ request, baseURL }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const xml = await res.text();
  for (const locale of LOCALES) expect(xml).toContain(`<loc>${baseURL}/${locale}</loc>`);
  expect(xml).toContain('hreflang="x-default"');
  expect(xml).not.toMatch(/admin|booking|api/);
});

test("security headers on pages: CSP (Turnstile only), nosniff, referrer, permissions, frame ancestors", async ({
  request,
}) => {
  const headers = (await request.get("/en")).headers();
  const csp = headers["content-security-policy"];
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'self'");
  expect(csp).toContain("form-action 'self'");
  // the only external origin anywhere in the policy is Cloudflare Turnstile
  const origins = new Set(csp.match(/https?:\/\/[^\s;]+/g));
  expect([...origins]).toEqual(["https://challenges.cloudflare.com"]);
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("security headers also cover API responses", async ({ request }) => {
  const headers = (await request.get("/api/health")).headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
});

test("the site, game and booking flow run under the CSP without violations", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (/Content Security Policy|Refused to/i.test(msg.text())) violations.push(msg.text());
  });
  page.on("pageerror", (e) => violations.push(`pageerror: ${e.message}`));
  for (const locale of LOCALES) {
    await page.goto(`/${locale}`, { waitUntil: "networkidle" });
    await revealAll(page);
    await page.locator("#game").scrollIntoViewIfNeeded();
    await expect(page.locator("#game canvas")).toBeVisible();
  }
  expect(violations).toEqual([]);
});

test("static assets are cached immutably", async ({ page, request }) => {
  const urls: string[] = [];
  page.on("response", (res) => {
    if (res.url().includes("/_next/static/")) urls.push(res.url());
  });
  await page.goto("/en", { waitUntil: "networkidle" });
  expect(urls.length).toBeGreaterThan(3);
  const res = await request.get(urls[0]);
  expect(res.headers()["cache-control"]).toMatch(/immutable/);
});

test("API errors carry a request id in the header and the body; unexpected input never leaks internals", async ({
  request,
}) => {
  const res = await request.post("/api/events", { data: { type: "NOT_A_REAL_EVENT" } });
  expect(res.status()).toBe(400);
  const id = res.headers()["x-request-id"];
  expect(id).toMatch(/^[\w-]{8,64}$/);
  expect(await res.json()).toEqual({ error: "invalid_event", requestId: id });

  const mine = await request.get("/api/availability?from=bad&to=bad", {
    headers: { "x-request-id": "e2e-request-id-12345" },
  });
  expect(mine.headers()["x-request-id"]).toBe("e2e-request-id-12345");

  const hostile = await request.get("/api/availability?from=bad&to=bad", {
    headers: { "x-request-id": "bad id with spaces <script>" },
  });
  expect(hostile.headers()["x-request-id"]).toMatch(/^[\w-]{8,64}$/);
});

test("/api/health reports db, redis and the worker heartbeat", async ({ request }) => {
  const res = await request.get("/api/health");
  const body = await res.json();
  expect(body).toMatchObject({ ok: true, db: true, redis: true });
  expect(body.worker).toHaveProperty("ok");
  expect(body.worker).toHaveProperty("lastBeat");
});
