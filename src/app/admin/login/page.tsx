import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/action-form";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Monogram } from "@/components/ui/monogram";
import { login } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="w-full max-w-sm p-8">
        <Monogram size="md" />
        <h1 className="mt-6 text-2xl">Admin</h1>
        <ActionForm action={login} submitLabel="Sign in" className="mt-6">
          <Field label="Email">
            <Input name="email" type="email" autoComplete="username" required />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
        </ActionForm>
      </Card>
    </main>
  );
}
