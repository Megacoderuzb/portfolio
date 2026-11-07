import { describe, expect, it } from "vitest";
import { apiUrl, corsHeaders, hostConfig, hostPolicy } from "@/lib/hosts";

const split = hostConfig({
  app: "https://abduvaxobov.uz",
  admin: "https://admin.abduvaxobov.uz",
  api: "https://api.abduvaxobov.uz",
});
const ALLOW = { action: "allow" };
const NOT_FOUND = { action: "notFound" };

describe("hostPolicy: site, admin and API on their own hosts", () => {
  it.each([
    // main site: pages yes, admin and API no (health stays for monitoring)
    ["abduvaxobov.uz", "/uz", ALLOW],
    ["abduvaxobov.uz", "/en/booking/abc", ALLOW],
    ["abduvaxobov.uz", "/admin", NOT_FOUND],
    ["abduvaxobov.uz", "/admin/bookings", NOT_FOUND],
    ["abduvaxobov.uz", "/api/admin/anything", NOT_FOUND],
    ["abduvaxobov.uz", "/api/bookings", NOT_FOUND],
    ["abduvaxobov.uz", "/api/resume", NOT_FOUND],
    ["abduvaxobov.uz", "/api/health", ALLOW],
    // admin host: the panel only; anything else goes to /admin
    ["admin.abduvaxobov.uz", "/admin", ALLOW],
    ["admin.abduvaxobov.uz", "/admin/login", ALLOW],
    ["admin.abduvaxobov.uz", "/api/admin/x", ALLOW],
    ["admin.abduvaxobov.uz", "/api/health", ALLOW],
    ["admin.abduvaxobov.uz", "/", { action: "redirect", to: "/admin" }],
    ["admin.abduvaxobov.uz", "/uz", { action: "redirect", to: "/admin" }],
    ["admin.abduvaxobov.uz", "/api/bookings", { action: "redirect", to: "/admin" }],
    // API host: public API only
    ["api.abduvaxobov.uz", "/api/bookings", ALLOW],
    ["api.abduvaxobov.uz", "/api/availability", ALLOW],
    ["api.abduvaxobov.uz", "/api/health", ALLOW],
    ["api.abduvaxobov.uz", "/api/n8n/booking-confirmed", ALLOW],
    ["api.abduvaxobov.uz", "/api/admin/x", NOT_FOUND],
    ["api.abduvaxobov.uz", "/admin", NOT_FOUND],
    ["api.abduvaxobov.uz", "/uz", NOT_FOUND],
    ["api.abduvaxobov.uz", "/", NOT_FOUND],
  ])("%s %s", (host, path, expected) => {
    expect(hostPolicy(host, path, split)).toEqual(expected);
  });

  it("host matching is case-insensitive", () => {
    expect(hostPolicy("ADMIN.Abduvaxobov.UZ", "/admin", split)).toEqual(ALLOW);
    expect(hostPolicy("Api.abduvaxobov.uz", "/uz", split)).toEqual(NOT_FOUND);
  });

  it("unknown hosts (localhost, Docker-internal app:3000 used by n8n) are unrestricted", () => {
    for (const host of ["localhost:3000", "app:3000", "127.0.0.1:3000", "evil.example"]) {
      for (const path of ["/admin", "/api/bookings", "/api/n8n/booking-confirmed", "/uz"]) {
        expect(hostPolicy(host, path, split)).toEqual(ALLOW);
      }
    }
  });
});

describe("hostPolicy: splitting is opt-in", () => {
  it("nothing configured: everything is served everywhere", () => {
    const none = hostConfig({ app: "http://localhost:3100" });
    for (const path of ["/uz", "/admin", "/api/bookings", "/api/admin/x"]) {
      expect(hostPolicy("localhost:3100", path, none)).toEqual(ALLOW);
    }
  });

  it("only the admin split: the main host keeps its API, loses /admin", () => {
    const adminOnly = hostConfig({ app: "https://a.uz", admin: "https://admin.a.uz" });
    expect(hostPolicy("a.uz", "/api/bookings", adminOnly)).toEqual(ALLOW);
    expect(hostPolicy("a.uz", "/admin", adminOnly)).toEqual(NOT_FOUND);
  });

  it("only the API split: the main host keeps /admin, loses the API", () => {
    const apiOnly = hostConfig({ app: "https://a.uz", api: "https://api.a.uz" });
    expect(hostPolicy("a.uz", "/admin", apiOnly)).toEqual(ALLOW);
    expect(hostPolicy("a.uz", "/api/bookings", apiOnly)).toEqual(NOT_FOUND);
  });

  it("ignores malformed URLs instead of throwing", () => {
    expect(hostConfig({ app: "not a url", admin: "", api: undefined })).toEqual({
      main: undefined,
      admin: undefined,
      api: undefined,
    });
  });
});

describe("corsHeaders", () => {
  it("allows exactly the site origin, without credentials", () => {
    const h = corsHeaders("https://abduvaxobov.uz", "https://abduvaxobov.uz")!;
    expect(h["access-control-allow-origin"]).toBe("https://abduvaxobov.uz");
    expect(h["access-control-allow-methods"]).toBe("GET, POST, OPTIONS");
    expect(h["access-control-allow-headers"]).toContain("content-type");
    expect(h["access-control-expose-headers"]).toBe("x-request-id");
    expect(h.vary).toBe("Origin");
    expect(Object.keys(h)).not.toContain("access-control-allow-credentials");
  });

  it.each([
    ["https://evil.example", "https://abduvaxobov.uz"],
    ["https://abduvaxobov.uz.evil.example", "https://abduvaxobov.uz"],
    ["http://abduvaxobov.uz", "https://abduvaxobov.uz"], // scheme matters
    ["https://admin.abduvaxobov.uz", "https://abduvaxobov.uz"], // the admin host is not the site
    [null, "https://abduvaxobov.uz"],
    ["https://abduvaxobov.uz", undefined],
  ])("refuses origin %s (site %s)", (origin, site) => {
    expect(corsHeaders(origin, site)).toBeNull();
  });
});

describe("apiUrl", () => {
  it("is same-origin when NEXT_PUBLIC_API_URL is not set", () => {
    expect(apiUrl("/api/bookings")).toBe("/api/bookings");
  });
});
