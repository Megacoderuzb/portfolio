import type { z } from "zod";
import { parseEnv, publicShape, serverShape } from "./schema";

export type ServerEnv = z.infer<typeof serverShape>;
export type PublicEnv = z.infer<typeof publicShape>;

// Lazy so `next build` (no .env in Docker) doesn't fail; src/instrumentation.ts calls both at server start.
let server: ServerEnv | undefined;
let pub: PublicEnv | undefined;

export const serverEnv = () => (server ??= parseEnv(serverShape));

// NEXT_PUBLIC_* must be referenced literally so Next inlines them into client bundles.
export const publicEnv = () =>
  (pub ??= parseEnv(publicShape, {
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
    NEXT_PUBLIC_TELEGRAM_URL: process.env.NEXT_PUBLIC_TELEGRAM_URL,
    NEXT_PUBLIC_LINKEDIN_URL: process.env.NEXT_PUBLIC_LINKEDIN_URL,
    NEXT_PUBLIC_GITHUB_URL: process.env.NEXT_PUBLIC_GITHUB_URL,
  }));
