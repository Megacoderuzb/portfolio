import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Monogram } from "@/components/ui/monogram";
import { Skeleton } from "@/components/ui/skeleton";
import { logoutAction } from "./actions";

const nav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/availability", label: "Availability" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/resume", label: "Resume" },
  { href: "/admin/settings", label: "Settings" },
];

// Pages read the session and the DB at request time, so they stream inside the Suspense boundary.
export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[14rem_1fr]">
      <aside className="flex items-center gap-1 overflow-x-auto border-b border-border bg-bg-0/60 p-4 lg:flex-col lg:items-stretch lg:border-r lg:border-b-0">
        <Link href="/admin" className="mr-4 self-start rounded-xl lg:mb-6" aria-label="Dashboard">
          <Monogram />
        </Link>
        <nav aria-label="Admin" className="contents">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl px-3 py-2 text-sm whitespace-nowrap text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex gap-1 lg:mt-auto lg:ml-0 lg:flex-col">
          <Link href="/uz" className="rounded-xl px-3 py-2 text-sm whitespace-nowrap text-muted hover:text-text">
            View site ↗
          </Link>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Log out
            </Button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 p-6 lg:p-10">
        <Suspense fallback={<Skeleton className="h-40 max-w-3xl" />}>{children}</Suspense>
      </main>
    </div>
  );
}
