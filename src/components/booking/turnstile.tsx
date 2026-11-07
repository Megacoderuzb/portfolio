"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "cf-turnstile";

/** Cloudflare Turnstile widget (free). Loads the script on first use; reports the token (or "" when it expires). */
export function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let widget: string | undefined;
    const render = () => {
      if (!ref.current || !window.turnstile || widget) return;
      widget = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        theme: "dark",
        language: document.documentElement.lang,
        callback: onToken,
        "expired-callback": () => onToken(""),
      });
    };
    if (window.turnstile) render();
    else {
      let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (!script) {
        script = Object.assign(document.createElement("script"), {
          id: SCRIPT_ID,
          src: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
          async: true,
        });
        document.head.append(script);
      }
      script.addEventListener("load", render);
    }
    return () => {
      if (widget) window.turnstile?.remove(widget);
    };
  }, [siteKey, onToken]);

  return <div ref={ref} className="min-h-[65px]" />;
}
