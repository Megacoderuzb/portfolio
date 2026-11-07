import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTitle, formatDate } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Field, Input } from "@/components/ui/field";
import { requireAdmin } from "@/lib/auth";
import { listResumes } from "@/lib/resume";
import { resumeDownloads } from "@/lib/stats";
import { activateResumeAction, uploadResumeAction } from "../actions";

export const metadata: Metadata = { title: "Resume" };

export default async function ResumePage() {
  await requireAdmin();
  const [files, downloads] = await Promise.all([listResumes(), resumeDownloads()]);

  return (
    <div className="grid max-w-3xl gap-8">
      <AdminTitle>Resume</AdminTitle>
      <p className="text-muted">
        Visitors download the active file as <span className="font-mono">Muhammadjon-Abduvakhobov-CV.pdf</span>.
        Downloads so far: <strong className="text-text">{downloads}</strong>.
      </p>

      <Card className="p-6">
        <ActionForm action={uploadResumeAction} submitLabel="Upload and activate">
          <Field label="New resume" hint="PDF only, up to 5 MB. The last 5 versions are kept.">
            <Input name="file" type="file" accept="application/pdf" required className="py-2" />
          </Field>
        </ActionForm>
      </Card>

      <ul className="grid gap-2">
        {files.length === 0 && <li className="text-muted">No resume uploaded yet: the download buttons show “not available”.</li>}
        {files.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
            <span>
              {formatDate(f.uploadedAt)} <span className="text-muted">· {Math.round(f.sizeBytes / 1024)} KB</span>
            </span>
            {f.active ? (
              <Chip>active</Chip>
            ) : (
              <form action={activateResumeAction.bind(null, f.id)}>
                <Button type="submit" variant="secondary" size="sm">
                  Make active
                </Button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
