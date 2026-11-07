import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { GameMount } from "@/components/game/game-mount";
import { Container } from "@/components/ui/container";
import { Monogram } from "@/components/ui/monogram";
import { Reveal } from "@/components/ui/reveal";
import { getOwner } from "@/lib/content";
import { getNavLinks } from "./navbar";

// Enter: a violet horizon line sweeps open, the footer rises, the game area fades in last.
export async function Footer({ locale }: { locale: Locale }) {
  const [t, owner, links] = await Promise.all([getTranslations("footer"), getOwner(), getNavLinks(locale)]);

  return (
    <footer className="mt-16 overflow-x-clip">
      <Reveal preset="sweep" className="h-px bg-linear-to-r from-transparent via-violet-400 to-transparent" />
      <Reveal>
        <Container className="py-14">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <a href={`/${locale}`} className="flex items-center gap-3 self-start rounded-xl">
              <Monogram />
              <span className="font-heading font-bold">{owner.fullName}</span>
            </a>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="transition-colors hover:text-text">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          {/* breakout: its code loads only when the footer gets close (GameMount) */}
          <Reveal index={4}>
            <section id="game" aria-labelledby="game-title" className="mx-auto mt-12 max-w-240">
              <div className="text-center">
                <h2 id="game-title" className="font-heading text-xl font-bold">
                  {t("game.title")}
                </h2>
                <p className="mt-2 text-sm text-muted">{t("game.hint")}</p>
                <a
                  href="#game-end"
                  className="mt-2 inline-block rounded text-xs text-muted underline underline-offset-4 hover:text-text"
                >
                  {t("game.skip")}
                </a>
              </div>
              <div className="mt-4">
                <GameMount />
              </div>
            </section>
          </Reveal>
          <p id="game-end" tabIndex={-1} className="mt-10 text-sm text-muted outline-none">
            © {owner.fullName}. {t("rights")}
          </p>
        </Container>
      </Reveal>
    </footer>
  );
}
