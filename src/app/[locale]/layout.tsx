import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Background } from "@/components/layout/background";
import { CursorGlow } from "@/components/layout/cursor-glow";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { Providers } from "@/components/layout/providers";
import { ScrollProgress } from "@/components/layout/scroll-progress";
import { routing } from "@/i18n/routing";
import { getOwner } from "@/lib/content";
import { localeAlternates, OG_LOCALE, siteUrl } from "@/lib/seo";
import { fontVariables } from "../fonts";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  // Deliberately static: runtime data here (connection(), headers()) makes Next stream the metadata AFTER </head>,
  // so title/description/canonical/og:* leave <head> and crawlers or Lighthouse that don't run JS miss them.
  // The public origin (canonical, hreflang, og:image) is therefore fixed at build time from APP_URL:
  // the Dockerfile requires it as a build arg.
  const t = await getTranslations({ locale, namespace: "meta" });
  const title = t("title");
  const description = t("description");
  return {
    metadataBase: new URL(siteUrl()),
    title,
    description,
    applicationName: getOwner().fullName,
    authors: [{ name: getOwner().fullName }],
    alternates: localeAlternates(locale),
    // og:image / twitter:image come from the opengraph-image / twitter-image files next to this layout
    openGraph: {
      type: "website",
      siteName: getOwner().fullName,
      url: `/${locale}`,
      title,
      description,
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("common");

  return (
    <html lang={locale} className={fontVariables}>
      <body>
        <NextIntlClientProvider>
          <Providers>
            <a
              href="#main"
              className="sr-only rounded-full bg-violet-600 px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-60"
            >
              {t("skipToContent")}
            </a>
            <Background />
            <CursorGlow />
            <ScrollProgress />
            <Navbar locale={locale} />
            <main id="main" tabIndex={-1} className="outline-none">
              {children}
            </main>
            <Footer locale={locale} />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
