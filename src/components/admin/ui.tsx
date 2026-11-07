import type { ReactNode } from "react";
import { Tabs } from "@/components/ui/tabs";

/** Admin page heading with an optional action on the right. */
export function AdminTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-3xl">{children}</h1>
      {action}
    </div>
  );
}

export function Checkbox({ name, label, defaultChecked, value }: { name: string; label: string; defaultChecked?: boolean; value?: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="size-4 accent-violet-600" />
      {label}
    </label>
  );
}

export const LOCALES = ["en", "uz", "ru"] as const;

/** One tab per content language. English is required; empty uz/ru fields fall back to English on the site. */
export function LocaleTabs({ render }: { render: (locale: (typeof LOCALES)[number]) => ReactNode }) {
  return (
    <Tabs
      label="Content language"
      tabs={LOCALES.map((l) => ({
        id: l,
        label: l === "en" ? "EN (required)" : l.toUpperCase(),
        content: <div className="grid gap-4">{render(l)}</div>,
      }))}
    />
  );
}

export const formatDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tashkent" }).format(d);
