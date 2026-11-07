import { expect, test } from "@playwright/test";
import { LOCALES, revealAll } from "./helpers";

for (const locale of LOCALES) {
  test.describe(`landing /${locale}`, () => {
    test("renders with one h1, landmarks and no raw message keys", async ({ page }) => {
      const response = await page.goto(`/${locale}`);
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("navigation", { name: /./ }).first()).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeVisible();

      await revealAll(page);
      const text = await page.locator("body").innerText();
      // next-intl shows the key path ("hero.title") when a message is missing
      expect(text).not.toMatch(
        /\b(hero|nav|about|stack|projects|services|booking|manage|contact|footer|common)\.[a-z][\w.]*\b/,
      );
    });

    test("has canonical, hreflang (+ x-default), Open Graph and Twitter tags in <head>", async ({ page }) => {
      await page.goto(`/${locale}`);
      // the metadata must be in <head> (streamed-after-</head> metadata is invisible to crawlers that skip JS)
      const inHead = await page.evaluate(() => ({
        title: !!document.head.querySelector("title"),
        description: !!document.head.querySelector('meta[name="description"]'),
        canonical: !!document.head.querySelector('link[rel="canonical"]'),
        ogImage: !!document.head.querySelector('meta[property="og:image"]'),
      }));
      expect(inHead).toEqual({ title: true, description: true, canonical: true, ogImage: true });

      // the origin is fixed at build time (APP_URL): assert paths and that every URL shares one origin
      const canonical = new URL((await page.locator('link[rel="canonical"]').getAttribute("href"))!);
      expect(canonical.pathname).toBe(`/${locale}`);
      const alternates = await page
        .locator('link[rel="alternate"][hreflang]')
        .evaluateAll((els) =>
          Object.fromEntries(
            els.map((el) => [
              el.getAttribute("hreflang"),
              new URL(el.getAttribute("href")!).pathname + "|" + new URL(el.getAttribute("href")!).origin,
            ]),
          ),
        );
      expect(alternates).toEqual({
        uz: `/uz|${canonical.origin}`,
        ru: `/ru|${canonical.origin}`,
        en: `/en|${canonical.origin}`,
        "x-default": `/uz|${canonical.origin}`,
      });
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{40,}/);
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /Muhammadjon Abduvakhobov/);
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        "content",
        new RegExp(`^${canonical.origin}/${locale}/opengraph-image`),
      );
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
      await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", /twitter-image/);
    });

    test("JSON-LD Person is valid and complete", async ({ page }) => {
      await page.goto(`/${locale}`);
      const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
      const person = JSON.parse(raw ?? "{}");
      expect(person).toMatchObject({ "@type": "Person", name: "Muhammadjon Abduvakhobov" });
      expect(person.jobTitle).toBeTruthy();
      expect(person.sameAs).toHaveLength(3);
      for (const url of person.sameAs) expect(url).toMatch(/^https:\/\//);
      expect(person.knowsAbout).toContain("NestJS");
    });

    test("OG image is a 1200×630 PNG", async ({ page, request }) => {
      await page.goto(`/${locale}`);
      const href = await page.locator('meta[property="og:image"]').getAttribute("content");
      const res = await request.get(new URL(href!).pathname + new URL(href!).search); // via baseURL: the build origin may differ
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toBe("image/png");
      const png = await res.body();
      expect(png.readUInt32BE(16)).toBe(1200); // IHDR width
      expect(png.readUInt32BE(20)).toBe(630); // IHDR height
    });

    test("no horizontal scroll at 360 px", async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto(`/${locale}`);
      await revealAll(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}

test("unknown URL gives a localized 404 page with a 404 status", async ({ page }) => {
  const expected = { uz: "Sahifa topilmadi", ru: "Страница не найдена", en: "Page not found" };
  for (const locale of LOCALES) {
    const response = await page.goto(`/${locale}/no-such-page`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(expected[locale]);
    await expect(page.getByRole("link", { name: /./ }).first()).toBeVisible(); // navbar still there
  }
});
