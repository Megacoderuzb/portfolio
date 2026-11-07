import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { AdminTitle, Checkbox, LocaleTabs } from "@/components/admin/ui";
import { buttonStyles } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { requireAdmin } from "@/lib/auth";
import type { LocalizedContent, ServiceText } from "@/lib/content";
import { getServiceAdmin } from "@/lib/content/admin";
import { deleteServiceAction, saveServiceAction } from "../../actions";

export const metadata: Metadata = { title: "Edit service" };

/** /admin/services/new creates, /admin/services/{id} edits. No prices anywhere. */
export default async function ServiceEditPage({ params }: PageProps<"/admin/services/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const service = id === "new" ? null : await getServiceAdmin(id);
  if (id !== "new" && !service) notFound();
  const content = (service?.content ?? {}) as Partial<LocalizedContent<ServiceText>>;

  return (
    <div className="max-w-3xl">
      <AdminTitle>{content.en?.title ?? "New service"}</AdminTitle>
      <ActionForm action={saveServiceAction} submitLabel="Save service" className="mt-8">
        {service && <input type="hidden" name="id" value={service.id} />}
        <Field label="Slug" hint="lowercase-with-dashes; booking and analytics use it" required>
          <Input name="slug" defaultValue={service?.slug} required />
        </Field>
        <Checkbox name="visible" label="Visible on the site" defaultChecked={service?.visible ?? true} />
        <LocaleTabs
          render={(l) => (
            <>
              <Field label="Title" hint={l === "en" ? undefined : "empty = English"}>
                <Input name={`${l}.title`} defaultValue={content[l]?.title} />
              </Field>
              <Field label="Description">
                <Textarea name={`${l}.description`} defaultValue={content[l]?.description} />
              </Field>
            </>
          )}
        />
      </ActionForm>
      {service && (
        <form action={deleteServiceAction.bind(null, service.id)} className="mt-12 border-t border-border pt-6">
          <ConfirmButton
            message="Delete this service? Bookings keep their data but lose the link."
            className={buttonStyles({ variant: "ghost", size: "sm" })}
          >
            Delete service
          </ConfirmButton>
        </form>
      )}
    </div>
  );
}
