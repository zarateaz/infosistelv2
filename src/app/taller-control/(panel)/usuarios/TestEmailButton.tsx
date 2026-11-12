"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Mail, Send, AlertCircle } from "lucide-react";
import { sendTestEmailAction } from "./actions";

export function TestEmailButton({ configured }: { configured: boolean }) {
  const [open, setOpen] = useState(false);
  const [toEmail, setToEmail] = useState("");
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!configured) return null;

  return (
    <div className="mt-3 border-t border-emerald-500/20 pt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setResult(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600/30 bg-white/70 dark:bg-bg px-3 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 transition-colors hover:bg-emerald-600 hover:text-white"
        >
          <Mail size={13} />
          <span>Enviar correo OTP de prueba</span>
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setResult(null);
            startTransition(async () => {
              const res = await sendTestEmailAction(toEmail);
              setResult(res);
            });
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="email"
            required
            value={toEmail}
            onChange={(e) => setToEmail(e.target.value)}
            placeholder="tu-correo@gmail.com"
            className="admin-field w-64 rounded-xl px-3 py-1.5 text-xs text-fg"
          />
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Send size={12} />
            <span>{isPending ? "Enviando..." : "Probar envío"}</span>
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-2 py-1 text-xs font-bold text-fg-muted hover:text-fg"
          >
            Cerrar
          </button>

          {result?.ok && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 size={14} /> ¡Enviado! Revisa tu bandeja de entrada.
            </span>
          )}
          {result?.error && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400">
              <AlertCircle size={14} /> {result.error}
            </span>
          )}
        </form>
      )}
    </div>
  );
}

