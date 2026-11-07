"use client";

import { Video } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Dialog } from "@/components/ui/dialog";
import { apiUrl } from "@/lib/hosts";
import type { PublicBooking } from "@/lib/booking";

const OWNER_ZONE = "Asia/Tashkent";

/** Booking details in the visitor's time zone (+ Tashkent), Meet link, cancel with confirmation. */
export function ManageBooking({ token, initial }: { token: string; initial: PublicBooking }) {
  const t = useTranslations();
  const format = useFormatter();
  const locale = useLocale();
  const [booking, setBooking] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [zone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  const when = (timeZone: string) =>
    format.dateTime(new Date(booking.startsAt), {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  const active = booking.status === "PENDING_MEET" || booking.status === "CONFIRMED";

  const cancel = async () => {
    setBusy(true);
    setError(false);
    const res = await fetch(apiUrl(`/api/bookings/${token}/cancel`), { method: "POST" }).catch(() => null);
    const data = res?.ok ? ((await res.json()) as { status: PublicBooking["status"] }) : null;
    if (data) setBooking((b) => ({ ...b, status: data.status }));
    else setError(true);
    setBusy(false);
    setConfirming(false);
  };

  return (
    <div className="grid gap-8">
      <h1 className="text-h2">{t("manage.title")}</h1>
      {booking.status === "CANCELLED" && (
        <p role="status" className="text-lg text-muted">
          {t("manage.cancelled")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-danger">
          {t("common.error")}
        </p>
      )}

      <Card className="p-6">
        <dl className="grid gap-5 sm:grid-cols-[10rem_1fr]">
          <dt className="text-sm text-muted">{t("manage.when")}</dt>
          <dd>
            <span className="text-lg">{when(zone)}</span>
            <span className="mt-1 block text-sm text-muted">{t("booking.time.ownerTime", { time: when(OWNER_ZONE) })}</span>
          </dd>
          <dt className="text-sm text-muted">{t("manage.status")}</dt>
          <dd>
            <Chip>{t(`booking.status.${booking.status}`)}</Chip>
          </dd>
          <dt className="text-sm text-muted">{t("manage.purpose")}</dt>
          <dd>{t(`booking.purpose.options.${booking.purpose}`)}</dd>
          {booking.service && (
            <>
              <dt className="text-sm text-muted">{t("manage.service")}</dt>
              <dd>{booking.service.title}</dd>
            </>
          )}
        </dl>
      </Card>

      <div className="flex flex-wrap gap-3">
        {active && booking.meetUrl && (
          <a href={booking.meetUrl} target="_blank" rel="noopener noreferrer" className={buttonStyles()}>
            <Video className="size-5" aria-hidden />
            {t("manage.joinMeet")}
          </a>
        )}
        {active && !booking.meetUrl && <p className="text-sm text-muted">{t("booking.success.meetPending")}</p>}
        {active && (
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            {t("manage.cancel")}
          </Button>
        )}
        {!active && (
          <a href={`/${locale}#booking`} className={buttonStyles()}>
            {t("manage.rebook")}
          </a>
        )}
      </div>

      <Dialog open={confirming} onClose={() => setConfirming(false)} title={t("manage.confirmCancel")}>
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            {t("common.back")}
          </Button>
          <Button onClick={cancel} loading={busy}>
            {t("manage.cancel")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
