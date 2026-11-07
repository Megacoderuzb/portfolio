import { getTranslations } from "next-intl/server";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Link } from "@/i18n/navigation";

// Localized 404 inside the site layout (navbar and footer stay). Reached through [...rest]/page.tsx and notFound().
export default async function NotFound() {
  const t = await getTranslations("errors.notFound");
  return (
    <Container className="grid min-h-[60vh] place-items-center py-32 text-center">
      <div>
        <p className="font-mono text-6xl font-bold text-violet-400" aria-hidden>
          404
        </p>
        <h1 className="mt-6 font-heading text-3xl font-bold">{t("title")}</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">{t("text")}</p>
        <Link href="/" className={`${buttonStyles()} mt-8`}>
          {t("home")}
        </Link>
      </div>
    </Container>
  );
}
