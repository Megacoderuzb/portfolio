import "@/lib/env/load"; // tsx doesn't load .env (Next does); in Docker the vars come from compose
import type { z } from "zod";
import { parseEnv, serverShape } from "@/lib/env/schema";

const workerShape = serverShape.pick({
  NODE_ENV: true,
  APP_URL: true,
  ADMIN_URL: true,
  DATABASE_URL: true,
  REDIS_URL: true,
  TELEGRAM_BOT_TOKEN: true,
  OWNER_TELEGRAM_ID: true,
  N8N_BASE_URL: true,
  N8N_WEBHOOK_SECRET: true,
});

let env: z.infer<typeof workerShape> | undefined;
export const workerEnv = () => (env ??= parseEnv(workerShape));
