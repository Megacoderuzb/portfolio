import type { Metadata } from "next";
import { connection } from "next/server";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { ManageBooking } from "@/components/booking/manage-booking";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getPublicBooking } from "@/lib/booking";

// The visitor's private booking page (link from the success card). Never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

async function Manage({ params }: { params: PageProps<"/[locale]/booking/[token]">["params"] }) {
  const { locale: raw, token } = await params; // the token is request data: read it inside Suspense
  const locale = raw as Locale;
  setRequestLocale(locale);
  await connection();
  const [t, booking] = await Promise.all([getTranslations("manage"), getPublicBooking(token, locale)]);
  if (!booking) {
    return (
      <div className="grid justify-items-center gap-6 text-center">
        <h1 className="text-h2">{t("notFound")}</h1>
        <a href={`/${locale}#booking`} className={buttonStyles()}>
          {t("rebook")}
        </a>
      </div>
    );
  }
  return <ManageBooking token={token} initial={booking} />;
}

export default function ManageBookingPage({ params }: PageProps<"/[locale]/booking/[token]">) {
  return (
    <Container className="max-w-2xl py-section">
      <Suspense fallback={<div className="min-h-[50vh]" />}>
        <Manage params={params} />
      </Suspense>
    </Container>
  );
}
