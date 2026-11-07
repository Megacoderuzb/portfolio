"use client";

import { useTranslations } from "next-intl";
import { Button, buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Link } from "@/i18n/navigation";

// Runtime error inside the page: the layout (navbar, footer) stays, only this section is replaced.
// `digest` is the id Next also writes to the server log, so a visitor can quote it.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors.generic");
  return (
    <Container className="grid min-h-[60vh] place-items-center py-32 text-center">
      <div role="alert">
        <h1 className="font-heading text-3xl font-bold">{t("title")}</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">{t("text")}</p>
        {error.digest && <p className="mt-2 font-mono text-xs text-muted">{t("ref", { digest: error.digest })}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>{t("retry")}</Button>
          <Link href="/" className={buttonStyles({ variant: "secondary" })}>
            {t("home")}
          </Link>
        </div>
      </div>
    </Container>
  );
}
