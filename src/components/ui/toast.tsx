"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";

type Tone = "default" | "success" | "error";
type Toast = { id: number; message: string; tone: Tone };

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

/** `const toast = useToast(); toast(t("contact.copied"), "success")` */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string, tone: Tone = "default") => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, message, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext value={show}>
      {children}
      <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-50 grid -translate-x-1/2 gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="ui-toast flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm shadow-glow"
          >
            {t.tone === "success" && <CircleCheck className="size-4 text-success" aria-hidden />}
            {t.tone === "error" && <CircleAlert className="size-4 text-danger" aria-hidden />}
            <span className={cx(t.tone === "error" && "text-danger")}>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}
