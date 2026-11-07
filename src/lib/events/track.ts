import type { EventMeta, PublicEvent } from "./public";
import { apiUrl } from "@/lib/hosts";

export type { PublicEvent } from "./public";

/**
 * Records a public analytics event from the browser (fire-and-forget).
 * sendBeacon survives page unloads (e.g. clicking an external link); fetch keepalive is the fallback.
 */
// text/plain keeps the cross-origin call a CORS "simple request" (no preflight); the API parses the JSON body anyway
const PLAIN = "text/plain;charset=UTF-8";

export function track(type: PublicEvent, meta: EventMeta = {}) {
  const locale = document.documentElement.lang as NonNullable<EventMeta>["locale"];
  const body = JSON.stringify({ type, meta: { ...meta, locale } });
  const sent = navigator.sendBeacon?.(apiUrl("/api/events"), new Blob([body], { type: PLAIN }));
  if (!sent) {
    fetch(apiUrl("/api/events"), { method: "POST", body, headers: { "content-type": PLAIN }, keepalive: true }).catch(
      () => {},
    );
  }
}
