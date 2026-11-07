import { expect, test } from "@playwright/test";
import { E2E_ADMIN } from "./env";

test("admin pages redirect to the login screen without a session", async ({ page }) => {
  for (const path of ["/admin", "/admin/bookings", "/admin/resume"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login$/);
  }
  await expect(page.getByRole("heading", { level: 1, name: "Admin" })).toBeVisible();
});

test("admin API refuses anonymous and cross-origin requests", async ({ request }) => {
  const anonymous = await request.get("/api/admin/anything");
  expect(anonymous.status()).toBe(401);
  const crossOrigin = await request.post("/api/admin/anything", { headers: { origin: "https://evil.example" } });
  expect(crossOrigin.status()).toBe(403);
});

test("owner can sign in and reach the dashboard (no CSP violations on the way)", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && /Content Security Policy/i.test(msg.text())) violations.push(msg.text());
  });
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 }); // bcrypt + redis + redirect: slow on a busy machine
  await page.goto("/admin/bookings");
  await expect(page).toHaveURL(/\/admin\/bookings$/);
  expect(violations).toEqual([]);
});

test("/api/resume: PDF attachment when a resume is active, friendly 404 otherwise", async ({ request }) => {
  const res = await request.get("/api/resume");
  expect(res.headers()["x-request-id"]).toBeTruthy();
  if (res.status() === 200) {
    expect(res.headers()["content-type"]).toBe("application/pdf");
    expect(res.headers()["content-disposition"]).toContain("attachment");
    expect((await res.body()).subarray(0, 4).toString()).toBe("%PDF");
  } else {
    expect(res.status()).toBe(404);
    expect(await res.text()).toContain("Resume is not available");
  }
});
