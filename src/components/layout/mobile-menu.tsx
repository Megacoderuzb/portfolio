"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { Drawer } from "@/components/ui/dialog";
import { LanguageSwitcher } from "./language-switcher";

type Props = { links: { href: string; label: string }[]; bookHref: string };

export function MobileMenu({ links, bookHref }: Props) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("menu")}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="rounded-full p-2 text-violet-300 transition-colors hover:bg-surface-2 lg:hidden"
      >
        <Menu className="size-6" aria-hidden />
      </button>
      <Drawer open={open} onClose={close} title={t("menu")}>
        <nav aria-label={t("main")}>
          <ul className="grid gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={close}
                  className="block rounded-xl px-3 py-3 text-lg font-medium transition-colors hover:bg-surface-2"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a href={bookHref} onClick={close} className={buttonStyles({ size: "lg" }) + " mt-6 w-full"}>
          {t("bookCall")}
        </a>
        <LanguageSwitcher className="mt-6 flex justify-center" />
      </Drawer>
    </>
  );
}
