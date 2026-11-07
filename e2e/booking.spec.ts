import { expect, test, type Page, type Route } from "@playwright/test";
import { choose } from "./helpers";

// The whole booking flow in English with the API mocked (no real slots, DB writes, Turnstile or n8n),
// driven by keyboard where the radios/buttons allow it.

const TOKEN = "tok_e2e_0123456789";
const MEET = "https://meet.google.com/abc-defg-hij";

function slotsOn(daysAhead: number, hours: number[]) {
  return hours.map((h) => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + daysAhead);
    start.setUTCHours(h, 0, 0, 0);
    return { start: start.toISOString(), end: new Date(start.getTime() + 30 * 60_000).toISOString() };
  });
}

async function mockApi(page: Page, opts: { bookingStatus?: number; bookingBody?: object } = {}) {
  const slots = [...slotsOn(2, [6, 7, 8]), ...slotsOn(3, [6])];
  const posted: Record<string, unknown>[] = [];
  await page.route("**/api/availability*", (route) =>
    route.fulfill({ json: { slots, closed: false, closedDates: [] } }),
  );
  await page.route("**/api/bookings", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    posted.push(route.request().postDataJSON());
    await route.fulfill({ status: opts.bookingStatus ?? 201, json: opts.bookingBody ?? { token: TOKEN } });
  });
  await page.route(`**/api/bookings/${TOKEN}*`, (route) =>
    route.fulfill({ json: { status: "CONFIRMED", meetUrl: MEET } }),
  );
  return { slots, posted };
}

/** Steps 1 and 2 by keyboard. Leaves the form on the "Details" step. */
async function reachDetails(page: Page) {
  await page.goto("/en#booking");
  const purpose = page.getByRole("group", { name: "Purpose", exact: true });
  await expect(purpose).toBeVisible();

  await page.getByRole("radio", { name: "Job offer" }).focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Continue" }).focus();
  await page.keyboard.press("Enter");

  // focus follows the step change (keyboard and screen-reader users aren't left on a removed button)
  await expect(page.getByRole("group", { name: "Time", exact: true })).toBeFocused();
  await expect(page.getByText("Times are shown in your timezone")).toBeVisible();

  await page
    .getByRole("radio", { name: /^\d\d:\d\d$/ })
    .first()
    .focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Continue" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("group", { name: "Details", exact: true })).toBeFocused();
}

async function fillDetails(page: Page) {
  await page.getByLabel("Your name").fill("E2E Visitor");
  await page.getByLabel("Email", { exact: false }).first().fill("visitor@example.test");
  await page.getByLabel("Short note (optional)").fill("Playwright run");
}

test("books a slot with mocked availability and shows the Meet link", async ({ page }) => {
  const { slots, posted } = await mockApi(page);
  await reachDetails(page);
  await fillDetails(page);
  await page.getByRole("button", { name: "Confirm booking" }).click();

  await expect(page.getByRole("group", { name: "Done", exact: true })).toBeFocused();
  await expect(page.getByRole("heading", { name: "You're booked!" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Join the meeting" })).toHaveAttribute("href", MEET, { timeout: 10_000 });
  await expect(page.getByRole("link", { name: "Manage booking" })).toHaveAttribute("href", `/en/booking/${TOKEN}`);

  expect(posted).toHaveLength(1);
  expect(posted[0]).toMatchObject({
    purpose: "JOB_OFFER",
    name: "E2E Visitor",
    email: "visitor@example.test",
    note: "Playwright run",
    locale: "en",
    startsAt: slots[0].start,
  });
  expect(typeof posted[0].timezone).toBe("string");
  expect(posted[0].website ?? "").toBe(""); // honeypot untouched
});

test("validation: empty name and bad email are reported, nothing is sent", async ({ page }) => {
  const { posted } = await mockApi(page);
  await reachDetails(page);
  await page.getByLabel("Email", { exact: false }).first().fill("not-an-email");
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByText("This field is required")).toBeVisible();
  await expect(page.getByText("Invalid email")).toBeVisible();
  expect(posted).toHaveLength(0);
});

test("slot_taken sends the visitor back to the time step with a clear message", async ({ page }) => {
  await mockApi(page, { bookingStatus: 409, bookingBody: { error: "slot_taken" } });
  await reachDetails(page);
  await fillDetails(page);
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "That time was just taken" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Time", exact: true })).toBeFocused();
});

test("offline: a failed submit says so and keeps the entered data", async ({ page, context }) => {
  await mockApi(page);
  await reachDetails(page);
  await fillDetails(page);
  await context.setOffline(true);
  const offlineRoute = (route: Route) =>
    route.request().method() === "POST" ? route.abort("internetdisconnected") : route.fallback();
  await page.route("**/api/bookings", offlineRoute); // newest handler wins over the mock
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "You seem to be offline" })).toBeVisible();
  await expect(page.getByLabel("Your name")).toHaveValue("E2E Visitor");

  await context.setOffline(false);
  await page.unroute("**/api/bookings", offlineRoute);
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByRole("heading", { name: "You're booked!" })).toBeVisible();
});

test("availability failure offers a retry that works", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/availability*", (route) => {
    calls += 1;
    if (calls === 1) return route.fulfill({ status: 500, json: { error: "server_error" } });
    return route.fulfill({ json: { slots: slotsOn(2, [6]), closed: false, closedDates: [] } });
  });
  await page.goto("/en#booking");
  await choose(page, "Networking");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Could not complete the booking")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("radio", { name: /^\d\d:\d\d$/ })).toHaveCount(1);
});
