"use client";

import { useLocale, useTranslations } from "next-intl";
import { routing } from "@/i18n/routing";
import { cx } from "@/lib/cx";

/** "/ru/booking/x" → "/booking/x" */
const withoutLocale = (path: string) => path.replace(/^\/(uz|ru|en)(?=\/|$)/, "") || "";

/**
 * Plain links to the same page in another locale. The href is the locale's home (works without JS and needs no
 * pathname at render time, so it prerenders on every route); the click handler swaps in the current path and
 * #section. The proxy stores the choice in the NEXT_LOCALE cookie when the URL locale changes.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const locale = useLocale();

  return (
    <nav aria-label={t("language")} className={className}>
      <ul className="flex rounded-full border border-border bg-surface/60 p-0.5 font-mono text-xs">
        {routing.locales.map((l) => (
          <li key={l}>
            <a
              href={`/${l}`}
              hrefLang={l}
              lang={l}
              aria-current={l === locale ? "true" : undefined}
              onClick={(e) => {
                const { pathname, search, hash } = window.location;
                e.currentTarget.href = `/${l}${withoutLocale(pathname)}${search}${hash}`;
              }}
              className={cx(
                "block rounded-full px-2.5 py-1.5 uppercase transition-colors",
                l === locale ? "bg-violet-600 text-text" : "text-muted hover:text-text",
              )}
            >
              {l}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
