import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTitle } from "@/components/admin/ui";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { requireAdmin } from "@/lib/auth";
import { getContactsSetting } from "@/lib/content/admin";
import { saveContactsAction } from "../actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin();
  const contacts = await getContactsSetting();

  return (
    <div className="grid max-w-3xl gap-8">
      <AdminTitle>Settings</AdminTitle>
      <Card className="p-6">
        <h2 className="text-xl">Contact links</h2>
        <p className="mt-1 text-sm text-muted">Shown in the Contacts section of the site.</p>
        <ActionForm action={saveContactsAction} submitLabel="Save contacts" className="mt-6">
          <Field label="Email" required>
            <Input name="email" type="email" defaultValue={contacts?.email} required />
          </Field>
          <Field label="Telegram URL" hint="https://t.me/…" required>
            <Input name="telegram" type="url" defaultValue={contacts?.telegram} required />
          </Field>
          <Field label="LinkedIn URL" required>
            <Input name="linkedin" type="url" defaultValue={contacts?.linkedin} required />
          </Field>
          <Field label="GitHub URL" required>
            <Input name="github" type="url" defaultValue={contacts?.github} required />
          </Field>
        </ActionForm>
      </Card>
    </div>
  );
}
