"use client";

import { ArrowUpRight, Check, Circle, Hexagon, Triangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Drawer } from "@/components/ui/dialog";
import { Reveal } from "@/components/ui/reveal";
import type { Project } from "@/lib/content";
import { track } from "@/lib/events/track";

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

const motifs = [Hexagon, Triangle, Circle];

/** Generated cover: violet gradient with a per-project hue shift (±10°), angle, motif and initials. No images. */
function Cover({ project, className = "" }: { project: Project; className?: string }) {
  const h = hash(project.slug);
  const Motif = motifs[h % motifs.length];
  const initials = project.title
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}]/gu, "")[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      aria-hidden
      className={`relative h-36 overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(${110 + (h % 140)}deg, var(--violet-900), var(--violet-700) 55%, var(--violet-500))`,
        filter: `hue-rotate(${(h % 21) - 10}deg)`, // ±10°: wider drifts into blue/magenta
      }}
    >
      <Motif className="absolute -right-6 -bottom-10 size-44 text-violet-300/30" strokeWidth={1} />
      <span className="absolute bottom-4 left-5 font-heading text-4xl font-extrabold text-text">{initials}</span>
    </div>
  );
}

function VisitLink({ url, className }: { url: string; className: string }) {
  const t = useTranslations("projects");
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
      {t("visit")}
      <ArrowUpRight className="size-4" aria-hidden />
    </a>
  );
}

// Enter: cards stagger up from 0.94 behind a curtain; the detail drawer slides in from the right.
export function ProjectGrid({ projects }: { projects: Project[] }) {
  const t = useTranslations("projects");
  const [selected, setSelected] = useState<Project>();
  const [open, setOpen] = useState(false);

  const show = (project: Project) => {
    setSelected(project);
    setOpen(true);
    track("PROJECT_CLICK", { projectSlug: project.slug });
  };

  return (
    <>
      <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project, i) => (
          <Reveal as="li" preset="curtain" index={i % 3} key={project.slug}>
            <Card interactive className="relative flex h-full flex-col overflow-hidden">
              <Cover project={project} />
              <div className="flex flex-1 flex-col p-6">
                <p className="font-mono text-xs text-violet-400">{project.type}</p>
                <h3 className="mt-2 text-xl">
                  {/* stretched over the whole card: clicking anywhere opens the details */}
                  <button
                    type="button"
                    onClick={() => show(project)}
                    aria-haspopup="dialog"
                    className="text-left after:absolute after:inset-0 after:content-['']"
                  >
                    {project.title}
                  </button>
                </h3>
                <p className="mt-3 flex-1 text-sm text-muted">{project.summary}</p>
                {project.stack.length > 0 && (
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {project.stack.map((tech) => (
                      <li key={tech}>
                        <Chip>{tech}</Chip>
                      </li>
                    ))}
                  </ul>
                )}
                {project.url && (
                  <VisitLink
                    url={project.url}
                    className="relative z-10 mt-6 inline-flex items-center gap-1 self-start text-sm font-medium text-violet-300 hover:text-text"
                  />
                )}
              </div>
            </Card>
          </Reveal>
        ))}
      </ul>

      <Drawer open={open} onClose={() => setOpen(false)} title={selected?.title ?? ""}>
        {selected && (
          <div className="grid gap-6">
            <Cover project={selected} className="rounded-2xl" />
            <div>
              <p className="font-mono text-xs text-violet-400">{selected.type}</p>
              <p className="mt-2 text-muted">{selected.summary}</p>
            </div>
            {selected.highlights.length > 0 && (
              <div>
                <h3 className="font-mono text-xs font-medium tracking-widest text-violet-400 uppercase">
                  {t("highlights")}
                </h3>
                <ul className="mt-3 grid gap-2">
                  {selected.highlights.map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check className="mt-1 size-4 shrink-0 text-violet-300" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selected.stack.length > 0 && (
              <div>
                <h3 className="font-mono text-xs font-medium tracking-widest text-violet-400 uppercase">{t("stack")}</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {selected.stack.map((tech) => (
                    <li key={tech}>
                      <Chip>{tech}</Chip>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selected.url && <VisitLink url={selected.url} className={buttonStyles() + " self-start"} />}
          </div>
        )}
      </Drawer>
    </>
  );
}
