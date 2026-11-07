import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";

// The exclusion constraint (migration booking_no_overlap) is the last line of defence against double booking.
const tag = `test-${randomBytes(6).toString("hex")}`;
// far future + random hour so parallel runs don't collide
const base = Date.UTC(2099, 0, 1 + Math.floor(Math.random() * 300), 5);
const at = (minutes: number) => new Date(base + minutes * 60_000);

const book = (startMin: number, endMin: number, status: "CONFIRMED" | "CANCELLED" = "CONFIRMED") =>
  db.booking.create({
    data: {
      token: `${tag}-${randomBytes(8).toString("hex")}`,
      name: "Test",
      email: "test@example.com",
      purpose: "OTHER",
      startsAt: at(startMin),
      endsAt: at(endMin),
      status,
    },
  });

afterAll(async () => {
  await db.booking.deleteMany({ where: { token: { startsWith: tag } } });
});

describe("booking_no_overlap constraint", () => {
  it("rejects two overlapping non-cancelled bookings with 23P01", async () => {
    await book(0, 30);
    const error = await book(15, 45).catch((e: unknown) => e);
    expect(String((error as Error)?.message) + JSON.stringify(error)).toMatch(/23P01|booking_no_overlap/);
  });

  it("allows back-to-back bookings ([) range)", async () => {
    await expect(book(30, 60)).resolves.toBeTruthy();
  });

  it("does not let a cancelled booking block the slot", async () => {
    await book(120, 150, "CANCELLED");
    await expect(book(120, 150)).resolves.toBeTruthy();
  });
});
