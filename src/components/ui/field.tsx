"use client";

import { ChevronDown } from "lucide-react";
import {
  createContext,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "@/lib/cx";

type FieldState = { id: string; invalid: boolean; describedBy?: string };
const FieldContext = createContext<FieldState | null>(null);

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

/** Label + control + hint + error. The control inside picks up id / aria-invalid / aria-describedby. */
export function Field({ label, hint, error, required, children, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext value={{ id, invalid: Boolean(error), describedBy }}>
      <div className={cx("grid gap-1.5", className)}>
        <label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && (
            <span aria-hidden className="text-violet-400">
              {" *"}
            </span>
          )}
        </label>
        {children}
        {hint && (
          <p id={hintId} className="text-sm text-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </FieldContext>
  );
}

function useFieldProps() {
  const field = useContext(FieldContext);
  return field ? { id: field.id, "aria-invalid": field.invalid || undefined, "aria-describedby": field.describedBy } : {};
}

const control =
  "w-full rounded-xl border border-border bg-bg-1 px-4 text-text transition-colors placeholder:text-dim hover:border-violet-500/40 focus-visible:border-violet-400 aria-invalid:border-danger";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...useFieldProps()} className={cx(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...useFieldProps()} className={cx(control, "min-h-28 py-2.5", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...useFieldProps()} className={cx(control, "h-11 appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-violet-300"
      />
    </div>
  );
}
