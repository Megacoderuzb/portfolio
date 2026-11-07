import type { Metadata } from "next";
import { formatDate } from "@/components/admin/ui";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import type { LocalizedContent, ServiceText } from "@/lib/content";
import { bookingsByService } from "@/lib/booking/admin";
import { listServicesAdmin } from "@/lib/content/admin";
import { dashboardStats } from "@/lib/stats";

export const metadata: Metadata = { title: "Dashboard" };

const PURPOSES = { JOB_OFFER: "Job offer", FREELANCE: "Freelance project", NETWORKING: "Networking", OTHER: "Other" };

export default async function DashboardPage() {
  await requireAdmin();
  const [stats, services, booked] = await Promise.all([dashboardStats(), listServicesAdmin(), bookingsByService(30)]);
  // service interest = "Book" clicks + actual bookings that picked the service
  const interest = services
    .map((s) => {
      const clicks = stats.interest.get(s.slug) ?? 0;
      const bookings = booked.get(s.slug) ?? 0;
      return { label: (s.content as LocalizedContent<ServiceText>).en.title, clicks, bookings, count: clicks + bookings };
    })
    .sort((a, b) => b.count - a.count);
  const maxInterest = Math.max(1, ...interest.map((i) => i.count));
  const counters = [
    { label: "Bookings", value: stats.bookings },
    { label: "Resume downloads", value: stats.downloads },
    { label: "Service clicks", value: interest.reduce((sum, i) => sum + i.clicks, 0) },
  ];

  return (
    <div className="grid max-w-5xl gap-8">
      <div>
        <h1 className="text-3xl">Dashboard</h1>
        <p className="mt-2 text-muted">Last 30 days</p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-3">
        {counters.map((c) => (
          <li key={c.label}>
            <Card className="p-6">
              <p className="text-sm text-muted">{c.label}</p>
              <p className="mt-2 font-heading text-4xl font-extrabold">{c.value}</p>
            </Card>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl">Service interest</h2>
          <ul className="mt-5 grid gap-3">
            {interest.map((i) => (
              <li key={i.label} className="grid gap-1 text-sm">
                <div className="flex justify-between gap-4">
                  <span>{i.label}</span>
                  <span className="font-mono text-violet-300">
                    {i.clicks} clicks · {i.bookings} bookings
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-violet-500" style={{ width: `${(i.count / maxInterest) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl">Booking purpose</h2>
          <dl className="mt-5 grid grid-cols-2 gap-4">
            {Object.entries(PURPOSES).map(([key, label]) => (
              <div key={key}>
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="font-heading text-2xl font-extrabold">{stats.purposes[key] ?? 0}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-xl">Upcoming bookings</h2>
        {stats.upcoming.length === 0 ? (
          <p className="mt-4 text-muted">No upcoming bookings yet.</p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {stats.upcoming.map((b) => (
              <li key={b.id} className="flex flex-wrap justify-between gap-2 text-sm">
                <span>
                  {b.name} · {PURPOSES[b.purpose]}
                </span>
                <span className="font-mono text-muted">{formatDate(b.startsAt)} (Tashkent)</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
