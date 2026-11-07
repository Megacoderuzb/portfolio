import { defineConfig, devices } from "@playwright/test";
import bcrypt from "bcryptjs";
import { E2E_ADMIN } from "./e2e/env";

// Smoke + accessibility tests against the production build (`pnpm build` first; CI does).
// Needs Postgres + Redis (DATABASE_URL / REDIS_URL from .env or the environment), migrated and seeded:
//   pnpm prisma migrate deploy && pnpm seed
// The app runs with throwaway secrets below: nothing here is a real credential.

const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000, // generous: a busy dev machine renders the OG image and server actions slowly
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // locally one worker: parallel Chrome instances starve each other on a busy dev machine and cause false timeouts
  workers: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...(process.env as Record<string, string>),
      NODE_ENV: "production",
      APP_URL: `http://localhost:${PORT}`,
      ADMIN_EMAIL: E2E_ADMIN.email,
      // the app wants the bcrypt hash base64-encoded (a raw "$2b$…" gets mangled by env expansion)
      ADMIN_PASSWORD_HASH: Buffer.from(bcrypt.hashSync(E2E_ADMIN.password, 4)).toString("base64"),
      SESSION_SECRET: "e2e-session-secret-0123456789abcdef-not-real",
      IP_HASH_SALT: "e2e-ip-salt-not-real-0123",
      TELEGRAM_BOT_TOKEN: "1:e2e",
      OWNER_TELEGRAM_ID: "1",
      N8N_WEBHOOK_SECRET: "e2e-webhook-secret-not-real",
      N8N_CALLBACK_SECRET: "e2e-callback-secret-not-real",
      TURNSTILE_SECRET_KEY: "e2e-turnstile-not-real",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
    },
  },
});
