"use client";

import { useEffect, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { track, type PublicEvent } from "@/lib/events/track";

// No animation library here on purpose: the landing animates with CSS. Interactive parts that need `motion`
// (e.g. the booking steps) wrap only their own subtree in <LazyMotion features={domAnimation} strict>.
export function Providers({ children }: { children: ReactNode }) {
  // Server-rendered links opt into analytics with data-track="TYPE" (+ data-channel), no client component needed.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>("[data-track]");
      if (!el) return;
      const channel = el.dataset.channel as "email" | "telegram" | "linkedin" | "github" | undefined;
      track(el.dataset.track as PublicEvent, channel ? { channel } : {});
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return <ToastProvider>{children}</ToastProvider>;
}
