"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Mail, Pencil, X } from "lucide-react";
import { updateAdminEmail } from "./actions";
import { ConfirmDialog } from "../ConfirmDialog";

export function EditEmailButton({
  adminId,
  username,
  currentEmail,
}: {
  adminId: string;
  username: string;
  currentEmail: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(currentEmail ?? "");
  const [confirmSave, setConfirmSave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const openModal = () => {
    setEmail(currentEmail ?? "");
    setError(null);
    setConfirmSave(false);
    setOpen(true);
  };

  const executeSave = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateAdminEmail(adminId, email);
      setConfirmSave(false);
      if (res.error) {
        setError(res.error);
      } else {
        setOpen(false);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title={currentEmail ? "Editar correo de recuperación" : "Asignar correo para OTP"}
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs font-bold text-fg-muted transition-colors hover:border-accent hover:text-accent"
      >
        <Pencil size={12} />
        <span>Correo</span>
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
            onClick={() => !isPending && setOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-3xl border border-border bg-bg p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                    <Mail size={19} />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-extrabold text-fg">
                      Correo de recuperación OTP
                    </h3>
                    <p className="text-xs text-fg-muted">
                      Usuario: <strong className="text-fg">{username}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="rounded-lg p-1.5 text-fg-muted hover:bg-bg-alt hover:text-fg disabled:opacity-40"
                >
                  <X size={16} />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setError(null);
                  setConfirmSave(true);
                }}
                className="mt-5 space-y-4"
              >
                <div>
                  <label
                    htmlFor="admin-email-input"
                    className="text-xs font-bold uppercase tracking-wider text-fg-muted"
                  >
                    Correo electrónico (déjalo vacío para quitar)
                  </label>
                  <input
                    id="admin-email-input"
                    type="email"
                    maxLength={150}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="colaborador@gmail.com"
                    className="admin-field mt-2 w-full rounded-xl px-4 py-2.5 text-sm text-fg"
                  />
                </div>

                {error && (
                  <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600">
                    {error}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={isPending}
                    className="rounded-xl px-4 py-2 text-xs font-bold text-fg-muted hover:bg-bg-alt hover:text-fg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-xl bg-accent px-5 py-2 text-xs font-bold text-accent-fg shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    Guardar correo
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {confirmSave && (
        <ConfirmDialog
          title="Confirmar correo de recuperación"
          message={
            email.trim()
              ? `¿Confirmas asignar "${email.trim().toLowerCase()}" como correo para recuperar contraseña con OTP para "${username}"?`
              : `¿Confirmas quitar el correo de recuperación de "${username}"?`
          }
          danger={!email.trim()}
          confirmLabel="Sí, confirmar"
          pendingLabel="Guardando..."
          pending={isPending}
          onConfirm={executeSave}
          onCancel={() => setConfirmSave(false)}
        />
      )}
    </>
  );
}

