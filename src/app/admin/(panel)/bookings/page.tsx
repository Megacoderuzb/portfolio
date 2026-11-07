import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { AdminTitle, formatDate } from "@/components/admin/ui";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input, Select, Textarea } from "@/components/ui/field";
import { requireAdmin } from "@/lib/auth";
import { PURPOSES } from "@/lib/booking";
import { bookingFilters, listBookings, STATUSES } from "@/lib/booking/admin";
import type { LocalizedContent, ServiceText } from "@/lib/content";
import { listServicesAdmin } from "@/lib/content/admin";
import { retryDispatchAction, saveOwnerNotesAction, setBookingStatusAction } from "../actions";

export const metadata: Metadata = { title: "Bookings" };

const PURPOSE_LABEL = { JOB_OFFER: "Job offer", FREELANCE: "Freelance", NETWORKING: "Networking", OTHER: "Other" };
const small = buttonStyles({ variant: "secondary", size: "sm" });

export default async function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  await requireAdmin();
  const filters = bookingFilters.parse(await searchParams);
  const [bookings, services] = await Promise.all([listBookings(filters), listServicesAdmin()]);
  const serviceTitle = (content: unknown) => (content as LocalizedContent<ServiceText>).en.title;

  return (
    <div className="grid max-w-5xl gap-8">
      <AdminTitle>Bookings</AdminTitle>

      <form method="get" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:items-end">
        <Select name="status" defaultValue={filters.status ?? ""} aria-label="Status">
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select name="purpose" defaultValue={filters.purpose ?? ""} aria-label="Purpose">
          <option value="">Any purpose</option>
          {PURPOSES.map((p) => (
            <option key={p} value={p}>
              {PURPOSE_LABEL[p]}
            </option>
          ))}
        </Select>
        <Select name="service" defaultValue={filters.service ?? ""} aria-label="Service">
          <option value="">Any service</option>
          {services.map((s) => (
            <option key={s.slug} value={s.slug}>
              {serviceTitle(s.content)}
            </option>
          ))}
        </Select>
        <Input type="date" name="from" defaultValue={filters.from} aria-label="From (Tashkent date)" />
        <Input type="date" name="to" defaultValue={filters.to} aria-label="To (Tashkent date)" />
        <div className="flex gap-2">
          <Button type="submit" size="sm">
            Filter
          </Button>
          <Link href="/admin/bookings" className={buttonStyles({ variant: "ghost", size: "sm" })}>
            Reset
          </Link>
        </div>
      </form>

      {bookings.length === 0 && <p className="text-muted">No bookings match.</p>}
      <ul className="grid gap-4">
        {bookings.map((b) => {
          const active = b.status === "PENDING_MEET" || b.status === "CONFIRMED";
          return (
            <li key={b.id}>
              <Card className="grid gap-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-heading text-lg font-bold">{formatDate(b.startsAt)} (Tashkent)</p>
                  <div className="flex flex-wrap gap-2">
                    <Chip>{b.status}</Chip>
                    <Chip>{PURPOSE_LABEL[b.purpose]}</Chip>
                    {b.service && <Chip>{serviceTitle(b.service.content)}</Chip>}
                  </div>
                </div>
                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[8rem_1fr]">
                  <dt className="text-muted">Name</dt>
                  <dd>
                    {b.name}
                    {b.company && <span className="text-muted"> · {b.company}</span>}
                  </dd>
                  <dt className="text-muted">Contact</dt>
                  <dd className="break-all">
                    <a href={`mailto:${b.email}`} className="text-violet-300 hover:underline">
                      {b.email}
                    </a>
                    {b.telegram && ` · ${b.telegram}`}
                    {b.phone && ` · ${b.phone}`}
                  </dd>
                  <dt className="text-muted">Visitor</dt>
                  <dd>
                    {b.visitorTimezone} · {b.locale}
                  </dd>
                  {b.note && (
                    <>
                      <dt className="text-muted">Note</dt>
                      <dd className="whitespace-pre-line">{b.note}</dd>
                    </>
                  )}
                  {b.meetUrl && (
                    <>
                      <dt className="text-muted">Meet</dt>
                      <dd>
                        <a href={b.meetUrl} target="_blank" rel="noopener noreferrer" className="text-violet-300 hover:underline">
                          {b.meetUrl}
                        </a>
                      </dd>
                    </>
                  )}
                </dl>

                <div className="flex flex-wrap gap-2">
                  {b.status === "PENDING_MEET" && (
                    <form action={retryDispatchAction.bind(null, b.id)}>
                      <button type="submit" className={small} title="Meet link not created yet: send to n8n again">
                        Retry dispatch
                      </button>
                    </form>
                  )}
                  {active && (
                    <>
                      <form action={setBookingStatusAction.bind(null, b.id, "DONE")}>
                        <button type="submit" className={small}>
                          Done
                        </button>
                      </form>
                      <form action={setBookingStatusAction.bind(null, b.id, "NO_SHOW")}>
                        <button type="submit" className={small}>
                          No-show
                        </button>
                      </form>
                      <form action={setBookingStatusAction.bind(null, b.id, "CANCELLED")}>
                        <ConfirmButton message="Cancel this booking? The visitor's calendar event is removed." className={small}>
                          Cancel
                        </ConfirmButton>
                      </form>
                    </>
                  )}
                </div>

                <ActionForm action={saveOwnerNotesAction.bind(null, b.id)} submitLabel="Save notes" className="gap-3">
                  <Textarea name="ownerNotes" defaultValue={b.ownerNotes ?? ""} placeholder="Private notes" aria-label="Owner notes" className="min-h-20" />
                </ActionForm>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
