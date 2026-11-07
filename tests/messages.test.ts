import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ru from "@/messages/ru.json";
import uz from "@/messages/uz.json";

type Messages = { [key: string]: string | Messages };

/** "a.b.c" → message, for every leaf. */
const flatten = (obj: Messages, prefix = ""): Record<string, string> =>
  Object.fromEntries(
    Object.entries(obj).flatMap(([key, value]) =>
      typeof value === "string" ? [[prefix + key, value]] : Object.entries(flatten(value, `${prefix}${key}.`)),
    ),
  );

const placeholders = (message: string) => [...message.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

const base = flatten(uz);

describe.each([
  ["ru", flatten(ru)],
  ["en", flatten(en)],
])("messages: uz vs %s", (_, other) => {
  it("has exactly the same keys", () => {
    expect(Object.keys(other).sort()).toEqual(Object.keys(base).sort());
  });

  it("uses the same {placeholders} in every message", () => {
    for (const [key, message] of Object.entries(base)) {
      expect(placeholders(other[key] ?? ""), key).toEqual(placeholders(message));
    }
  });
});
