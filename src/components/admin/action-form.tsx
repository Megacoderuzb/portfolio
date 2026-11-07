"use client";

import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";

export type ActionState = { ok?: boolean; error?: string } | null;

type Props = {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  submitLabel: string;
  children: ReactNode;
  className?: string;
};

/** Admin form: posts to a Server Action, shows pending state and the result message. Fields can be server-rendered. */
export function ActionForm({ action, submitLabel, children, className }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={cx("grid gap-5", className)}>
      {children}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
        <p role="status" className={cx("text-sm", state?.error ? "text-danger" : "text-success")}>
          {state?.error ?? (state?.ok ? "Saved" : "")}
        </p>
      </div>
    </form>
  );
}
