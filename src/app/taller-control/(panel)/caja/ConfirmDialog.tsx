"use client";

import { createPortal } from "react-dom";
import { ShieldCheck, X } from "lucide-react";

interface ConfirmDialogProps {
  title: string;
  fields: { label: string; value: string }[];
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Portals to document.body: rows render inside an .admin-glass table
 *  wrapper, whose backdrop-filter creates a new containing block for
 *  `fixed` descendants — without the portal the overlay would be clipped
 *  to that wrapper instead of covering the viewport (see SellButton.tsx). */
export function ConfirmDialog({ title, fields, pending, onConfirm, onCancel }: ConfirmDialogProps) {
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-bg-alt p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-fg">{title}</h3>
          <button
            onClick={onCancel}
            disabled={pending}
            aria-label="Cancelar"
            className="rounded-full p-1.5 text-fg-muted transition-colors hover:bg-bg disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          {fields.map((f) => (
            <div key={f.label} className="flex items-baseline justify-between gap-4">
              <dt className="text-fg-muted">{f.label}</dt>
              <dd className="text-right font-semibold text-fg">{f.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={pending}
            className="text-xs font-semibold text-fg-muted hover:text-fg disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <ShieldCheck size={14} />
            {pending ? "Guardando..." : "Aceptar"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
