import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { getContacts, getOwner } from "@/lib/content";
import { jsonLd, siteUrl } from "@/lib/seo";

const KNOWS_ABOUT = [
  "NestJS",
  "Next.js",
  "TypeScript",
  "Node.js",
  "React",
  "PostgreSQL",
  "Redis",
  "Docker",
  "n8n",
  "Telegram bots",
];

/** schema.org Person for search engines. Links come from the admin-editable contacts, so they never go stale. */
export async function PersonJsonLd({ locale }: { locale: Locale }) {
  const [contacts, t, h] = await Promise.all([
    getContacts(),
    getTranslations({ locale, namespace: "meta" }),
    getTranslations({ locale, namespace: "hero" }),
  ]);
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: getOwner().fullName,
    jobTitle: h("role"),
    description: t("description"),
    url: `${siteUrl()}/${locale}`,
    sameAs: [contacts.linkedin, contacts.github, contacts.telegram],
    knowsAbout: KNOWS_ABOUT,
    address: { "@type": "PostalAddress", addressLocality: "Tashkent", addressCountry: "UZ" },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />;
}
