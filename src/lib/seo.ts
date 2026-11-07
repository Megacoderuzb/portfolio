import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { routing } from "@/i18n/routing";

/** Public origin (no trailing slash). APP_URL in production; localhost in dev and in `next build` without .env. */
export const siteUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

export const OG_LOCALE: Record<Locale, string> = { uz: "uz_UZ", ru: "ru_RU", en: "en_US" };

/** canonical + hreflang for the landing page; x-default points at the default locale (uz). */
export function localeAlternates(locale: Locale): NonNullable<Metadata["alternates"]> {
  return {
    canonical: `/${locale}`,
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
      "x-default": `/${routing.defaultLocale}`,
    },
  };
}

/** Serializes JSON-LD for a <script>: "<" is escaped so the data can never close the tag. */
export const jsonLd = (data: object) => JSON.stringify(data).replace(/</g, "\\u003c");
