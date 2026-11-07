import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { choose, LOCALES, revealAll } from "./helpers";

// axe-core on the key pages in all three locales (WCAG 2.0/2.1 A + AA and best practices), plus keyboard flows.
// Scroll entrances are forced visible first: axe measures contrast on what is painted, and a half-faded element
// would give false results.

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  // readable failure message: rule, impact, where
  return results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes
        .map((n) => n.target.join(" "))
        .slice(0, 4)
        .join(" | ")}`,
  );
}

for (const locale of LOCALES) {
  test(`axe: landing /${locale} (including the lazily mounted game)`, async ({ page }) => {
    await page.goto(`/${locale}`, { waitUntil: "networkidle" });
    await page.locator("#game").scrollIntoViewIfNeeded();
    await expect(page.locator("#game canvas")).toBeVisible();
    await revealAll(page);
    expect(await scan(page)).toEqual([]);
  });

  test(`axe: localized 404 /${locale}`, async ({ page }) => {
    await page.goto(`/${locale}/no-such-page`);
    await revealAll(page);
    expect(await scan(page)).toEqual([]);
  });
}

test("axe: booking steps (time list and details form)", async ({ page }) => {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 2);
  start.setUTCHours(6, 0, 0, 0);
  const slot = { start: start.toISOString(), end: new Date(start.getTime() + 30 * 60_000).toISOString() };
  await page.route("**/api/availability*", (route) =>
    route.fulfill({ json: { slots: [slot], closed: false, closedDates: [] } }),
  );

  await page.goto("/en#booking");
  await revealAll(page);
  expect(await scan(page)).toEqual([]);

  await choose(page, "Job offer");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("radio", { name: /^\d\d:\d\d$/ })).toHaveCount(1);
  expect(await scan(page)).toEqual([]);

  await page.getByRole("radio", { name: /^\d\d:\d\d$/ }).check({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Your name")).toBeVisible();
  await page.getByRole("button", { name: "Confirm booking" }).click(); // shows the field errors
  await expect(page.getByText("This field is required").first()).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test("axe: admin login", async ({ page }) => {
  await page.goto("/admin/login");
  expect(await scan(page)).toEqual([]);
});

test("keyboard: the skip link is the first stop and moves focus to the main content", async ({ page }) => {
  await page.goto("/en");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("keyboard: every interactive element on the landing shows a visible focus indicator", async ({ page }) => {
  await page.goto("/en", { waitUntil: "networkidle" });
  await revealAll(page);
  const missing: string[] = [];
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
      const shadow = style.boxShadow !== "none";
      // radios are visually hidden: their styled sibling shows the ring (peer-focus-visible)
      const peer = el.matches("input.sr-only") ? getComputedStyle(el.nextElementSibling as Element) : null;
      const peerRing = !!peer && peer.outlineStyle !== "none" && parseFloat(peer.outlineWidth) > 0;
      const visible = el.getBoundingClientRect().width > 0;
      return {
        tag: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} "${(el.textContent ?? "").trim().slice(0, 24)}"`,
        ok: outline || shadow || peerRing,
        visible,
      };
    });
    if (info && info.visible && !info.ok) missing.push(info.tag);
  }
  expect([...new Set(missing)]).toEqual([]);
});

test("keyboard: the mobile menu traps focus, closes on Escape and returns focus to its button", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/en");
  const open = page.getByRole("button", { name: "Menu" });
  await open.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Tab many times: focus may cycle through the browser UI (document.body) but must never land on the page
  // content behind the modal
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const where = await page.evaluate(() => {
      const el = document.activeElement;
      return !el || el === document.body || !!el.closest("dialog") ? "ok" : el.tagName + (el.id ? "#" + el.id : "");
    });
    expect(where).toBe("ok");
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
});
