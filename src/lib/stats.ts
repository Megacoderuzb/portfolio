import { db } from "@/lib/db";

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

/** SERVICE_CLICK counts per service slug (all time, or since a date). */
export async function serviceInterest(since = new Date(0)) {
  const rows = await db.$queryRaw<{ slug: string | null; count: bigint }[]>`
    SELECT meta->>'serviceSlug' AS slug, count(*) AS count
    FROM "AnalyticsEvent"
    WHERE type = 'SERVICE_CLICK' AND "createdAt" >= ${since}
    GROUP BY 1`;
  return new Map(rows.flatMap((r) => (r.slug ? [[r.slug, Number(r.count)] as const] : [])));
}

export const resumeDownloads = (since = new Date(0)) =>
  db.analyticsEvent.count({ where: { type: "RESUME_DOWNLOAD", createdAt: { gte: since } } });

/** Last 7 days: the n8n weekly summary and the bot's /stats. */
export async function weeklyStats(now = new Date()) {
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [bookings, cancelled, downloads, interest] = await Promise.all([
    db.booking.count({ where: { createdAt: { gte: since } } }),
    db.booking.count({ where: { createdAt: { gte: since }, status: "CANCELLED" } }),
    resumeDownloads(since),
    serviceInterest(since),
  ]);
  return {
    from: since.toISOString(),
    to: now.toISOString(),
    bookings,
    cancelled,
    resumeDownloads: downloads,
    topServices: [...interest]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([slug, clicks]) => ({ slug, clicks })),
  };
}

/** Owner dashboard: last 30 days + upcoming bookings. */
export async function dashboardStats() {
  const since = daysAgo(30);
  const [bookings, downloads, interest, purposes, upcoming] = await Promise.all([
    db.booking.count({ where: { createdAt: { gte: since } } }),
    resumeDownloads(since),
    serviceInterest(since),
    db.booking.groupBy({ by: ["purpose"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    db.booking.findMany({
      where: { startsAt: { gte: new Date() }, status: { in: ["PENDING_MEET", "CONFIRMED"] } },
      orderBy: { startsAt: "asc" },
      take: 5,
      select: { id: true, name: true, purpose: true, startsAt: true, status: true },
    }),
  ]);
  return {
    bookings,
    downloads,
    interest,
    purposes: Object.fromEntries(purposes.map((p) => [p.purpose, p._count._all])),
    upcoming,
  };
}
