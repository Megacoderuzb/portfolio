import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { attemptLogin, checkCredentials } from "@/lib/auth";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

const owner = { email: "Owner@Example.com", passwordHash: bcrypt.hashSync("correct horse battery", 4) };

describe("checkCredentials", () => {
  it("accepts the owner (email case-insensitive)", async () => {
    expect(await checkCredentials(" owner@example.com ", "correct horse battery", owner)).toBe(true);
  });

  it("rejects a wrong password, a wrong email, or missing config", async () => {
    expect(await checkCredentials("owner@example.com", "wrong", owner)).toBe(false);
    expect(await checkCredentials("other@example.com", "correct horse battery", owner)).toBe(false);
    expect(await checkCredentials("owner@example.com", "correct horse battery", {})).toBe(false);
  });
});

describe("session token", () => {
  it("round-trips and rejects tampering", async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
    expect(await verifySessionToken(token.slice(0, -2) + "xx")).toBe(false);
    expect(await verifySessionToken(undefined)).toBe(false);
  });
});

describe("login rate limit (Redis)", () => {
  it("blocks the 6th attempt from one IP within 15 minutes", async () => {
    const ip = `test-${randomBytes(8).toString("hex")}`;
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await attemptLogin({ email: "x@example.com", password: "nope" }, ip));
    expect(results.slice(0, 5)).toEqual(Array(5).fill("invalid"));
    expect(results[5]).toBe("limited");
  });
});
