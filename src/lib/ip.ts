import { createHash } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Visitor IP. The app only listens on 127.0.0.1 behind Nginx, which sets X-Real-IP from the socket
 * (not spoofable); X-Forwarded-For is the fallback for other proxies.
 */
export function clientIp(headers: Headers) {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** Salted hash: used for rate-limit keys and storage, so raw IPs are never kept. */
export function hashIp(ip: string) {
  return createHash("sha256")
    .update(`${serverEnv().IP_HASH_SALT ?? ""}:${ip}`)
    .digest("base64url")
    .slice(0, 32);
}
