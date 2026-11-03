"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Modal for destructive actions. Focus starts on the safe button, Escape and the backdrop cancel.
export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  keepLabel,
  busy = false,
  error,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  keepLabel: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="confirm-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-black/60"
    >
      <div className="p-6">
        <h2 id="confirm-title" className="text-xl font-bold">
          {title}
        </h2>
        <div className="mt-2 text-sm text-muted">{children}</div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" autoFocus onClick={onClose} className="btn btn-ghost">
            {keepLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className="btn btn-danger">
            {busy ? "Aguarde…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
