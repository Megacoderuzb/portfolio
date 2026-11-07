import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { AdminTitle, Checkbox, formatDate } from "@/components/admin/ui";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { requireAdmin } from "@/lib/auth";
import { getAvailability } from "@/lib/booking";
import { listBlocked } from "@/lib/booking/admin";
import { addBlockedAction, deleteBlockedAction, saveAvailabilityAction } from "../actions";

export const metadata: Metadata = { title: "Availability" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function AvailabilityPage() {
  await requireAdmin();
  const [a, blocked] = await Promise.all([getAvailability(), listBlocked()]);

  return (
    <div className="grid max-w-3xl gap-8">
      <AdminTitle>Availability</AdminTitle>
      <p className="text-muted">All times are Asia/Tashkent. Visitors see slots in their own time zone.</p>

      <Card className="p-6">
        <ActionForm action={saveAvailabilityAction} submitLabel="Save availability">
          <fieldset className="flex flex-wrap gap-4">
            <legend className="mb-2 text-sm font-medium">Working days</legend>
            {WEEKDAYS.map((label, i) => (
              <Checkbox key={label} name="workDays" value={String(i + 1)} label={label} defaultChecked={a.workDays.includes(i + 1)} />
            ))}
          </fieldset>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Day starts">
              <Input type="time" name="workStart" defaultValue={a.workStart} required />
            </Field>
            <Field label="Day ends" hint="the last slot ends by this time">
              <Input type="time" name="workEnd" defaultValue={a.workEnd} required />
            </Field>
            <Field label="Slot length">
              <Select name="slotMinutes" defaultValue={String(a.slotMinutes)}>
                {[15, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Buffer (minutes)" hint="free time kept before and after each booking">
              <Input type="number" name="bufferMinutes" min={0} max={120} defaultValue={a.bufferMinutes} required />
            </Field>
            <Field label="Minimum notice (hours)">
              <Input type="number" name="minNoticeHours" min={0} max={168} defaultValue={a.minNoticeHours} required />
            </Field>
            <Field label="Bookable days ahead">
              <Input type="number" name="maxDaysAhead" min={1} max={90} defaultValue={a.maxDaysAhead} required />
            </Field>
          </div>
        </ActionForm>
      </Card>

      <div className="grid gap-4">
        <h2 className="text-xl">Blocked time</h2>
        {blocked.length === 0 && <p className="text-muted">Nothing blocked.</p>}
        <ul className="grid gap-2">
          {blocked.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
              <span>
                {formatDate(b.startsAt)} → {formatDate(b.endsAt)}
                {b.reason && <span className="text-muted"> · {b.reason}</span>}
              </span>
              <form action={deleteBlockedAction.bind(null, b.id)}>
                <ConfirmButton message="Unblock this time?" className={buttonStyles({ variant: "ghost", size: "sm" })}>
                  Remove
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
        <Card className="p-6">
          <ActionForm action={addBlockedAction} submitLabel="Block time">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="From (Tashkent)">
                <Input type="datetime-local" name="from" required />
              </Field>
              <Field label="To (Tashkent)">
                <Input type="datetime-local" name="to" required />
              </Field>
            </div>
            <Field label="Reason" hint="optional, only you see it">
              <Input name="reason" maxLength={200} />
            </Field>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
