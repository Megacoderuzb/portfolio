import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/seo";

// Landing page in every locale, each entry listing its alternates. Admin and booking-manage pages are not public content.
// Request time (connection): APP_URL isn't available when the Docker image is built.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const url = (locale: string) => `${siteUrl()}/${locale}`;
  const languages = {
    ...Object.fromEntries(routing.locales.map((l) => [l, url(l)])),
    "x-default": url(routing.defaultLocale),
  };
  return routing.locales.map((locale) => ({
    url: url(locale),
    changeFrequency: "monthly",
    priority: locale === routing.defaultLocale ? 1 : 0.9,
    alternates: { languages },
  }));
}
