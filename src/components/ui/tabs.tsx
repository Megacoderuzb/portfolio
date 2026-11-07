"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/lib/cx";

type Tab = { id: string; label: string; content: ReactNode };

/** WAI-ARIA tabs: arrow keys / Home / End move between tabs. */
export function Tabs({ tabs, label, className }: { tabs: Tab[]; label: string; className?: string }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const base = useId();
  const tabId = (id: string) => `${base}-tab-${id}`;
  const panelId = (id: string) => `${base}-panel-${id}`;

  const onKeyDown = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const tab = tabs[(next + tabs.length) % tabs.length];
    setActive(tab.id);
    document.getElementById(tabId(tab.id))?.focus();
  };

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={tabId(t.id)}
            type="button"
            role="tab"
            aria-selected={t.id === active}
            aria-controls={panelId(t.id)}
            tabIndex={t.id === active ? 0 : -1}
            onClick={() => setActive(t.id)}
            className={cx(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              t.id === active ? "border-violet-400 text-text" : "border-transparent text-muted hover:text-text",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          id={panelId(t.id)}
          role="tabpanel"
          aria-labelledby={tabId(t.id)}
          hidden={t.id !== active}
          tabIndex={0}
          className="pt-4"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
