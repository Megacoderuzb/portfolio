import { getTranslations } from "next-intl/server";
import type { Locale } from "next-intl";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Monogram } from "@/components/ui/monogram";
import { LanguageSwitcher } from "./language-switcher";
import { MobileMenu } from "./mobile-menu";

/** Section links (navbar + footer). Full paths so they also work from /{locale}/booking/{token}. */
export async function getNavLinks(locale: Locale) {
  const t = await getTranslations("nav");
  const home = `/${locale}`;
  return [
    { href: `${home}#about`, label: t("about") },
    { href: `${home}#projects`, label: t("projects") },
    { href: `${home}#services`, label: t("services") },
    { href: `${home}#booking`, label: t("book") },
    { href: `${home}#contact`, label: t("contact") },
  ];
}

/** Server-rendered shell; only the language switcher and mobile drawer are client components. */
export async function Navbar({ locale }: { locale: Locale }) {
  const [t, links] = await Promise.all([getTranslations("nav"), getNavLinks(locale)]);
  const home = `/${locale}`;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-bg-1/70 backdrop-blur-md">
      <Container className="flex h-16 items-center gap-6">
        <a href={home} className="rounded-xl">
          <Monogram />
          <span className="sr-only">{t("home")}</span>
        </a>
        <nav aria-label={t("main")} className="hidden flex-1 lg:block">
          <ul className="flex gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="rounded-full px-3 py-2 text-sm text-muted transition-colors hover:text-text"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitcher className="hidden sm:block" />
          <a href={`${home}#booking`} className={buttonStyles({ size: "sm" }) + " hidden whitespace-nowrap sm:inline-flex"}>
            {t("bookCall")}
          </a>
          <MobileMenu links={links} bookHref={`${home}#booking`} />
        </div>
      </Container>
    </header>
  );
}
