"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Eye, EyeOff, KeyRound, MessageCircle, Sparkles, X } from "lucide-react";
import { resetAdminPassword } from "./actions";
import { ConfirmDialog } from "../ConfirmDialog";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";

function generateStrongPassword(length = 14): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CHARSET[bytes[i] % CHARSET.length];
  }
  return out;
}

export function ResetPasswordButton({
  adminId,
  username,
}: {
  adminId: string;
  username: string;
}) {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(true);
  const [confirmSave, setConfirmSave] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedPassword, setSavedPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const openModal = () => {
    setNewPassword("");
    setSavedPassword(null);
    setError(null);
    setConfirmSave(false);
    setCopied(false);
    setOpen(true);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const executeReset = () => {
    setError(null);
    const pw = newPassword;
    startTransition(async () => {
      const res = await resetAdminPassword(adminId, pw);
      setConfirmSave(false);
      if (res.error) {
        setError(res.error);
      } else {
        setSavedPassword(pw);
      }
    });
  };

  const shareWaUrl = savedPassword
    ? `https://wa.me/?text=${encodeURIComponent(
        `Hola, tu nueva clave temporal de acceso a *INFOSISTEL* ha sido actualizada.\n• Usuario: *${username}*\n• Nueva clave: *${savedPassword}*\nPor seguridad, guárdala bien y evita compartirla.`
      )}`
    : null;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title={`Restablecer contraseña de ${username}`}
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs font-bold text-fg-muted transition-colors hover:border-accent hover:text-accent"
      >
        <KeyRound size={13} />
        <span>Cambiar clave</span>
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
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-extrabold text-fg">
                      Restablecer contraseña
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

              {savedPassword ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-800 dark:text-emerald-200">
                    <p className="font-bold text-sm">¡Contraseña actualizada con éxito!</p>
                    <p className="mt-1">
                      Las sesiones anteriores de <strong>{username}</strong> fueron cerradas
                      automáticamente. Entrega esta nueva clave al colaborador:
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-bg px-3 py-2 font-mono text-sm font-black text-fg">
                      <span className="truncate">{savedPassword}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(savedPassword)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                      >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copied ? "¡Copiada!" : "Copiar"}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {shareWaUrl && (
                      <a
                        href={shareWaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        <MessageCircle size={14} />
                        <span>Enviar por WhatsApp</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-fg hover:bg-bg-alt"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newPassword.length < 12) {
                      setError("La nueva contraseña debe tener al menos 12 caracteres.");
                      return;
                    }
                    setError(null);
                    setConfirmSave(true);
                  }}
                  className="mt-5 space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="reset-pw-input"
                        className="text-xs font-bold uppercase tracking-wider text-fg-muted"
                      >
                        Nueva contraseña (mín. 12 caracteres)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setNewPassword(generateStrongPassword(14));
                          setShowPassword(true);
                          setError(null);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline"
                      >
                        <Sparkles size={12} />
                        Generar clave segura
                      </button>
                    </div>

                    <div className="relative mt-2">
                      <input
                        id="reset-pw-input"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={12}
                        maxLength={256}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo 12 caracteres..."
                        className="admin-field w-full rounded-xl px-4 py-2.5 pr-20 font-mono text-sm text-fg"
                      />
                      <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
                        {newPassword && (
                          <button
                            type="button"
                            onClick={() => handleCopy(newPassword)}
                            title="Copiar"
                            className="rounded p-1 text-fg-muted hover:text-fg"
                          >
                            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? "Ocultar" : "Mostrar"}
                          className="rounded p-1 text-fg-muted hover:text-fg"
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
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
                      disabled={isPending || newPassword.length < 12}
                      className="rounded-xl bg-accent px-5 py-2 text-xs font-bold text-accent-fg shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      Cambiar contraseña
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body
        )}

      {confirmSave && (
        <ConfirmDialog
          title="Confirmar cambio de contraseña"
          message={`¡Atención! ¿Confirmas asignar una nueva contraseña al usuario "${username}"? Todas sus sesiones activas se cerrarán de inmediato.`}
          danger
          confirmLabel="Sí, cambiar clave"
          pendingLabel="Actualizando..."
          pending={isPending}
          onConfirm={executeReset}
          onCancel={() => setConfirmSave(false)}
        />
      )}
    </>
  );
}

