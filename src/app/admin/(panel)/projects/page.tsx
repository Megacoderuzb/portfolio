import { ArrowDown, ArrowUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminTitle } from "@/components/admin/ui";
import { buttonStyles } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { requireAdmin } from "@/lib/auth";
import type { LocalizedContent, ProjectText } from "@/lib/content";
import { listProjectsAdmin } from "@/lib/content/admin";
import { moveAction } from "../actions";

export const metadata: Metadata = { title: "Projects" };

const arrow = "rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30";

export default async function ProjectsPage() {
  await requireAdmin();
  const projects = await listProjectsAdmin();

  return (
    <div className="max-w-4xl">
      <AdminTitle
        action={
          <Link href="/admin/projects/new" className={buttonStyles({ size: "sm" })}>
            New project
          </Link>
        }
      >
        Projects
      </AdminTitle>
      <ul className="mt-8 grid gap-2">
        {projects.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
            <div className="flex flex-col">
              <form action={moveAction.bind(null, "project", p.id, -1)}>
                <button type="submit" disabled={i === 0} aria-label={`Move ${p.title} up`} className={arrow}>
                  <ArrowUp className="size-4" aria-hidden />
                </button>
              </form>
              <form action={moveAction.bind(null, "project", p.id, 1)}>
                <button type="submit" disabled={i === projects.length - 1} aria-label={`Move ${p.title} down`} className={arrow}>
                  <ArrowDown className="size-4" aria-hidden />
                </button>
              </form>
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/admin/projects/${p.id}`} className="font-medium hover:text-violet-300">
                {p.title}
              </Link>
              <p className="truncate text-sm text-muted">{(p.content as LocalizedContent<ProjectText>).en.type}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {!p.visible && <Chip>hidden</Chip>}
              {p.status === "NEEDS_INPUT" && <Chip>needs input</Chip>}
              {(p.content as LocalizedContent<ProjectText>)._review && <Chip>review uz/ru</Chip>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
