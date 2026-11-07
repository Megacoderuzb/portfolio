import { ArrowDown, ArrowUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminTitle } from "@/components/admin/ui";
import { buttonStyles } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { requireAdmin } from "@/lib/auth";
import type { LocalizedContent, ServiceText } from "@/lib/content";
import { listServicesAdmin } from "@/lib/content/admin";
import { serviceInterest } from "@/lib/stats";
import { moveAction } from "../actions";

export const metadata: Metadata = { title: "Services" };

const arrow = "rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30";

export default async function ServicesPage() {
  await requireAdmin();
  const [services, interest] = await Promise.all([listServicesAdmin(), serviceInterest()]);

  return (
    <div className="max-w-4xl">
      <AdminTitle
        action={
          <Link href="/admin/services/new" className={buttonStyles({ size: "sm" })}>
            New service
          </Link>
        }
      >
        Services
      </AdminTitle>
      <ul className="mt-8 grid gap-2">
        {services.map((s, i) => {
          const content = s.content as LocalizedContent<ServiceText>;
          return (
            <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
              <div className="flex flex-col">
                <form action={moveAction.bind(null, "service", s.id, -1)}>
                  <button type="submit" disabled={i === 0} aria-label={`Move ${content.en.title} up`} className={arrow}>
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                </form>
                <form action={moveAction.bind(null, "service", s.id, 1)}>
                  <button
                    type="submit"
                    disabled={i === services.length - 1}
                    aria-label={`Move ${content.en.title} down`}
                    className={arrow}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                </form>
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/admin/services/${s.id}`} className="font-medium hover:text-violet-300">
                  {content.en.title}
                </Link>
                <p className="font-mono text-xs text-muted">{s.slug}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {!s.visible && <Chip>hidden</Chip>}
                {content._review && <Chip>review uz/ru</Chip>}
                <Chip title="Book clicks, all time">{interest.get(s.slug) ?? 0} clicks</Chip>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
