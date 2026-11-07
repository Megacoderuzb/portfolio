import { describe, expect, it } from "vitest";
import { localize } from "@/lib/content";
import seed from "../seed/seed-data.json";
import translations from "../seed/translations.json";

describe("localize", () => {
  const content = {
    en: { title: "Hello", summary: "English summary", highlights: ["a"] },
    ru: { title: "Привет", summary: "", highlights: [] },
  };

  it("falls back to English when the locale is missing", () => {
    expect(localize(content, "uz")).toEqual(content.en);
  });

  it("falls back field by field when a translated field is empty", () => {
    expect(localize(content, "ru")).toEqual({ title: "Привет", summary: "English summary", highlights: ["a"] });
  });
});

describe("seed translations", () => {
  it.each(["uz", "ru"] as const)("cover every visible project and service in %s, flagged for review", (locale) => {
    const projects = translations.projects as Record<string, Record<string, unknown>>;
    const services = translations.services as Record<string, Record<string, unknown>>;
    for (const p of seed.projects.filter((p) => p.visible)) {
      expect(projects[p.slug]?.[locale], p.slug).toBeDefined();
      expect(projects[p.slug]?._review, p.slug).toBe(true);
    }
    for (const s of seed.services) {
      expect(services[s.slug]?.[locale], s.slug).toBeDefined();
      expect(services[s.slug]?._review, s.slug).toBe(true);
    }
  });
});
