import { expect, test, type APIRequestContext } from "@playwright/test";

const MARKER = "ma_breakout_best"; // appears only in the game chunk

async function scriptsWithMarker(request: APIRequestContext, urls: Iterable<string>) {
  const found: string[] = [];
  for (const url of urls) if ((await (await request.get(url)).text()).includes(MARKER)) found.push(url);
  return found;
}

test("game code is not downloaded until the footer approaches, then it mounts and plays", async ({ page, request }) => {
  const scripts = new Set<string>();
  page.on("response", (res) => {
    if (res.request().resourceType() === "script") scripts.add(res.url());
  });

  await page.goto("/en", { waitUntil: "networkidle" });
  expect(scripts.size).toBeGreaterThan(3);
  expect(await scriptsWithMarker(request, scripts)).toEqual([]);
  await expect(page.locator("#game canvas")).toHaveCount(0);

  const before = new Set(scripts);
  await page.locator("#game").scrollIntoViewIfNeeded();
  await expect(page.locator("#game canvas")).toBeVisible();
  const added = [...scripts].filter((u) => !before.has(u));
  expect((await scriptsWithMarker(request, added)).length).toBeGreaterThan(0);

  // start with the keyboard: Start overlay → Space → HUD shows Pause
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  await page.locator("#game canvas").focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.keyboard.press("p");
  await expect(page.getByRole("button", { name: "Resume" }).first()).toBeVisible();
});

test("the placeholder and the game have the same height (no layout shift)", async ({ page }) => {
  await page.goto("/en", { waitUntil: "networkidle" });
  const box = page.locator("#game .mt-4 > div");
  const placeholder = (await box.boundingBox())!.height;
  await page.locator("#game").scrollIntoViewIfNeeded();
  await expect(page.locator("#game canvas")).toBeVisible();
  expect((await box.boundingBox())!.height).toBeCloseTo(placeholder, 0);
});

test("'Skip the game' jumps past it, and the canvas leaves vertical scrolling to the page", async ({ page }) => {
  await page.goto("/en", { waitUntil: "networkidle" });
  await page.locator("#game").scrollIntoViewIfNeeded();
  await page.getByRole("link", { name: "Skip the game" }).click();
  await expect(page).toHaveURL(/#game-end$/);

  await expect(page.locator("#game canvas")).toHaveCSS("touch-action", "pan-y");
});
