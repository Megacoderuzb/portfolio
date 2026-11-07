import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { seed } from "../seed/seed";

describe("seed (dev database)", () => {
  it("is idempotent and never overwrites existing rows", async () => {
    await seed(); // may create rows on a fresh DB
    const before = await db.project.findMany({ select: { slug: true, updatedAt: true }, orderBy: { slug: "asc" } });

    const second = await seed();
    expect(second.created).toBe(0);
    expect(second.updated).toBe(0);

    const after = await db.project.findMany({ select: { slug: true, updatedAt: true }, orderBy: { slug: "asc" } });
    expect(after).toEqual(before);
  });
});
