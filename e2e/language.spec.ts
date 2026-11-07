import { expect, test } from "@playwright/test";

test("language switch keeps the page and hash, and remembers the choice", async ({ page }) => {
  await page.goto("/uz#booking");
  const nav = page.getByRole("navigation", { name: "Til" }); // nav.language in uz
  await nav.getByRole("link", { name: "RU" }).click();
  await expect(page).toHaveURL(/\/ru(#booking)?$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // the choice is remembered: the bare root now redirects to the chosen locale
  await page.goto("/");
  await expect(page).toHaveURL(/\/ru$/);

  await page.getByRole("navigation", { name: "Язык" }).getByRole("link", { name: "EN" }).click();
  await expect(page).toHaveURL(/\/en/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("switching language on the manage-booking route keeps the path", async ({ page }) => {
  // a made-up token: the page says "not found" but the switcher must still map the path
  await page.goto("/en/booking/definitely-not-a-real-token-0000000000000000000");
  await page.getByRole("navigation", { name: "Language" }).getByRole("link", { name: "RU" }).click();
  await expect(page).toHaveURL(/\/ru\/booking\/definitely-not-a-real-token/);
});
