"use client";

import {
  Bot,
  Globe,
  LayoutDashboard,
  Server,
  Sparkles,
  Ticket,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useRef, type PointerEvent } from "react";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { Service } from "@/lib/content";
import { track } from "@/lib/events/track";

// Services added later in admin fall back to Sparkles.
const icons: Record<string, LucideIcon> = {
  "landing-corporate": Globe,
  "crm-pms": LayoutDashboard,
  "ecommerce-ticketing": Ticket,
  "telegram-bots": Bot,
  "automation-n8n": Workflow,
  "backend-api": Server,
};

export function ServiceCard({ service, cta }: { service: Service; cta: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const Icon = icons[service.slug] ?? Sparkles;

  // mouse-tracked tilt: mouse only, skipped under reduced motion
  const tilt = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = el.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width - 0.5;
    const y = (e.clientY - box.top) / box.height - 0.5;
    el.style.transform = `perspective(800px) rotateX(${-y * 8}deg) rotateY(${x * 10}deg)`;
  };
  const reset = () => ref.current?.style.removeProperty("transform");

  return (
    <Card
      ref={ref}
      onPointerMove={tilt}
      onPointerLeave={reset}
      className="flex h-full flex-col p-6 transition-[transform,border-color,box-shadow] duration-200 ease-out hover:border-violet-400/40 hover:shadow-glow"
    >
      <span className="grid size-12 place-items-center rounded-2xl border border-violet-400/20 bg-violet-500/10 text-violet-300">
        <Icon className="size-6" strokeWidth={1.75} aria-hidden />
      </span>
      <h3 className="mt-6 text-xl">{service.title}</h3>
      <p className="mt-3 flex-1 text-muted">{service.description}</p>
      {/* the booking section (phase 04) preselects ?service= */}
      <Link
        href={{ pathname: "/", query: { service: service.slug }, hash: "booking" }}
        onClick={() => track("SERVICE_CLICK", { serviceSlug: service.slug })}
        aria-label={`${cta}: ${service.title}`}
        className={buttonStyles({ variant: "secondary", size: "sm" }) + " mt-6 self-start"}
      >
        {cta}
      </Link>
    </Card>
  );
}
