import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { AdminTitle, Checkbox, LocaleTabs } from "@/components/admin/ui";
import { buttonStyles } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { requireAdmin } from "@/lib/auth";
import type { LocalizedContent, ProjectText, ServiceText } from "@/lib/content";
import { getProjectAdmin, listServicesAdmin } from "@/lib/content/admin";
import { deleteProjectAction, saveProjectAction } from "../../actions";

export const metadata: Metadata = { title: "Edit project" };

/** /admin/projects/new creates, /admin/projects/{id} edits. */
export default async function ProjectEditPage({ params }: PageProps<"/admin/projects/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const [project, services] = await Promise.all([id === "new" ? null : getProjectAdmin(id), listServicesAdmin()]);
  if (id !== "new" && !project) notFound();
  const content = (project?.content ?? {}) as Partial<LocalizedContent<ProjectText>>;
  const linked = new Set(project?.services.map((s) => s.id));

  return (
    <div className="max-w-3xl">
      <AdminTitle>{project?.title ?? "New project"}</AdminTitle>
      <ActionForm action={saveProjectAction} submitLabel="Save project" className="mt-8">
        {project && <input type="hidden" name="id" value={project.id} />}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Title" required>
            <Input name="title" defaultValue={project?.title} required />
          </Field>
          <Field label="Slug" hint="lowercase-with-dashes; used in analytics" required>
            <Input name="slug" defaultValue={project?.slug} required />
          </Field>
          <Field label="Website URL" hint="optional">
            <Input name="url" type="url" defaultValue={project?.url ?? ""} />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={project?.status ?? "VERIFIED"}>
              <option value="VERIFIED">Verified</option>
              <option value="NEEDS_INPUT">Needs input</option>
            </Select>
          </Field>
        </div>
        <Field label="Stack" hint="comma-separated, e.g. NestJS, PostgreSQL, Redis">
          <Input name="stack" defaultValue={project?.stack.join(", ")} />
        </Field>
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Related services</legend>
          {services.map((s) => (
            <Checkbox
              key={s.id}
              name="serviceIds"
              value={s.id}
              label={(s.content as LocalizedContent<ServiceText>).en.title}
              defaultChecked={linked.has(s.id)}
            />
          ))}
        </fieldset>
        <Checkbox name="visible" label="Visible on the site" defaultChecked={project?.visible ?? true} />
        <LocaleTabs
          render={(l) => (
            <>
              <Field label="Type" hint={l === "en" ? "e.g. Corporate website" : "empty = English"}>
                <Input name={`${l}.type`} defaultValue={content[l]?.type} />
              </Field>
              <Field label="Summary">
                <Textarea name={`${l}.summary`} defaultValue={content[l]?.summary} />
              </Field>
              <Field label="Highlights" hint="one per line">
                <Textarea name={`${l}.highlights`} defaultValue={content[l]?.highlights?.join("\n")} className="min-h-36" />
              </Field>
            </>
          )}
        />
      </ActionForm>
      {project && (
        <form action={deleteProjectAction.bind(null, project.id)} className="mt-12 border-t border-border pt-6">
          <ConfirmButton message={`Delete “${project.title}”? This cannot be undone.`} className={buttonStyles({ variant: "ghost", size: "sm" })}>
            Delete project
          </ConfirmButton>
        </form>
      )}
    </div>
  );
}
