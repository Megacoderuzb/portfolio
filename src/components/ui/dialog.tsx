"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";

type Props = { open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string };

// Native <dialog> gives focus trap, Esc, inert background and focus return for free.
// Enter/exit transitions live in globals.css (.ui-dialog).
function Modal({ open, onClose, title, children, className, drawer }: Props & { drawer?: boolean }) {
  const t = useTranslations("common");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // a click on the dialog element itself (not its content) is a backdrop click
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={cx("ui-dialog", drawer && "ui-drawer", className)}
    >
      <div className="flex h-full flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="-m-2 rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </dialog>
  );
}

/** Centered modal dialog. */
export function Dialog(props: Props) {
  return <Modal {...props} />;
}

/** Panel sliding in from the right (mobile menu, project details). */
export function Drawer(props: Props) {
  return <Modal {...props} drawer />;
}
