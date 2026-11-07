import { z } from "zod";

// An empty value in .env ("KEY=") means "not set".
const blank = (v: unknown) => (v === "" ? undefined : v);
const optional = <T extends z.ZodType>(schema: T) => z.preprocess(blank, schema.optional());
const withDefault = (value: string) => z.preprocess(blank, z.string().default(value));

export const serverShape = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url(),

  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  POSTGRES_PASSWORD: optional(z.string()), // docker-compose only

  ADMIN_EMAIL: optional(z.email()),
  // bcrypt hash, or its base64 as printed by `pnpm hash-password` ("$" in .env gets expanded by Next / compose)
  ADMIN_PASSWORD_HASH: optional(
    z
      .string()
      .transform((v, ctx) => {
        if (v.startsWith("$2")) return v;
        try {
          return atob(v);
        } catch {
          ctx.addIssue({ code: "custom", message: "must be a bcrypt hash or its base64" });
          return z.NEVER;
        }
      })
      .pipe(z.string().regex(/^\$2[aby]\$\d{2}\$.{53}$/, "must be a bcrypt hash")),
  ),
  SESSION_SECRET: optional(z.string().min(32)),
  IP_HASH_SALT: optional(z.string().min(16)),

  RESUME_DIR: withDefault("./data/resume"),

  // Optional hostnames. ADMIN_URL: the admin panel gets its own host (https://admin.example.com); the main host then
  // 404s on /admin. The API host is NEXT_PUBLIC_API_URL (public schema). Both unset = everything on APP_URL.
  ADMIN_URL: optional(z.url()),

  TELEGRAM_BOT_TOKEN: optional(z.string().regex(/^\d+:[\w-]+$/, "must look like 123456:ABC-xyz")),
  OWNER_TELEGRAM_ID: optional(z.coerce.number().int().positive()),

  N8N_BASE_URL: z.preprocess(blank, z.url().default("http://localhost:5678")),
  N8N_WEBHOOK_SECRET: optional(z.string().min(16)),
  N8N_CALLBACK_SECRET: optional(z.string().min(16)),
  N8N_HOST: optional(z.string()), // docker-compose only
  N8N_ENCRYPTION_KEY: optional(z.string()), // docker-compose only

  TURNSTILE_SECRET_KEY: optional(z.string()),
});

export const publicShape = z.object({
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optional(z.string()),
  // Public API on its own host (https://api.example.com), baked in at build; unset = same origin as the site.
  NEXT_PUBLIC_API_URL: optional(z.url()),
  NEXT_PUBLIC_CONTACT_EMAIL: z.email(),
  NEXT_PUBLIC_TELEGRAM_URL: z.url(),
  NEXT_PUBLIC_LINKEDIN_URL: z.url(),
  NEXT_PUBLIC_GITHUB_URL: z.url(),
});

// Set up by hand by the owner (README), so they may be empty in dev/test, never in production.
const REQUIRED_IN_PRODUCTION = [
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD_HASH",
  "SESSION_SECRET",
  "IP_HASH_SALT",
  "TELEGRAM_BOT_TOKEN",
  "OWNER_TELEGRAM_ID",
  "N8N_WEBHOOK_SECRET",
  "N8N_CALLBACK_SECRET",
  "TURNSTILE_SECRET_KEY",
];

/** Parses env vars; throws a readable error listing variable names only (never values). */
export function parseEnv<S extends z.ZodObject>(
  schema: S,
  source: Record<string, string | undefined> = process.env,
): z.infer<S> {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  const env = result.data as Record<string, unknown>;
  if (env.NODE_ENV === "production") {
    const missing = REQUIRED_IN_PRODUCTION.filter((key) => key in schema.shape && env[key] === undefined);
    if (missing.length) {
      throw new Error(`Missing environment variables (required in production): ${missing.join(", ")}`);
    }
  }
  return result.data;
}
