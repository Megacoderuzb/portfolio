import { describe, expect, it } from "vitest";
import { parseEnv, serverShape } from "@/lib/env/schema";

const base = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://portfolio:x@localhost:5432/portfolio",
  REDIS_URL: "redis://localhost:6379",
};

describe("parseEnv", () => {
  it("accepts dev env with empty integration keys and applies defaults", () => {
    const env = parseEnv(serverShape, { ...base, TELEGRAM_BOT_TOKEN: "", RESUME_DIR: "" });
    expect(env.NODE_ENV).toBe("development");
    expect(env.TELEGRAM_BOT_TOKEN).toBeUndefined();
    expect(env.RESUME_DIR).toBe("./data/resume");
  });

  it("names invalid variables without echoing their values", () => {
    expect(() => parseEnv(serverShape, { ...base, SESSION_SECRET: "too-short-secret" })).toThrow(/SESSION_SECRET/);
    expect(() => parseEnv(serverShape, { ...base, SESSION_SECRET: "too-short-secret" })).not.toThrow(
      /too-short-secret/,
    );
  });

  it("requires owner-provided secrets in production", () => {
    expect(() => parseEnv(serverShape, { ...base, NODE_ENV: "production" })).toThrow(/TELEGRAM_BOT_TOKEN/);
  });
});
