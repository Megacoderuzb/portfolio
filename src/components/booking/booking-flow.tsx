"use client";

import { CalendarCheck, Clock } from "lucide-react";
import { AnimatePresence, LazyMotion, m, MotionConfig, type Variants } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { apiUrl } from "@/lib/hosts";
import { cx } from "@/lib/cx";
import { track } from "@/lib/events/track";
import { Turnstile } from "./turnstile";

// 3-step booking flow + done card (docs/SPEC.md §5). Slots come from /api/availability as UTC instants and are
// shown in the visitor's time zone; the owner's (Tashkent) time is shown on hover/selection. The server re-checks
// everything, so nothing here is trusted. Times are formatted with Intl (no Luxon in the client bundle).

// Animation features load after first paint (own chunk): the form is server-rendered and usable meanwhile.
const loadMotionFeatures = () => import("./motion-features").then((mod) => mod.default);

const OWNER_ZONE = "Asia/Tashkent";
const PURPOSES = ["JOB_OFFER", "FREELANCE", "NETWORKING", "OTHER"] as const;
const ERROR_KEYS: Record<string, string> = {
  slot_taken: "slotTaken",
  rate_limited: "rateLimit",
  captcha: "captcha",
  too_many_bookings: "tooManyBookings",
};

type Purpose = (typeof PURPOSES)[number];
type Slot = { start: string; end: string };
type Status = "PENDING_MEET" | "CONFIRMED" | "CANCELLED" | "DONE" | "NO_SHOW";
type Props = { services: { slug: string; title: string }[]; siteKey?: string; horizonDays: number };

/** YYYY-MM-DD of an instant in a time zone. */
const dayKey = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// direction-aware step transition (reduced motion: MotionConfig drops the slide, keeps the fade)
const slide: Variants = {
  enter: (dir: number) => ({ x: dir * 48, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit: (dir: number) => ({ x: dir * -48, opacity: 0, transition: { duration: 0.2 } }),
};

/** Visually styled native radio: keyboard (arrows/space) and screen readers work as a radio group. */
function Choice(props: {
  name: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <label className={cx("relative block", props.disabled && "opacity-40")} title={props.title}>
      <input
        type="radio"
        name={props.name}
        checked={props.checked}
        onChange={props.onChange}
        disabled={props.disabled}
        className="peer sr-only"
      />
      <span className="block cursor-pointer rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-sm transition-colors peer-checked:border-violet-400 peer-checked:bg-violet-600 peer-checked:text-text peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-violet-300 peer-disabled:cursor-not-allowed hover:border-violet-400/60">
        {props.children}
      </span>
    </label>
  );
}

/** A failed fetch while the browser reports no connection: say so instead of a vague "try again". */
const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

export function BookingFlow({ services, siteKey, horizonDays }: Props) {
  const t = useTranslations("booking");
  const tc = useTranslations("common");
  const te = useTranslations("errors.generic");
  const format = useFormatter();
  const locale = useLocale();
  const params = useSearchParams();

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [error, setError] = useState<string>(); // key under booking.errors
  const [purpose, setPurpose] = useState<Purpose>();

  // ?service= comes from the service cards' "Book" links; a new value overrides the current choice
  const isService = (slug: string) => services.some((s) => s.slug === slug);
  const paramService = params.get("service") ?? "";
  const [seenParam, setSeenParam] = useState(paramService);
  const [service, setService] = useState(isService(paramService) ? paramService : "");
  if (paramService !== seenParam) {
    setSeenParam(paramService);
    if (isService(paramService)) setService(paramService);
  }

  const [zone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [load, setLoad] = useState<{ state: "idle" | "loading" | "ready" | "error"; slots: Slot[]; closed: string[] }>({
    state: "idle",
    slots: [],
    closed: [],
  });
  const [date, setDate] = useState<string>();
  const [slot, setSlot] = useState<Slot>();

  const [fields, setFields] = useState({
    name: "",
    email: "",
    telegram: "",
    phone: "",
    company: "",
    note: "",
    website: "",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [tried, setTried] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<{ token: string; status: Status; meetUrl: string | null }>();

  const time = (iso: string, timeZone: string) =>
    format.dateTime(new Date(iso), { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const day = (key: string) =>
    format.dateTime(new Date(`${key}T12:00:00Z`), {
      timeZone: "UTC",
      weekday: "short",
      day: "numeric",
      month: "short",
    });

  const loadSlots = useCallback(async () => {
    setLoad((l) => ({ ...l, state: "loading" }));
    const from = dayKey(new Date().toISOString(), OWNER_ZONE);
    try {
      const res = await fetch(apiUrl(`/api/availability?from=${from}&to=${addDays(from, Math.min(horizonDays, 30))}`));
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { slots: Slot[]; closedDates: string[] };
      setLoad({ state: "ready", slots: data.slots, closed: data.closedDates });
    } catch {
      setLoad((l) => ({ ...l, state: "error" }));
    }
  }, [horizonDays]);

  // Focus moves to the new step once it has mounted (AnimatePresence "wait" mounts it after the old one exits),
  // so keyboard and screen-reader users land at the start of the new content instead of on a removed button.
  const focusNext = useRef(false);
  const stepRef = useCallback((el: HTMLElement | null) => {
    if (el && focusNext.current) {
      focusNext.current = false;
      el.focus({ preventScroll: true });
    }
  }, []);

  const go = (next: number) => {
    focusNext.current = true;
    setDir(next > step ? 1 : -1);
    setStep(next);
    setError(undefined);
    if (step === 0 && next === 1) {
      track("BOOKING_STARTED");
      void loadSlots();
    }
  };

  // slots grouped by the visitor's calendar day
  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of load.slots) map.set(dayKey(s.start, zone), [...(map.get(dayKey(s.start, zone)) ?? []), s]);
    return map;
  }, [load.slots, zone]);
  const days = useMemo(() => [...new Set([...byDay.keys(), ...load.closed])].sort(), [byDay, load.closed]);
  const activeDate = date && byDay.has(date) ? date : days.find((d) => byDay.has(d));
  const daySlots = (activeDate && byDay.get(activeDate)) || [];

  const fieldError = {
    name: fields.name.trim() ? undefined : "required",
    email: !fields.email.trim() ? "required" : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email) ? undefined : "email",
  };
  const shownError = (key: "name" | "email") =>
    (touched[key] || tried) && fieldError[key] ? t(`errors.${fieldError[key] as "required" | "email"}`) : undefined;
  const set = (key: keyof typeof fields) => ({
    value: fields[key],
    onChange: (e: { target: { value: string } }) => setFields((f) => ({ ...f, [key]: e.target.value })),
    onBlur: () => setTouched((tch) => ({ ...tch, [key]: true })),
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (fieldError.name || fieldError.email || !slot || !purpose) return;
    if (siteKey && !captcha) return setError("captcha");
    setSubmitting(true);
    setError(undefined);
    try {
      const res = await fetch(apiUrl("/api/bookings"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...fields,
          purpose,
          service: service || undefined,
          startsAt: slot.start,
          timezone: zone,
          locale,
          turnstileToken: captcha || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
      if (res.ok && data.token) {
        setBooking({ token: data.token, status: "PENDING_MEET", meetUrl: null });
        go(3);
        return;
      }
      if (data.error === "slot_taken") {
        focusNext.current = true;
        setSlot(undefined);
        setDir(-1);
        setStep(1);
        void loadSlots();
      }
      setError(ERROR_KEYS[data.error ?? ""] ?? "generic");
    } catch {
      setError(isOffline() ? "offline" : "generic");
    } finally {
      setSubmitting(false);
    }
  };

  // after booking: poll every 2 s (max 30 s) until n8n has added the Meet link
  useEffect(() => {
    if (!booking?.token || booking.meetUrl) return;
    let tries = 0;
    const id = setInterval(async () => {
      tries += 1;
      const res = await fetch(apiUrl(`/api/bookings/${booking.token}?locale=${locale}`)).catch(() => null);
      const data = res?.ok ? ((await res.json()) as { status: Status; meetUrl: string | null }) : null;
      if (data) setBooking((b) => b && { ...b, status: data.status, meetUrl: data.meetUrl });
      if (data?.meetUrl || tries >= 15) clearInterval(id);
    }, 2000);
    return () => clearInterval(id);
  }, [booking?.token, booking?.meetUrl, locale]);

  const nav = "mt-8 flex flex-wrap items-center justify-between gap-3";

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <div className="mx-auto max-w-2xl text-left">
          <Stepper
            label={t("title")}
            steps={[t("steps.purpose"), t("steps.time"), t("steps.details"), t("steps.done")]}
            current={step}
          />
          {error && (
            <p
              role="alert"
              className="mt-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
            >
              {t(`errors.${error as "generic"}`)}
            </p>
          )}

          <div className="mt-8 overflow-x-clip px-1 pb-1">
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              <m.div
                key={step}
                ref={stepRef}
                role="group"
                aria-label={t(`steps.${(["purpose", "time", "details", "done"] as const)[step]}`)}
                tabIndex={-1}
                className="outline-none"
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
              >
                {step === 0 && (
                  <div>
                    <fieldset>
                      <legend className="font-heading text-lg font-bold">{t("purpose.title")}</legend>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {PURPOSES.map((p) => (
                          <Choice key={p} name="purpose" checked={purpose === p} onChange={() => setPurpose(p)}>
                            {t(`purpose.options.${p}`)}
                          </Choice>
                        ))}
                      </div>
                    </fieldset>
                    <Field label={t("service.title")} className="mt-6">
                      <Select value={service} onChange={(e) => setService(e.target.value)}>
                        <option value="">{t("service.none")}</option>
                        {services.map((s) => (
                          <option key={s.slug} value={s.slug}>
                            {s.title}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <div className={cx(nav, "justify-end")}>
                      <Button disabled={!purpose} onClick={() => go(1)}>
                        {tc("next")}
                      </Button>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div>
                    <h3 className="font-heading text-lg font-bold">{t("time.title")}</h3>
                    <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                      <Clock className="size-4 text-violet-300" aria-hidden />
                      {t("time.timezone", { tz: zone })}
                    </p>
                    {load.state === "loading" && (
                      <p role="status" className="mt-6 text-muted">
                        {t("time.loading")}
                      </p>
                    )}
                    {load.state === "error" && (
                      <div className="mt-6 flex flex-wrap items-center gap-3">
                        <p className="text-danger">{t(isOffline() ? "errors.offline" : "errors.generic")}</p>
                        <Button variant="secondary" size="sm" onClick={() => void loadSlots()}>
                          {te("retry")}
                        </Button>
                      </div>
                    )}
                    {load.state === "ready" && byDay.size === 0 && (
                      <p className="mt-6 text-muted">{t("time.noSlots")}</p>
                    )}
                    {load.state === "ready" && byDay.size > 0 && (
                      <>
                        <fieldset className="mt-6">
                          <legend className="mb-3 text-sm font-medium">{t("time.dateLabel")}</legend>
                          <div className="flex gap-2 overflow-x-auto pb-2">
                            {days.map((d) => (
                              <Choice
                                key={d}
                                name="date"
                                checked={activeDate === d}
                                disabled={!byDay.has(d)}
                                title={byDay.has(d) ? undefined : t("time.closed")}
                                onChange={() => {
                                  setDate(d);
                                  setSlot(undefined);
                                }}
                              >
                                <span className="whitespace-nowrap">{day(d)}</span>
                              </Choice>
                            ))}
                          </div>
                        </fieldset>
                        <fieldset className="mt-6">
                          <legend className="mb-3 text-sm font-medium">{t("time.slotsLabel")}</legend>
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                            {daySlots.map((s) => (
                              <Choice
                                key={s.start}
                                name="slot"
                                checked={slot?.start === s.start}
                                onChange={() => setSlot(s)}
                                title={t("time.ownerTime", { time: time(s.start, OWNER_ZONE) })}
                              >
                                <span className="block text-center font-mono">{time(s.start, zone)}</span>
                              </Choice>
                            ))}
                          </div>
                        </fieldset>
                        {slot && (
                          <p className="mt-4 text-sm text-violet-300">
                            {t("time.ownerTime", {
                              time: `${day(dayKey(slot.start, OWNER_ZONE))}, ${time(slot.start, OWNER_ZONE)}`,
                            })}
                          </p>
                        )}
                      </>
                    )}
                    <div className={nav}>
                      <Button variant="ghost" onClick={() => go(0)}>
                        {tc("back")}
                      </Button>
                      <Button disabled={!slot} onClick={() => go(2)}>
                        {tc("next")}
                      </Button>
                    </div>
                  </div>
                )}

                {step === 2 && slot && (
                  <form onSubmit={submit} noValidate className="relative grid gap-4">
                    <p className="flex items-center gap-2 text-sm text-violet-300">
                      <CalendarCheck className="size-4" aria-hidden />
                      {day(dayKey(slot.start, zone))}, {time(slot.start, zone)}
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label={t("fields.name")} required error={shownError("name")}>
                        <Input autoComplete="name" maxLength={100} required {...set("name")} />
                      </Field>
                      <Field
                        label={t("fields.email")}
                        hint={t("fields.emailHint")}
                        required
                        error={shownError("email")}
                      >
                        <Input type="email" autoComplete="email" maxLength={254} required {...set("email")} />
                      </Field>
                      <Field label={t("fields.telegram")}>
                        <Input maxLength={64} placeholder="@username" {...set("telegram")} />
                      </Field>
                      <Field label={t("fields.phone")}>
                        <Input type="tel" autoComplete="tel" maxLength={32} {...set("phone")} />
                      </Field>
                    </div>
                    <Field label={t("fields.company")}>
                      <Input autoComplete="organization" maxLength={120} {...set("company")} />
                    </Field>
                    <Field label={t("fields.note")}>
                      <Textarea maxLength={1000} placeholder={t("fields.notePlaceholder")} {...set("note")} />
                    </Field>
                    {/* honeypot: hidden from people and assistive tech; bots fill it */}
                    <div aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
                      <label>
                        {t("fields.honeypot")}
                        <input tabIndex={-1} autoComplete="off" {...set("website")} />
                      </label>
                    </div>
                    {siteKey && <Turnstile siteKey={siteKey} onToken={setCaptcha} />}
                    <div className={nav}>
                      <Button variant="ghost" onClick={() => go(1)}>
                        {tc("back")}
                      </Button>
                      {/* onMouseDown: the press must not blur the focused field. Blur shows its validation message, which
                          pushes this button down before mouse-up, and the first click would be lost. */}
                      <Button type="submit" loading={submitting} onMouseDown={(e) => e.preventDefault()}>
                        {submitting ? t("submitting") : t("submit")}
                      </Button>
                    </div>
                  </form>
                )}

                {step === 3 && slot && booking && (
                  <div className="grid justify-items-center gap-4 text-center">
                    <span className="grid size-14 place-items-center rounded-full bg-violet-600 shadow-glow">
                      <CalendarCheck className="size-7" aria-hidden />
                    </span>
                    <h3 className="text-2xl">{t("success.title")}</h3>
                    <p className="text-lg">
                      {t("success.text", { date: day(dayKey(slot.start, zone)), time: time(slot.start, zone) })}
                    </p>
                    <p className="text-sm text-muted">{t("time.ownerTime", { time: time(slot.start, OWNER_ZONE) })}</p>
                    <Chip>{t(`status.${booking.status}`)}</Chip>
                    {booking.meetUrl ? (
                      <a href={booking.meetUrl} target="_blank" rel="noopener noreferrer" className={buttonStyles()}>
                        {t("success.meetReady")}
                      </a>
                    ) : (
                      <p className="max-w-md text-sm text-muted">{t("success.meetPending")}</p>
                    )}
                    <a href={`/${locale}/booking/${booking.token}`} className={buttonStyles({ variant: "secondary" })}>
                      {t("success.manage")}
                    </a>
                  </div>
                )}
              </m.div>
            </AnimatePresence>
          </div>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
