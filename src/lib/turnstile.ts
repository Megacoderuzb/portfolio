import { serverEnv } from "@/lib/env";
import { log } from "@/lib/log";

let warned = false;

/**
 * Cloudflare Turnstile server check. Without TURNSTILE_SECRET_KEY it passes in development (with one warning)
 * and fails closed in production (where the env schema requires the key anyway).
 */
export async function verifyTurnstile(token: string | undefined, ip: string) {
  const env = serverEnv();
  if (!env.TURNSTILE_SECRET_KEY) {
    if (env.NODE_ENV === "production") return false;
    if (!warned) log.warn("turnstile.skipped", { reason: "TURNSTILE_SECRET_KEY not set (development only)" });
    warned = true;
    return true;
  }
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok && ((await res.json()) as { success?: boolean }).success === true;
  } catch {
    return false;
  }
}
