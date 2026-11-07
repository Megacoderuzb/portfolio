import type { Page } from "@playwright/test";

export const LOCALES = ["uz", "ru", "en"] as const;

/**
 * Scroll entrances start hidden (opacity 0) until an element is a fifth visible. For checks that read the whole
 * page (axe contrast, text content) mark everything as shown and let the 0.6 s transition finish.
 */
export async function revealAll(page: Page) {
  await page.evaluate(() =>
    document.querySelectorAll("[data-reveal]").forEach((el) => el.setAttribute("data-shown", "")),
  );
  await page.waitForTimeout(1100);
}

/** The radios are visually hidden (sr-only); a real click goes through their visible label. */
export const choose = (page: Page, name: string | RegExp) =>
  page.getByRole("radio", { name }).locator("xpath=ancestor::label").click();
